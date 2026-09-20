import { Priority, TrackedPullRequest } from '../database/models';

const PRIORITY_RANK: Record<Priority, number> = { P3: 3, P2: 2, P1: 1, P0: 0 };

/** Attention required first, then priority (P3 highest), then most recently updated. */
export function comparePullRequests(first: TrackedPullRequest, second: TrackedPullRequest): number {
  const attentionDifference =
    Number(second.isAttentionRequired) - Number(first.isAttentionRequired);
  if (attentionDifference !== 0) {
    return attentionDifference;
  }

  const priorityDifference = PRIORITY_RANK[second.priority] - PRIORITY_RANK[first.priority];
  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return second.updatedAt.getTime() - first.updatedAt.getTime();
}
