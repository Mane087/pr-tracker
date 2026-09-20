import { computed, inject, Injectable, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { TrackedPullRequest } from '../database/models';
import { GithubApiService } from '../github/github-api.service';
import {
  describeGithubError,
  GitHubApiError,
  GitHubRateLimitError,
  MissingSessionTokenError,
} from '../github/github-errors';
import { GithubSessionService } from '../github/github-session.service';
import { TrackedPullRequestsService } from '../pull-requests/tracked-pull-requests.service';
import { mapWithConcurrency } from '../../shared/utils/map-with-concurrency';
import { remoteStateFromLocal, syncPullRequest } from './pull-request-sync';

const REFRESH_CONCURRENCY = 4;

export interface RefreshSummary {
  refreshedCount: number;
  archivedCount: number;
  attentionCount: number;
  failedCount: number;
}

/**
 * Manual synchronization of every active pull request (plan, sections 22 to 24 and 40).
 * Pull requests are grouped by session so each request uses its own token. Only one refresh runs at a time.
 */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly database = inject(DatabaseService);
  private readonly githubApi = inject(GithubApiService);
  private readonly sessions = inject(GithubSessionService);
  private readonly trackedPullRequests = inject(TrackedPullRequestsService);

  private inFlight: Promise<RefreshSummary> | null = null;
  private readonly isRefreshingState = signal(false);
  private readonly lastRefreshedAtState = signal<Date | null>(null);
  private readonly sessionErrorsState = signal<ReadonlyMap<string, string>>(new Map());
  private readonly lastSummaryState = signal<RefreshSummary | null>(null);

  readonly isRefreshing = this.isRefreshingState.asReadonly();
  readonly lastRefreshedAt = this.lastRefreshedAtState.asReadonly();
  readonly sessionErrors = this.sessionErrorsState.asReadonly();
  readonly lastSummary = this.lastSummaryState.asReadonly();
  readonly canRefresh = computed(() => !this.isRefreshing() && this.sessions.hasReadySession());

  async initialize(): Promise<void> {
    const setting = await this.database.settings.get('lastRefreshedAt');
    this.lastRefreshedAtState.set(setting?.value ? new Date(setting.value) : null);
  }

  refreshAll(): Promise<RefreshSummary> {
    if (!this.inFlight) {
      this.inFlight = this.run().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async run(): Promise<RefreshSummary> {
    this.isRefreshingState.set(true);
    const summary: RefreshSummary = {
      refreshedCount: 0,
      archivedCount: 0,
      attentionCount: 0,
      failedCount: 0,
    };
    const errors = new Map<string, string>();

    try {
      const pullRequestsBySession = groupBySession(
        this.trackedPullRequests.all().filter((pullRequest) => !pullRequest.isArchived),
      );

      await Promise.all(
        this.sessions.accounts().map(async (account) => {
          const pullRequests = pullRequestsBySession.get(account.id) ?? [];
          if (pullRequests.length === 0) {
            return;
          }
          if (!account.hasToken) {
            errors.set(
              account.id,
              'Ingresa el token de la cuenta para sincronizar sus Pull Requests.',
            );
            summary.failedCount += pullRequests.length;
            return;
          }
          await this.refreshSession(account.id, pullRequests, summary, errors);
        }),
      );

      const now = new Date();
      await this.database.settings.put({ key: 'lastRefreshedAt', value: now.toISOString() });
      this.lastRefreshedAtState.set(now);
    } finally {
      this.sessionErrorsState.set(errors);
      this.lastSummaryState.set(summary);
      this.isRefreshingState.set(false);
    }

    return summary;
  }

  /** A rate limit, a missing token or a 401 stops the rest of the session; other failures only skip that pull request. */
  private async refreshSession(
    sessionId: string,
    pullRequests: TrackedPullRequest[],
    summary: RefreshSummary,
    errors: Map<string, string>,
  ): Promise<void> {
    let isAborted = false;

    await mapWithConcurrency(pullRequests, REFRESH_CONCURRENCY, async (pullRequest) => {
      if (isAborted) {
        summary.failedCount++;
        return;
      }

      try {
        const synced = await this.syncOne(pullRequest);
        summary.refreshedCount++;
        if (synced.isArchived) {
          summary.archivedCount++;
        }
        if (synced.isAttentionRequired && !synced.isArchived) {
          summary.attentionCount++;
        }
      } catch (error) {
        summary.failedCount++;
        if (isSessionBlockingError(error)) {
          isAborted = true;
          errors.set(sessionId, describeGithubError(error));
        }
      }
    });
  }

  private async syncOne(local: TrackedPullRequest): Promise<TrackedPullRequest> {
    const [pullRequestResponse, reviewsResponse] = await Promise.all([
      this.githubApi.getPullRequest(
        local.githubSessionId,
        local.owner,
        local.repository,
        local.number,
        local.etag,
      ),
      this.githubApi.getPullRequestReviews(
        local.githubSessionId,
        local.owner,
        local.repository,
        local.number,
        local.reviewsEtag,
      ),
    ]);

    const synced = syncPullRequest({
      local,
      remote: pullRequestResponse.isModified
        ? pullRequestResponse.data
        : remoteStateFromLocal(local),
      reviewCount: reviewsResponse.isModified ? reviewsResponse.data.length : local.reviewCount,
      etag: pullRequestResponse.etag,
      reviewsEtag: reviewsResponse.etag,
      now: new Date(),
    });

    await this.trackedPullRequests.replace(synced);
    return synced;
  }
}

function groupBySession(pullRequests: TrackedPullRequest[]): Map<string, TrackedPullRequest[]> {
  const groups = new Map<string, TrackedPullRequest[]>();
  for (const pullRequest of pullRequests) {
    const group = groups.get(pullRequest.githubSessionId) ?? [];
    group.push(pullRequest);
    groups.set(pullRequest.githubSessionId, group);
  }
  return groups;
}

function isSessionBlockingError(error: unknown): boolean {
  return (
    error instanceof GitHubRateLimitError ||
    error instanceof MissingSessionTokenError ||
    (error instanceof GitHubApiError && error.status === 401)
  );
}
