export type PullRequestCategory = 'WORK' | 'REVIEW';

export type WorkStatus = 'CURRENT' | 'PAUSED' | 'POSTPONED';

export type ReviewStatus = 'PENDING' | 'REVIEWING' | 'REVIEWED' | 'NEEDS_REVIEW';

export type TrackedPullRequestStatus = WorkStatus | ReviewStatus;

/** P3 is the highest priority and P0 the lowest. */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type AttentionReason = 'NEW_COMMITS' | 'NEW_COMMENTS' | 'NEW_REVIEWS';

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface TrackedPullRequest {
  /** Stable key: `${githubSessionId}:${owner}/${repository}#${number}`. */
  id: string;
  githubSessionId: string;
  owner: string;
  repository: string;
  number: number;
  title: string;
  url: string;
  author: string;
  labels: GitHubLabel[];
  category: PullRequestCategory;
  status: TrackedPullRequestStatus;
  priority: Priority;
  headSha: string;
  lastReviewedHeadSha?: string;
  issueCommentCount: number;
  reviewCommentCount: number;
  reviewCount: number;
  commitCount: number;
  lastKnownIssueCommentCount: number;
  lastKnownReviewCommentCount: number;
  lastKnownReviewCount: number;
  lastKnownCommitCount: number;
  isAttentionRequired: boolean;
  attentionReasons: AttentionReason[];
  /** ETag of the last pull request response, sent as If-None-Match on refresh. */
  etag?: string;
  /** ETag of the last reviews response. */
  reviewsEtag?: string;
  lastSyncedAt?: Date;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
