import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../database/database.service';
import { TrackedPullRequest } from '../database/models';
import {
  TrackedPullRequestsService,
  UnknownPullRequestError,
} from './tracked-pull-requests.service';

function buildPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  const now = new Date('2026-09-19T12:00:00Z');
  return {
    id: 'work:acme/api#1',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 1,
    title: 'PR',
    url: 'https://github.com/acme/api/pull/1',
    author: 'mane-work',
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

describe('TrackedPullRequestsService', () => {
  let service: TrackedPullRequestsService;
  let database: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrackedPullRequestsService);
    database = TestBed.inject(DatabaseService);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('loads persisted pull requests', async () => {
    await database.trackedPullRequests.put(buildPullRequest({ id: 'work:acme/api#1' }));

    await service.load();

    expect(service.all()).toHaveLength(1);
  });

  it('separates work and review queues and hides archived records', async () => {
    await service.add(buildPullRequest({ id: 'work:acme/api#1', category: 'WORK' }));
    await service.add(
      buildPullRequest({ id: 'work:acme/api#2', category: 'REVIEW', status: 'PENDING' }),
    );
    await service.add(
      buildPullRequest({ id: 'work:acme/api#3', category: 'WORK', isArchived: true }),
    );

    expect(service.work().map((pullRequest) => pullRequest.id)).toEqual(['work:acme/api#1']);
    expect(service.review().map((pullRequest) => pullRequest.id)).toEqual(['work:acme/api#2']);
  });

  it('sorts by attention, then priority, then most recent update', async () => {
    await service.add(
      buildPullRequest({ id: 'a', priority: 'P3', updatedAt: new Date('2026-09-01') }),
    );
    await service.add(buildPullRequest({ id: 'b', priority: 'P1', isAttentionRequired: true }));
    await service.add(
      buildPullRequest({ id: 'c', priority: 'P3', updatedAt: new Date('2026-09-10') }),
    );
    await service.add(buildPullRequest({ id: 'd', priority: 'P0' }));

    expect(service.work().map((pullRequest) => pullRequest.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('persists status changes', async () => {
    await service.add(buildPullRequest({ id: 'work:acme/api#1' }));

    await service.setStatus('work:acme/api#1', 'POSTPONED');

    expect(service.all()[0].status).toBe('POSTPONED');
    await expect(database.trackedPullRequests.get('work:acme/api#1')).resolves.toMatchObject({
      status: 'POSTPONED',
    });
  });

  it('pauses the previous CURRENT of the same session when another becomes CURRENT', async () => {
    await service.add(buildPullRequest({ id: 'work:acme/api#1', status: 'CURRENT' }));
    await service.add(buildPullRequest({ id: 'work:acme/api#2', status: 'PAUSED' }));
    await service.add(
      buildPullRequest({
        id: 'personal:me/tool#1',
        githubSessionId: 'personal',
        status: 'CURRENT',
      }),
    );

    await service.setStatus('work:acme/api#2', 'CURRENT');

    const statusById = Object.fromEntries(
      service.all().map((pullRequest) => [pullRequest.id, pullRequest.status]),
    );
    expect(statusById).toEqual({
      'work:acme/api#1': 'PAUSED',
      'work:acme/api#2': 'CURRENT',
      'personal:me/tool#1': 'CURRENT',
    });
  });

  it('persists priority changes', async () => {
    await service.add(buildPullRequest({ id: 'work:acme/api#1', priority: 'P0' }));

    await service.setPriority('work:acme/api#1', 'P3');

    await expect(database.trackedPullRequests.get('work:acme/api#1')).resolves.toMatchObject({
      priority: 'P3',
    });
  });

  it('acknowledges pending attention without changing the status', async () => {
    await service.add(
      buildPullRequest({
        id: 'work:acme/api#1',
        category: 'REVIEW',
        status: 'NEEDS_REVIEW',
        issueCommentCount: 4,
        reviewCount: 2,
        isAttentionRequired: true,
        attentionReasons: ['NEW_COMMITS', 'NEW_COMMENTS'],
      }),
    );

    await service.acknowledge('work:acme/api#1');

    expect(service.all()[0]).toMatchObject({
      status: 'NEEDS_REVIEW',
      commitCount: 0,
      lastKnownIssueCommentCount: 4,
      lastKnownReviewCount: 2,
      lastKnownCommitCount: 0,
      isAttentionRequired: false,
      attentionReasons: [],
    });
  });

  it('replaces a record without bumping updatedAt', async () => {
    const original = buildPullRequest({ id: 'work:acme/api#1', title: 'Old' });
    await service.add(original);

    await service.replace({ ...original, title: 'New' });

    expect(service.all()[0]).toMatchObject({ title: 'New', updatedAt: original.updatedAt });
    await expect(database.trackedPullRequests.get('work:acme/api#1')).resolves.toMatchObject({
      title: 'New',
    });
  });

  it('rejects updates to unknown pull requests', async () => {
    await expect(service.setPriority('missing', 'P3')).rejects.toBeInstanceOf(
      UnknownPullRequestError,
    );
  });
});
