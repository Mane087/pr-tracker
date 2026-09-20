import { AttentionReason, GitHubLabel, TrackedPullRequest } from '../database/models';
import { GitHubPullRequestState } from '../github/models';

/** Remote fields compared during a refresh. Built from the API response, or from the local record on a 304. */
export interface RemotePullRequestState {
  title: string;
  url: string;
  author: string;
  labels: GitHubLabel[];
  headSha: string;
  state: GitHubPullRequestState;
  isMerged: boolean;
  issueCommentCount: number;
  reviewCommentCount: number;
  commitCount: number;
}

export interface SyncPullRequestInput {
  local: TrackedPullRequest;
  remote: RemotePullRequestState;
  reviewCount: number;
  etag?: string;
  reviewsEtag?: string;
  now: Date;
}

export function remoteStateFromLocal(local: TrackedPullRequest): RemotePullRequestState {
  return {
    title: local.title,
    url: local.url,
    author: local.author,
    labels: local.labels,
    headSha: local.headSha,
    state: 'open',
    isMerged: false,
    issueCommentCount: local.issueCommentCount,
    reviewCommentCount: local.reviewCommentCount,
    commitCount: local.commitCount,
  };
}

/**
 * Applies the remote state to a tracked pull request (plan, sections 19 to 21 and 40).
 *
 * - Review: a new head SHA flags `NEW_COMMITS`; a `REVIEWED` pull request whose head differs from the
 *   reviewed SHA becomes `NEEDS_REVIEW`.
 * - Work: new commits are the user's own and are not flagged.
 * - Both: more comments or reviews than acknowledged flag `NEW_COMMENTS` / `NEW_REVIEWS`; merged or
 *   closed pull requests are archived. Reasons accumulate until the user acknowledges them.
 *
 * `updatedAt` only moves when something observable changed, so a quiet refresh does not reorder the list.
 */
export function syncPullRequest(input: SyncPullRequestInput): TrackedPullRequest {
  const { local, remote, reviewCount, now } = input;
  const reasons = new Set<AttentionReason>(local.attentionReasons);
  let status = local.status;

  if (local.category === 'REVIEW' && remote.headSha !== local.headSha) {
    reasons.add('NEW_COMMITS');
  }

  if (
    local.category === 'REVIEW' &&
    local.status === 'REVIEWED' &&
    local.lastReviewedHeadSha !== undefined &&
    remote.headSha !== local.lastReviewedHeadSha
  ) {
    status = 'NEEDS_REVIEW';
    reasons.add('NEW_COMMITS');
  }

  const remoteCommentCount = remote.issueCommentCount + remote.reviewCommentCount;
  const knownCommentCount = local.lastKnownIssueCommentCount + local.lastKnownReviewCommentCount;
  if (remoteCommentCount > knownCommentCount) {
    reasons.add('NEW_COMMENTS');
  }

  if (reviewCount > local.lastKnownReviewCount) {
    reasons.add('NEW_REVIEWS');
  }

  const next: TrackedPullRequest = {
    ...local,
    title: remote.title,
    url: remote.url,
    author: remote.author,
    labels: remote.labels,
    headSha: remote.headSha,
    issueCommentCount: remote.issueCommentCount,
    reviewCommentCount: remote.reviewCommentCount,
    commitCount: remote.commitCount,
    reviewCount,
    status,
    isArchived: local.isArchived || remote.isMerged || remote.state === 'closed',
    attentionReasons: [...reasons],
    isAttentionRequired: reasons.size > 0,
    etag: input.etag ?? local.etag,
    reviewsEtag: input.reviewsEtag ?? local.reviewsEtag,
    lastSyncedAt: now,
  };

  return { ...next, updatedAt: hasObservableChanges(local, next) ? now : local.updatedAt };
}

function hasObservableChanges(local: TrackedPullRequest, next: TrackedPullRequest): boolean {
  return (
    local.title !== next.title ||
    local.url !== next.url ||
    local.author !== next.author ||
    local.headSha !== next.headSha ||
    local.issueCommentCount !== next.issueCommentCount ||
    local.reviewCommentCount !== next.reviewCommentCount ||
    local.reviewCount !== next.reviewCount ||
    local.commitCount !== next.commitCount ||
    local.status !== next.status ||
    local.isArchived !== next.isArchived ||
    local.isAttentionRequired !== next.isAttentionRequired ||
    local.attentionReasons.length !== next.attentionReasons.length ||
    JSON.stringify(local.labels) !== JSON.stringify(next.labels)
  );
}
