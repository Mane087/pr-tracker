import { TrackedPullRequest } from '../database/models';
import { RemotePullRequestState, remoteStateFromLocal, syncPullRequest } from './pull-request-sync';

const NOW = new Date('2026-09-19T15:00:00Z');
const BEFORE = new Date('2026-09-18T10:00:00Z');

function buildLocal(overrides: Partial<TrackedPullRequest> = {}): TrackedPullRequest {
  return {
    id: 'work:acme/api#561',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 561,
    title: 'Detect expired certificate',
    url: 'https://github.com/acme/api/pull/561',
    author: 'colleague',
    labels: [{ name: 'bug', color: 'd73a4a' }],
    category: 'REVIEW',
    status: 'REVIEWED',
    priority: 'P2',
    headSha: 'sha-1',
    lastReviewedHeadSha: 'sha-1',
    issueCommentCount: 1,
    reviewCommentCount: 1,
    reviewCount: 1,
    commitCount: 0,
    lastKnownIssueCommentCount: 1,
    lastKnownReviewCommentCount: 1,
    lastKnownReviewCount: 1,
    lastKnownCommitCount: 0,
    isAttentionRequired: false,
    attentionReasons: [],
    etag: 'W/"v1"',
    isArchived: false,
    createdAt: BEFORE,
    updatedAt: BEFORE,
    ...overrides,
  };
}

function buildRemote(
  local: TrackedPullRequest,
  overrides: Partial<RemotePullRequestState> = {},
): RemotePullRequestState {
  return { ...remoteStateFromLocal(local), ...overrides };
}

describe('syncPullRequest', () => {
  it('keeps a REVIEWED pull request untouched when nothing changed', () => {
    const local = buildLocal();

    const synced = syncPullRequest({ local, remote: buildRemote(local), reviewCount: 1, now: NOW });

    expect(synced).toMatchObject({
      status: 'REVIEWED',
      isAttentionRequired: false,
      attentionReasons: [],
    });
    expect(synced.updatedAt).toEqual(BEFORE);
    expect(synced.lastSyncedAt).toEqual(NOW);
  });

  it('moves REVIEWED to NEEDS_REVIEW when the head sha differs from the reviewed one', () => {
    const local = buildLocal();

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { headSha: 'sha-2' }),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced).toMatchObject({
      status: 'NEEDS_REVIEW',
      headSha: 'sha-2',
      isAttentionRequired: true,
      attentionReasons: ['NEW_COMMITS'],
      updatedAt: NOW,
    });
  });

  it('reports how many commits arrived since the last acknowledgement', () => {
    const local = buildLocal({ commitCount: 3, lastKnownCommitCount: 3 });

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { headSha: 'sha-2', commitCount: 5 }),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced).toMatchObject({
      commitCount: 5,
      lastKnownCommitCount: 3,
      attentionReasons: ['NEW_COMMITS'],
    });
  });

  it('flags new commits on a PENDING review without changing its status', () => {
    const local = buildLocal({ status: 'PENDING', lastReviewedHeadSha: undefined });

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { headSha: 'sha-2' }),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced).toMatchObject({ status: 'PENDING', attentionReasons: ['NEW_COMMITS'] });
  });

  it('does not flag new commits on the user’s own Work pull requests', () => {
    const local = buildLocal({
      category: 'WORK',
      status: 'CURRENT',
      lastReviewedHeadSha: undefined,
    });

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { headSha: 'sha-2' }),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced).toMatchObject({
      status: 'CURRENT',
      headSha: 'sha-2',
      isAttentionRequired: false,
    });
  });

  it('flags new comments and keeps REVIEWED when only the conversation grew', () => {
    const local = buildLocal();

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { issueCommentCount: 3 }),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced).toMatchObject({
      status: 'REVIEWED',
      issueCommentCount: 3,
      isAttentionRequired: true,
      attentionReasons: ['NEW_COMMENTS'],
    });
  });

  it('flags new reviews on Work pull requests', () => {
    const local = buildLocal({
      category: 'WORK',
      status: 'PAUSED',
      lastReviewedHeadSha: undefined,
    });

    const synced = syncPullRequest({ local, remote: buildRemote(local), reviewCount: 2, now: NOW });

    expect(synced).toMatchObject({ reviewCount: 2, attentionReasons: ['NEW_REVIEWS'] });
  });

  it('accumulates reasons across refreshes without duplicates', () => {
    const local = buildLocal({
      isAttentionRequired: true,
      attentionReasons: ['NEW_COMMENTS'],
      issueCommentCount: 3,
    });

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { headSha: 'sha-2', issueCommentCount: 3 }),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced.attentionReasons).toEqual(['NEW_COMMENTS', 'NEW_COMMITS']);
  });

  it.each([
    ['merged', { isMerged: true, state: 'closed' as const }],
    ['closed', { isMerged: false, state: 'closed' as const }],
  ])('archives a %s pull request', (_label, remoteOverrides) => {
    const local = buildLocal();

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, remoteOverrides),
      reviewCount: 1,
      now: NOW,
    });

    expect(synced.isArchived).toBe(true);
  });

  it('refreshes title, labels and etags', () => {
    const local = buildLocal();

    const synced = syncPullRequest({
      local,
      remote: buildRemote(local, { title: 'Renamed', labels: [] }),
      reviewCount: 1,
      etag: 'W/"v2"',
      reviewsEtag: 'W/"r1"',
      now: NOW,
    });

    expect(synced).toMatchObject({
      title: 'Renamed',
      labels: [],
      etag: 'W/"v2"',
      reviewsEtag: 'W/"r1"',
      updatedAt: NOW,
    });
  });

  it('keeps the previous etags when the response was not modified', () => {
    const local = buildLocal({ reviewsEtag: 'W/"r0"' });

    const synced = syncPullRequest({ local, remote: buildRemote(local), reviewCount: 1, now: NOW });

    expect(synced).toMatchObject({ etag: 'W/"v1"', reviewsEtag: 'W/"r0"' });
  });
});
