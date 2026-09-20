import 'fake-indexeddb/auto';

import { DatabaseService } from './database.service';
import { TrackedPullRequest } from './models';

function buildTrackedPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  const now = new Date('2026-09-19T12:00:00Z');
  return {
    id: 'work:acme/api#501',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 501,
    title: 'Fix token manager',
    url: 'https://github.com/acme/api/pull/501',
    author: 'someone',
    labels: [],
    category: 'WORK',
    status: 'CURRENT',
    priority: 'P3',
    headSha: 'abc123',
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

describe('DatabaseService', () => {
  let database: DatabaseService;

  beforeEach(() => {
    database = new DatabaseService();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('defines the tables of the current schema', async () => {
    await database.open();

    const tableNames = database.tables.map((table) => table.name).sort();

    expect(tableNames).toEqual([
      'githubAccounts',
      'reviewSnapshots',
      'settings',
      'trackedPullRequests',
      'watchedRepositories',
    ]);
  });

  it('persists account metadata without any token field', async () => {
    await database.githubAccounts.put({ id: 'work', name: 'Trabajo', username: 'mane-work' });

    const account = await database.githubAccounts.get('work');

    expect(account).toEqual({ id: 'work', name: 'Trabajo', username: 'mane-work' });
    expect(account).not.toHaveProperty('token');
  });

  it('queries tracked pull requests by session', async () => {
    await database.trackedPullRequests.bulkPut([
      buildTrackedPullRequest({ id: 'work:acme/api#501', githubSessionId: 'work', number: 501 }),
      buildTrackedPullRequest({ id: 'work:acme/api#503', githubSessionId: 'work', number: 503 }),
      buildTrackedPullRequest({
        id: 'personal:me/tool#15',
        githubSessionId: 'personal',
        number: 15,
      }),
    ]);

    const workPullRequests = await database.trackedPullRequests
      .where('githubSessionId')
      .equals('work')
      .toArray();

    expect(workPullRequests.map((pullRequest) => pullRequest.number)).toEqual([501, 503]);
  });

  it('auto-increments review snapshot ids', async () => {
    const snapshotId = await database.reviewSnapshots.add({
      pullRequestId: 'work:acme/api#501',
      reviewedAt: new Date('2026-09-19T12:00:00Z'),
      headSha: 'abc123',
      issueCommentCount: 1,
      reviewCommentCount: 2,
      reviewCount: 3,
    });

    expect(snapshotId).toBe(1);
  });
});
