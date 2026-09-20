import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../../core/database/database.service';
import { ReviewSnapshot, TrackedPullRequest } from '../../core/database/models';
import { GithubApiService } from '../../core/github/github-api.service';
import { expectModified } from '../../core/github/models';
import {
  buildTrackedPullRequestId,
  createTrackedPullRequest,
} from '../../core/pull-requests/tracked-pull-request.factory';
import {
  DuplicatePullRequestError,
  TrackedPullRequestsService,
} from '../../core/pull-requests/tracked-pull-requests.service';

/** Manual review queue: the user picks which pull requests to follow and records when a version was reviewed. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly database = inject(DatabaseService);
  private readonly githubApi = inject(GithubApiService);
  private readonly trackedPullRequests = inject(TrackedPullRequestsService);

  async addPullRequest(
    githubSessionId: string,
    owner: string,
    repository: string,
    pullNumber: number,
  ): Promise<TrackedPullRequest> {
    const id = buildTrackedPullRequestId(githubSessionId, owner, repository, pullNumber);
    if (this.trackedPullRequests.has(id)) {
      throw new DuplicatePullRequestError(id);
    }

    const [pullRequestResponse, reviewsResponse] = await Promise.all([
      this.githubApi.getPullRequest(githubSessionId, owner, repository, pullNumber),
      this.githubApi.getPullRequestReviews(githubSessionId, owner, repository, pullNumber),
    ]);

    const tracked = createTrackedPullRequest({
      githubSessionId,
      owner,
      repository,
      category: 'REVIEW',
      status: 'PENDING',
      priority: 'P2',
      remote: expectModified(pullRequestResponse),
      reviewCount: expectModified(reviewsResponse).length,
      etag: pullRequestResponse.etag,
      reviewsEtag: reviewsResponse.etag,
    });

    await this.trackedPullRequests.add(tracked);
    return tracked;
  }

  /** Stores a snapshot of the reviewed version and acknowledges all current activity. */
  async markAsReviewed(pullRequestId: string): Promise<void> {
    const pullRequest = this.trackedPullRequests
      .all()
      .find((candidate) => candidate.id === pullRequestId);
    if (!pullRequest) {
      throw new Error('El Pull Request no está en la lista de seguimiento.');
    }

    const snapshot: ReviewSnapshot = {
      pullRequestId,
      reviewedAt: new Date(),
      headSha: pullRequest.headSha,
      issueCommentCount: pullRequest.issueCommentCount,
      reviewCommentCount: pullRequest.reviewCommentCount,
      reviewCount: pullRequest.reviewCount,
    };
    await this.database.reviewSnapshots.add(snapshot);

    await this.trackedPullRequests.update(pullRequestId, {
      status: 'REVIEWED',
      lastReviewedHeadSha: pullRequest.headSha,
      lastKnownIssueCommentCount: pullRequest.issueCommentCount,
      lastKnownReviewCommentCount: pullRequest.reviewCommentCount,
      lastKnownReviewCount: pullRequest.reviewCount,
      lastKnownCommitCount: pullRequest.commitCount,
      isAttentionRequired: false,
      attentionReasons: [],
    });
  }
}
