import { TrackedPullRequest, TrackedPullRequestStatus } from '../database/models';
import { comparePullRequests } from './pull-request-sorting';

export type PullRequestSortKey = 'priority' | 'updated' | 'number';

export interface PullRequestFilters {
  /** Case-insensitive match against title, repository and number. */
  search: string;
  /** Empty string means every status. */
  status: TrackedPullRequestStatus | '';
  /** Empty string means every account. */
  accountId: string;
  isAttentionOnly: boolean;
  sortKey: PullRequestSortKey;
}

export const DEFAULT_PULL_REQUEST_FILTERS: PullRequestFilters = {
  search: '',
  status: '',
  accountId: '',
  isAttentionOnly: false,
  sortKey: 'priority',
};

export function hasActiveFilters(filters: PullRequestFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== '' ||
    filters.accountId !== '' ||
    filters.isAttentionOnly
  );
}

/** Attention required always comes first; the sort key decides the order within each group. */
export function filterAndSortPullRequests(
  pullRequests: readonly TrackedPullRequest[],
  filters: PullRequestFilters,
): TrackedPullRequest[] {
  const search = filters.search.trim().toLowerCase();

  return pullRequests
    .filter((pullRequest) => {
      if (filters.status !== '' && pullRequest.status !== filters.status) {
        return false;
      }
      if (filters.accountId !== '' && pullRequest.githubSessionId !== filters.accountId) {
        return false;
      }
      if (filters.isAttentionOnly && !pullRequest.isAttentionRequired) {
        return false;
      }
      if (search !== '') {
        const haystack =
          `${pullRequest.title} ${pullRequest.owner}/${pullRequest.repository} #${pullRequest.number}`.toLowerCase();
        return haystack.includes(search);
      }
      return true;
    })
    .sort((first, second) => compareBySortKey(first, second, filters.sortKey));
}

function compareBySortKey(
  first: TrackedPullRequest,
  second: TrackedPullRequest,
  sortKey: PullRequestSortKey,
): number {
  const attentionDifference =
    Number(second.isAttentionRequired) - Number(first.isAttentionRequired);
  if (attentionDifference !== 0) {
    return attentionDifference;
  }

  switch (sortKey) {
    case 'updated':
      return second.updatedAt.getTime() - first.updatedAt.getTime();
    case 'number':
      return first.number - second.number;
    case 'priority':
    default:
      return comparePullRequests(first, second);
  }
}
