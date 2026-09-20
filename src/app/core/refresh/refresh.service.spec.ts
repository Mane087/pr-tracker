import 'fake-indexeddb/auto';

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../database/database.service';
import { TrackedPullRequest } from '../database/models';
import { GithubApiService } from '../github/github-api.service';
import { GitHubApiError, GitHubRateLimitError } from '../github/github-errors';
import { GithubSessionService } from '../github/github-session.service';
import { TrackedPullRequestsService } from '../pull-requests/tracked-pull-requests.service';
import { remoteStateFromLocal } from './pull-request-sync';
import { RefreshService } from './refresh.service';

function buildPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  const now = new Date('2026-09-18T10:00:00Z');
  return {
    id: 'work:acme/api#1',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 1,
    title: 'PR',
    url: 'https://github.com/acme/api/pull/1',
    author: 'colleague',
    labels: [],
    category: 'REVIEW',
    status: 'REVIEWED',
    priority: 'P2',
    headSha: 'sha-1',
    lastReviewedHeadSha: 'sha-1',
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
    etag: 'W/"v1"',
    reviewsEtag: 'W/"r1"',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function modifiedPullRequest(local: TrackedPullRequest, overrides: Record<string, unknown> = {}) {
  return {
    isModified: true,
    etag: 'W/"v2"',
    data: {
      ...remoteStateFromLocal(local),
      number: local.number,
      isDraft: false,
      commitCount: 1,
      ...overrides,
    },
  };
}

describe('RefreshService', () => {
  const githubApi = { getPullRequest: jest.fn(), getPullRequestReviews: jest.fn() };
  const accounts = signal([
    { id: 'work', name: 'Trabajo', username: 'mane-work', hasToken: true },
    { id: 'personal', name: 'Personal', username: 'mane', hasToken: false },
  ]);
  const sessions = { accounts, hasReadySession: signal(true) };

  let service: RefreshService;
  let trackedPullRequests: TrackedPullRequestsService;
  let database: DatabaseService;

  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: GithubApiService, useValue: githubApi },
        { provide: GithubSessionService, useValue: sessions },
      ],
    });
    service = TestBed.inject(RefreshService);
    trackedPullRequests = TestBed.inject(TrackedPullRequestsService);
    database = TestBed.inject(DatabaseService);
    githubApi.getPullRequestReviews.mockResolvedValue({ isModified: false, etag: 'W/"r1"' });
  });

  afterEach(async () => {
    await database.delete();
  });

  it('sends the stored etags and applies remote changes', async () => {
    const local = buildPullRequest({ id: 'work:acme/api#1' });
    await trackedPullRequests.add(local);
    githubApi.getPullRequest.mockResolvedValue(modifiedPullRequest(local, { headSha: 'sha-2' }));

    const summary = await service.refreshAll();

    expect(githubApi.getPullRequest).toHaveBeenCalledWith('work', 'acme', 'api', 1, 'W/"v1"');
    expect(githubApi.getPullRequestReviews).toHaveBeenCalledWith(
      'work',
      'acme',
      'api',
      1,
      'W/"r1"',
    );
    expect(trackedPullRequests.all()[0]).toMatchObject({
      status: 'NEEDS_REVIEW',
      headSha: 'sha-2',
      etag: 'W/"v2"',
      isAttentionRequired: true,
    });
    expect(summary).toEqual({
      refreshedCount: 1,
      archivedCount: 0,
      attentionCount: 1,
      failedCount: 0,
    });
  });

  it('keeps local data on 304 answers and only records the sync time', async () => {
    const local = buildPullRequest({ id: 'work:acme/api#1' });
    await trackedPullRequests.add(local);
    githubApi.getPullRequest.mockResolvedValue({ isModified: false, etag: 'W/"v1"' });

    await service.refreshAll();

    const synced = trackedPullRequests.all()[0];
    expect(synced).toMatchObject({
      status: 'REVIEWED',
      isAttentionRequired: false,
      updatedAt: local.updatedAt,
    });
    expect(synced.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('archives merged pull requests and counts them', async () => {
    const local = buildPullRequest({ id: 'work:acme/api#1' });
    await trackedPullRequests.add(local);
    githubApi.getPullRequest.mockResolvedValue(
      modifiedPullRequest(local, { isMerged: true, state: 'closed' }),
    );

    const summary = await service.refreshAll();

    expect(trackedPullRequests.review()).toEqual([]);
    expect(summary.archivedCount).toBe(1);
  });

  it('skips archived pull requests and sessions without token', async () => {
    await trackedPullRequests.add(buildPullRequest({ id: 'work:acme/api#1', isArchived: true }));
    await trackedPullRequests.add(
      buildPullRequest({ id: 'personal:me/tool#1', githubSessionId: 'personal' }),
    );

    const summary = await service.refreshAll();

    expect(githubApi.getPullRequest).not.toHaveBeenCalled();
    expect(summary.failedCount).toBe(1);
    expect(service.sessionErrors().get('personal')).toContain('token');
  });

  it('stops a session after a rate limit error and reports it', async () => {
    const first = buildPullRequest({ id: 'work:acme/api#1', number: 1 });
    const second = buildPullRequest({ id: 'work:acme/api#2', number: 2 });
    const third = buildPullRequest({ id: 'work:acme/api#3', number: 3 });
    await trackedPullRequests.add(first);
    await trackedPullRequests.add(second);
    await trackedPullRequests.add(third);
    const resetAt = new Date('2026-09-19T16:00:00Z');
    githubApi.getPullRequest.mockRejectedValue(
      new GitHubRateLimitError(403, '/repos/acme/api/pulls/1', resetAt),
    );

    const summary = await service.refreshAll();

    expect(summary.refreshedCount).toBe(0);
    expect(summary.failedCount).toBe(3);
    expect(service.sessionErrors().get('work')).toContain('límite de peticiones');
  });

  it('continues the session when a single pull request fails with 404', async () => {
    const first = buildPullRequest({ id: 'work:acme/api#1', number: 1 });
    const second = buildPullRequest({ id: 'work:acme/api#2', number: 2 });
    await trackedPullRequests.add(first);
    await trackedPullRequests.add(second);
    githubApi.getPullRequest.mockImplementation(
      async (_s: string, _o: string, _r: string, number: number) => {
        if (number === 1) {
          throw new GitHubApiError(404, '/repos/acme/api/pulls/1', 'No existe.');
        }
        return modifiedPullRequest(second);
      },
    );

    const summary = await service.refreshAll();

    expect(summary).toMatchObject({ refreshedCount: 1, failedCount: 1 });
    expect(service.sessionErrors().size).toBe(0);
  });

  it('persists and restores the last refresh time', async () => {
    githubApi.getPullRequest.mockResolvedValue({ isModified: false });

    await service.refreshAll();
    const stored = await database.settings.get('lastRefreshedAt');
    expect(stored?.value).toBeTruthy();

    service = TestBed.inject(RefreshService);
    await service.initialize();
    expect(service.lastRefreshedAt()).toEqual(new Date(stored?.value as string));
  });

  it('shares a single in-flight refresh between concurrent calls', async () => {
    const local = buildPullRequest({ id: 'work:acme/api#1' });
    await trackedPullRequests.add(local);
    githubApi.getPullRequest.mockResolvedValue(modifiedPullRequest(local));

    const [first, second] = await Promise.all([service.refreshAll(), service.refreshAll()]);

    expect(first).toBe(second);
    expect(githubApi.getPullRequest).toHaveBeenCalledTimes(1);
    expect(service.isRefreshing()).toBe(false);
  });
});
