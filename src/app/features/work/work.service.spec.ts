import 'fake-indexeddb/auto';

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../../core/database/database.service';
import { GithubApiService } from '../../core/github/github-api.service';
import { UnknownAccountError } from '../../core/github/github-errors';
import { GithubSessionService } from '../../core/github/github-session.service';
import { GitHubPullRequest, GitHubPullRequestSummary } from '../../core/github/models';
import { TrackedPullRequestsService } from '../../core/pull-requests/tracked-pull-requests.service';
import { WatchedRepositoriesService } from '../../core/repositories/watched-repositories.service';
import { WorkService } from './work.service';

function buildSummary(overrides: Partial<GitHubPullRequestSummary>): GitHubPullRequestSummary {
  return {
    number: 1,
    title: 'PR',
    url: 'https://github.com/acme/api/pull/1',
    author: 'mane-work',
    labels: [],
    state: 'open',
    isDraft: false,
    isMerged: false,
    headSha: 'abc',
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-18T10:00:00Z'),
    ...overrides,
  };
}

function buildPullRequest(summary: GitHubPullRequestSummary): GitHubPullRequest {
  return { ...summary, issueCommentCount: 2, reviewCommentCount: 1, commitCount: 3 };
}

describe('WorkService', () => {
  const githubApi = {
    getOpenPullRequests: jest.fn(),
    getPullRequest: jest.fn(),
    getPullRequestReviews: jest.fn(),
  };
  const sessions = {
    accounts: signal([{ id: 'work', name: 'Trabajo', username: 'mane-work', hasToken: true }]),
  };

  let service: WorkService;
  let trackedPullRequests: TrackedPullRequestsService;
  let watchedRepositories: WatchedRepositoriesService;

  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: GithubApiService, useValue: githubApi },
        { provide: GithubSessionService, useValue: sessions },
      ],
    });
    service = TestBed.inject(WorkService);
    trackedPullRequests = TestBed.inject(TrackedPullRequestsService);
    watchedRepositories = TestBed.inject(WatchedRepositoriesService);

    githubApi.getPullRequest.mockImplementation(
      async (_session: string, _owner: string, _repo: string, number: number) => ({
        isModified: true,
        etag: `W/"pr-${number}"`,
        data: buildPullRequest(buildSummary({ number })),
      }),
    );
    githubApi.getPullRequestReviews.mockResolvedValue({ isModified: true, data: [{ id: 1 }] });
  });

  afterEach(async () => {
    await TestBed.inject(DatabaseService).delete();
  });

  it('rejects unknown accounts', async () => {
    await expect(service.importOpenPullRequests('missing')).rejects.toBeInstanceOf(
      UnknownAccountError,
    );
  });

  it('imports only the open pull requests authored by the account, with baseline counters', async () => {
    await watchedRepositories.add('work', {
      id: 1,
      owner: 'acme',
      name: 'api',
      fullName: 'acme/api',
      url: '',
      isPrivate: true,
      updatedAt: new Date(),
    });
    githubApi.getOpenPullRequests.mockResolvedValue([
      buildSummary({ number: 1, author: 'mane-work' }),
      buildSummary({ number: 2, author: 'someone-else' }),
    ]);

    const result = await service.importOpenPullRequests('work');

    expect(result).toEqual({ importedCount: 1, repositoryCount: 1 });
    expect(githubApi.getOpenPullRequests).toHaveBeenCalledWith('work', 'acme', 'api');
    expect(githubApi.getPullRequest).toHaveBeenCalledTimes(1);
    expect(trackedPullRequests.work()).toEqual([
      expect.objectContaining({
        id: 'work:acme/api#1',
        category: 'WORK',
        status: 'PAUSED',
        priority: 'P2',
        issueCommentCount: 2,
        lastKnownIssueCommentCount: 2,
        reviewCount: 1,
        lastKnownReviewCount: 1,
        commitCount: 3,
        lastKnownCommitCount: 3,
        etag: 'W/"pr-1"',
      }),
    ]);
  });

  it('skips pull requests that are already tracked', async () => {
    await watchedRepositories.add('work', {
      id: 1,
      owner: 'acme',
      name: 'api',
      fullName: 'acme/api',
      url: '',
      isPrivate: true,
      updatedAt: new Date(),
    });
    githubApi.getOpenPullRequests.mockResolvedValue([buildSummary({ number: 1 })]);
    await service.importOpenPullRequests('work');
    await trackedPullRequests.setStatus('work:acme/api#1', 'CURRENT');
    githubApi.getPullRequest.mockClear();

    const result = await service.importOpenPullRequests('work');

    expect(result.importedCount).toBe(0);
    expect(githubApi.getPullRequest).not.toHaveBeenCalled();
    expect(trackedPullRequests.work()[0].status).toBe('CURRENT');
  });

  it('does nothing when the account has no watched repositories', async () => {
    const result = await service.importOpenPullRequests('work');

    expect(result).toEqual({ importedCount: 0, repositoryCount: 0 });
    expect(githubApi.getOpenPullRequests).not.toHaveBeenCalled();
  });
});
