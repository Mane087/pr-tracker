import { TrackedPullRequest } from '../database/models';
import {
  DEFAULT_PULL_REQUEST_FILTERS,
  filterAndSortPullRequests,
  hasActiveFilters,
} from './pull-request-filtering';

function buildPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  const now = new Date('2026-09-19T12:00:00Z');
  return {
    id: 'work:acme/api#1',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 1,
    title: 'PR',
    url: '',
    author: 'someone',
    labels: [],
    category: 'WORK',
    status: 'PAUSED',
    priority: 'P2',
    headSha: 'abc',
    issueCommentCount: 0,
    reviewCommentCount: 0,
    reviewCount: 0,
    commitCount: 0,
    lastKnownIssueCommentCount: 0,
    lastKnownReviewCommentCount: 0,
    lastKnownReviewCount: 0,
    lastKnownCommitCount: 0,
    isAttentionRequired: false,
    attentionReasons: [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const pullRequests = [
  buildPullRequest({
    id: 'a',
    number: 10,
    title: 'Fix token manager',
    priority: 'P1',
    updatedAt: new Date('2026-09-10'),
  }),
  buildPullRequest({
    id: 'b',
    number: 5,
    title: 'Improve retry',
    priority: 'P3',
    status: 'CURRENT',
    updatedAt: new Date('2026-09-01'),
  }),
  buildPullRequest({
    id: 'c',
    number: 7,
    title: 'Docs',
    githubSessionId: 'personal',
    repository: 'tool',
    priority: 'P0',
    isAttentionRequired: true,
    updatedAt: new Date('2026-09-05'),
  }),
];

const ids = (list: TrackedPullRequest[]) => list.map((pullRequest) => pullRequest.id);

describe('filterAndSortPullRequests', () => {
  it('keeps the default order: attention, priority, update', () => {
    expect(ids(filterAndSortPullRequests(pullRequests, DEFAULT_PULL_REQUEST_FILTERS))).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('sorts by last update after attention', () => {
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          sortKey: 'updated',
        }),
      ),
    ).toEqual(['c', 'a', 'b']);
  });

  it('sorts by number after attention', () => {
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          sortKey: 'number',
        }),
      ),
    ).toEqual(['c', 'b', 'a']);
  });

  it('filters by status, account and attention', () => {
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          status: 'CURRENT',
        }),
      ),
    ).toEqual(['b']);
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          accountId: 'personal',
        }),
      ),
    ).toEqual(['c']);
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          isAttentionOnly: true,
        }),
      ),
    ).toEqual(['c']);
  });

  it('searches title, repository and number ignoring case', () => {
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          search: 'TOKEN',
        }),
      ),
    ).toEqual(['a']);
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, {
          ...DEFAULT_PULL_REQUEST_FILTERS,
          search: 'acme/tool',
        }),
      ),
    ).toEqual(['c']);
    expect(
      ids(
        filterAndSortPullRequests(pullRequests, { ...DEFAULT_PULL_REQUEST_FILTERS, search: '#5' }),
      ),
    ).toEqual(['b']);
  });

  it('reports whether any filter is active', () => {
    expect(hasActiveFilters(DEFAULT_PULL_REQUEST_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_PULL_REQUEST_FILTERS, sortKey: 'number' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_PULL_REQUEST_FILTERS, search: ' x ' })).toBe(true);
  });
});
