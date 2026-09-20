import { inject, Injectable } from '@angular/core';

import { GithubApiService } from '../../core/github/github-api.service';
import { UnknownAccountError } from '../../core/github/github-errors';
import { GithubSessionService } from '../../core/github/github-session.service';
import { expectModified, GitHubPullRequestSummary } from '../../core/github/models';
import {
  buildTrackedPullRequestId,
  createTrackedPullRequest,
} from '../../core/pull-requests/tracked-pull-request.factory';
import { TrackedPullRequestsService } from '../../core/pull-requests/tracked-pull-requests.service';
import { WatchedRepositoriesService } from '../../core/repositories/watched-repositories.service';
import { mapWithConcurrency } from '../../shared/utils/map-with-concurrency';

const IMPORT_CONCURRENCY = 4;

export interface ImportResult {
  importedCount: number;
  repositoryCount: number;
}

/** Imports the open pull requests authored by an account from its watched repositories. */
@Injectable({ providedIn: 'root' })
export class WorkService {
  private readonly githubApi = inject(GithubApiService);
  private readonly sessions = inject(GithubSessionService);
  private readonly trackedPullRequests = inject(TrackedPullRequestsService);
  private readonly watchedRepositories = inject(WatchedRepositoriesService);

  async importOpenPullRequests(githubSessionId: string): Promise<ImportResult> {
    const account = this.sessions.accounts().find((candidate) => candidate.id === githubSessionId);
    if (!account) {
      throw new UnknownAccountError(githubSessionId);
    }

    const repositories = this.watchedRepositories.forSession(githubSessionId);
    let importedCount = 0;

    for (const repository of repositories) {
      const openPullRequests = await this.githubApi.getOpenPullRequests(
        githubSessionId,
        repository.owner,
        repository.name,
      );
      const newOwnPullRequests = openPullRequests.filter(
        (pullRequest) =>
          pullRequest.author === account.username &&
          !this.trackedPullRequests.has(
            buildTrackedPullRequestId(
              githubSessionId,
              repository.owner,
              repository.name,
              pullRequest.number,
            ),
          ),
      );

      await mapWithConcurrency(newOwnPullRequests, IMPORT_CONCURRENCY, (summary) =>
        this.importPullRequest(githubSessionId, repository.owner, repository.name, summary),
      );
      importedCount += newOwnPullRequests.length;
    }

    return { importedCount, repositoryCount: repositories.length };
  }

  /** The list endpoint has no counters, so the full pull request and its reviews are fetched as baseline. */
  private async importPullRequest(
    githubSessionId: string,
    owner: string,
    repository: string,
    summary: GitHubPullRequestSummary,
  ): Promise<void> {
    const [pullRequestResponse, reviewsResponse] = await Promise.all([
      this.githubApi.getPullRequest(githubSessionId, owner, repository, summary.number),
      this.githubApi.getPullRequestReviews(githubSessionId, owner, repository, summary.number),
    ]);

    await this.trackedPullRequests.add(
      createTrackedPullRequest({
        githubSessionId,
        owner,
        repository,
        category: 'WORK',
        status: 'PAUSED',
        priority: 'P2',
        remote: expectModified(pullRequestResponse),
        reviewCount: expectModified(reviewsResponse).length,
        etag: pullRequestResponse.etag,
        reviewsEtag: reviewsResponse.etag,
      }),
    );
  }
}
