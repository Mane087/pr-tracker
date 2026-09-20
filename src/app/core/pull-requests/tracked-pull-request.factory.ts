import {
  Priority,
  PullRequestCategory,
  TrackedPullRequest,
  TrackedPullRequestStatus,
} from '../database/models';
import { GitHubPullRequest } from '../github/models';

export interface CreateTrackedPullRequestInput {
  githubSessionId: string;
  owner: string;
  repository: string;
  category: PullRequestCategory;
  status: TrackedPullRequestStatus;
  priority: Priority;
  remote: GitHubPullRequest;
  reviewCount: number;
  etag?: string;
  reviewsEtag?: string;
}

export function buildTrackedPullRequestId(
  githubSessionId: string,
  owner: string,
  repository: string,
  pullNumber: number,
): string {
  return `${githubSessionId}:${owner}/${repository}#${pullNumber}`;
}

/** Builds a tracked record whose acknowledged counters equal the remote ones, so nothing is flagged yet. */
export function createTrackedPullRequest(input: CreateTrackedPullRequestInput): TrackedPullRequest {
  const { remote } = input;
  const now = new Date();

  return {
    id: buildTrackedPullRequestId(
      input.githubSessionId,
      input.owner,
      input.repository,
      remote.number,
    ),
    githubSessionId: input.githubSessionId,
    owner: input.owner,
    repository: input.repository,
    number: remote.number,
    title: remote.title,
    url: remote.url,
    author: remote.author,
    labels: remote.labels,
    category: input.category,
    status: input.status,
    priority: input.priority,
    headSha: remote.headSha,
    issueCommentCount: remote.issueCommentCount,
    reviewCommentCount: remote.reviewCommentCount,
    reviewCount: input.reviewCount,
    commitCount: remote.commitCount,
    lastKnownIssueCommentCount: remote.issueCommentCount,
    lastKnownReviewCommentCount: remote.reviewCommentCount,
    lastKnownReviewCount: input.reviewCount,
    lastKnownCommitCount: remote.commitCount,
    isAttentionRequired: false,
    attentionReasons: [],
    etag: input.etag,
    reviewsEtag: input.reviewsEtag,
    lastSyncedAt: now,
    isArchived: remote.isMerged || remote.state === 'closed',
    createdAt: now,
    updatedAt: now,
  };
}
