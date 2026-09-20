import { computed, inject, Injectable, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import {
  Priority,
  PullRequestCategory,
  TrackedPullRequest,
  TrackedPullRequestStatus,
} from '../database/models';
import { comparePullRequests } from './pull-request-sorting';

export class UnknownPullRequestError extends Error {
  constructor(readonly pullRequestId: string) {
    super('El Pull Request no está en la lista de seguimiento.');
    this.name = 'UnknownPullRequestError';
  }
}

export class DuplicatePullRequestError extends Error {
  constructor(readonly pullRequestId: string) {
    super('Ese Pull Request ya está en seguimiento.');
    this.name = 'DuplicatePullRequestError';
  }
}

/** In-memory mirror of the `trackedPullRequests` table. Every change is persisted before the signal updates. */
@Injectable({ providedIn: 'root' })
export class TrackedPullRequestsService {
  private readonly database = inject(DatabaseService);
  private readonly pullRequestsState = signal<TrackedPullRequest[]>([]);

  readonly all = this.pullRequestsState.asReadonly();
  readonly work = computed(() => this.activeByCategory('WORK'));
  readonly review = computed(() => this.activeByCategory('REVIEW'));

  async load(): Promise<void> {
    this.pullRequestsState.set(await this.database.trackedPullRequests.toArray());
  }

  has(pullRequestId: string): boolean {
    return this.pullRequestsState().some((pullRequest) => pullRequest.id === pullRequestId);
  }

  async add(pullRequest: TrackedPullRequest): Promise<void> {
    await this.database.trackedPullRequests.put(pullRequest);
    this.pullRequestsState.update((pullRequests) => [
      ...pullRequests.filter((current) => current.id !== pullRequest.id),
      pullRequest,
    ]);
  }

  /** Persists a full record produced elsewhere (for example by the refresh engine) without touching `updatedAt`. */
  async replace(pullRequest: TrackedPullRequest): Promise<void> {
    this.require(pullRequest.id);
    await this.database.trackedPullRequests.put(pullRequest);
    this.pullRequestsState.update((pullRequests) =>
      pullRequests.map((current) => (current.id === pullRequest.id ? pullRequest : current)),
    );
  }

  /** Clears the attention indicator by accepting the current remote counters as seen. The status is kept. */
  async acknowledge(pullRequestId: string): Promise<void> {
    const pullRequest = this.require(pullRequestId);
    await this.update(pullRequestId, {
      lastKnownIssueCommentCount: pullRequest.issueCommentCount,
      lastKnownReviewCommentCount: pullRequest.reviewCommentCount,
      lastKnownReviewCount: pullRequest.reviewCount,
      lastKnownCommitCount: pullRequest.commitCount,
      isAttentionRequired: false,
      attentionReasons: [],
    });
  }

  async update(
    pullRequestId: string,
    changes: Partial<TrackedPullRequest>,
  ): Promise<TrackedPullRequest> {
    const current = this.require(pullRequestId);
    const updated: TrackedPullRequest = {
      ...current,
      ...changes,
      id: current.id,
      updatedAt: new Date(),
    };

    await this.database.trackedPullRequests.put(updated);
    this.pullRequestsState.update((pullRequests) =>
      pullRequests.map((pullRequest) => (pullRequest.id === pullRequestId ? updated : pullRequest)),
    );

    return updated;
  }

  /** Marking a Work pull request as CURRENT pauses the previous CURRENT of the same session (plan, section 12). */
  async setStatus(pullRequestId: string, status: TrackedPullRequestStatus): Promise<void> {
    const pullRequest = this.require(pullRequestId);

    if (status === 'CURRENT' && pullRequest.category === 'WORK') {
      const previousCurrent = this.pullRequestsState().filter(
        (candidate) =>
          candidate.id !== pullRequestId &&
          candidate.category === 'WORK' &&
          candidate.githubSessionId === pullRequest.githubSessionId &&
          candidate.status === 'CURRENT',
      );
      for (const candidate of previousCurrent) {
        await this.update(candidate.id, { status: 'PAUSED' });
      }
    }

    await this.update(pullRequestId, { status });
  }

  async setPriority(pullRequestId: string, priority: Priority): Promise<void> {
    await this.update(pullRequestId, { priority });
  }

  private activeByCategory(category: PullRequestCategory): TrackedPullRequest[] {
    return this.pullRequestsState()
      .filter((pullRequest) => pullRequest.category === category && !pullRequest.isArchived)
      .sort(comparePullRequests);
  }

  private require(pullRequestId: string): TrackedPullRequest {
    const pullRequest = this.pullRequestsState().find((current) => current.id === pullRequestId);
    if (!pullRequest) {
      throw new UnknownPullRequestError(pullRequestId);
    }
    return pullRequest;
  }
}
