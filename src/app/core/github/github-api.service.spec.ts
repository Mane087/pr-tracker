import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GITHUB_API_BASE_URL } from './github-api.constants';
import { GitHubApiError, GitHubRateLimitError } from './github-errors';
import { GithubApiService } from './github-api.service';

const PULL_REQUEST_URL = `${GITHUB_API_BASE_URL}/repos/acme/api/pulls/501`;

function buildPullRequestResponse(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number: 501,
    title: 'Fix token manager',
    html_url: 'https://github.com/acme/api/pull/501',
    state: 'open',
    draft: false,
    merged: false,
    merged_at: null,
    comments: 2,
    review_comments: 3,
    commits: 4,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-18T10:00:00Z',
    user: { login: 'mane-work' },
    labels: [{ name: 'bug', color: 'd73a4a' }],
    head: { sha: 'abc123' },
    ...overrides,
  };
}

describe('GithubApiService', () => {
  let service: GithubApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GithubApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  describe('getCurrentUser', () => {
    it('maps the current user response', async () => {
      const pendingUser = service.getCurrentUser('work');
      httpTesting.expectOne(`${GITHUB_API_BASE_URL}/user`).flush({
        login: 'mane',
        name: 'Mane',
        avatar_url: 'https://avatars.githubusercontent.com/u/7',
      });

      await expect(pendingUser).resolves.toEqual({
        login: 'mane',
        name: 'Mane',
        avatarUrl: 'https://avatars.githubusercontent.com/u/7',
      });
    });
  });

  describe('getUserRepositories', () => {
    it('requests one page of repositories and maps them', async () => {
      const pendingRepositories = service.getUserRepositories('work');
      const request = httpTesting.expectOne(
        (candidate) => candidate.url === `${GITHUB_API_BASE_URL}/user/repos`,
      );
      expect(request.request.params.get('per_page')).toBe('100');
      request.flush([
        {
          id: 1,
          name: 'api',
          full_name: 'acme/api',
          html_url: 'https://github.com/acme/api',
          private: true,
          updated_at: '2026-09-18T10:00:00Z',
          owner: { login: 'acme' },
        },
      ]);

      await expect(pendingRepositories).resolves.toEqual([
        {
          id: 1,
          owner: 'acme',
          name: 'api',
          fullName: 'acme/api',
          url: 'https://github.com/acme/api',
          isPrivate: true,
          updatedAt: new Date('2026-09-18T10:00:00Z'),
        },
      ]);
    });
  });

  describe('getOpenPullRequests', () => {
    it('lists open pull requests without counters and derives merged from merged_at', async () => {
      const pendingPullRequests = service.getOpenPullRequests('work', 'acme', 'api');
      const request = httpTesting.expectOne(
        (candidate) => candidate.url === `${GITHUB_API_BASE_URL}/repos/acme/api/pulls`,
      );
      expect(request.request.params.get('state')).toBe('open');
      request.flush([
        {
          number: 7,
          title: 'Improve retry logic',
          html_url: 'https://github.com/acme/api/pull/7',
          state: 'open',
          merged_at: null,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-18T10:00:00Z',
          user: null,
          labels: [],
          head: { sha: 'def456' },
        },
      ]);

      await expect(pendingPullRequests).resolves.toEqual([
        {
          number: 7,
          title: 'Improve retry logic',
          url: 'https://github.com/acme/api/pull/7',
          author: 'ghost',
          labels: [],
          state: 'open',
          isDraft: false,
          isMerged: false,
          headSha: 'def456',
          createdAt: new Date('2026-09-01T10:00:00Z'),
          updatedAt: new Date('2026-09-18T10:00:00Z'),
        },
      ]);
    });
  });

  describe('getPullRequest', () => {
    it('maps counters, head sha and the etag of the response', async () => {
      const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501);
      httpTesting
        .expectOne(PULL_REQUEST_URL)
        .flush(buildPullRequestResponse(), { headers: { etag: 'W/"v1"' } });

      await expect(pendingPullRequest).resolves.toEqual({
        isModified: true,
        etag: 'W/"v1"',
        data: {
          number: 501,
          title: 'Fix token manager',
          url: 'https://github.com/acme/api/pull/501',
          author: 'mane-work',
          labels: [{ name: 'bug', color: 'd73a4a' }],
          state: 'open',
          isDraft: false,
          isMerged: false,
          headSha: 'abc123',
          issueCommentCount: 2,
          reviewCommentCount: 3,
          commitCount: 4,
          createdAt: new Date('2026-09-01T10:00:00Z'),
          updatedAt: new Date('2026-09-18T10:00:00Z'),
        },
      });
    });

    it('sends If-None-Match and reports a 304 as not modified', async () => {
      const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501, 'W/"v1"');
      const request = httpTesting.expectOne(PULL_REQUEST_URL);
      expect(request.request.headers.get('If-None-Match')).toBe('W/"v1"');
      request.flush(null, { status: 304, statusText: 'Not Modified', headers: { etag: 'W/"v1"' } });

      await expect(pendingPullRequest).resolves.toEqual({ isModified: false, etag: 'W/"v1"' });
    });

    it('uses the merged flag of the single pull request endpoint', async () => {
      const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501);
      httpTesting.expectOne(PULL_REQUEST_URL).flush(
        buildPullRequestResponse({
          state: 'closed',
          merged: true,
          merged_at: '2026-09-19T10:00:00Z',
        }),
      );

      const response = await pendingPullRequest;

      expect(response.isModified && response.data.isMerged).toBe(true);
    });
  });

  describe('getPullRequestReviews', () => {
    it('maps reviews and falls back to COMMENTED for unknown states', async () => {
      const pendingReviews = service.getPullRequestReviews('work', 'acme', 'api', 501);
      httpTesting
        .expectOne((candidate) => candidate.url === `${PULL_REQUEST_URL}/reviews`)
        .flush([
          {
            id: 1,
            state: 'APPROVED',
            submitted_at: '2026-09-18T10:00:00Z',
            user: { login: 'reviewer' },
          },
          { id: 2, state: 'SOMETHING_NEW', user: null },
        ]);

      await expect(pendingReviews).resolves.toEqual({
        isModified: true,
        etag: undefined,
        data: [
          {
            id: 1,
            author: 'reviewer',
            state: 'APPROVED',
            submittedAt: new Date('2026-09-18T10:00:00Z'),
          },
          { id: 2, author: 'ghost', state: 'COMMENTED', submittedAt: undefined },
        ],
      });
    });
  });

  describe('rate limits', () => {
    it('records the rate limit headers of every response per session', async () => {
      const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501);
      httpTesting.expectOne(PULL_REQUEST_URL).flush(buildPullRequestResponse(), {
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4321',
          'x-ratelimit-reset': '1790000000',
        },
      });
      await pendingPullRequest;

      expect(service.rateLimits().get('work')).toEqual({
        limit: 5000,
        remaining: 4321,
        resetAt: new Date(1790000000 * 1000),
      });
    });

    it('raises GitHubRateLimitError when the primary limit is exhausted', async () => {
      const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501);
      httpTesting.expectOne(PULL_REQUEST_URL).flush(
        { message: 'API rate limit exceeded' },
        {
          status: 403,
          statusText: 'Forbidden',
          headers: {
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1790000000',
          },
        },
      );

      const error = await pendingPullRequest.catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(GitHubRateLimitError);
      expect((error as GitHubRateLimitError).resetAt).toEqual(new Date(1790000000 * 1000));
      expect(service.rateLimits().get('work')?.remaining).toBe(0);
    });

    it('raises GitHubRateLimitError with retry-after for secondary limits', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-19T12:00:00Z') });
      try {
        const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501);
        httpTesting
          .expectOne(PULL_REQUEST_URL)
          .flush(
            { message: 'slow down' },
            { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '60' } },
          );

        const error = await pendingPullRequest.catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(GitHubRateLimitError);
        expect((error as GitHubRateLimitError).resetAt).toEqual(new Date('2026-09-19T12:01:00Z'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps a plain 403 without rate limit headers as a GitHubApiError', async () => {
      const pendingPullRequest = service.getPullRequest('work', 'acme', 'api', 501);
      httpTesting
        .expectOne(PULL_REQUEST_URL)
        .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

      const error = await pendingPullRequest.catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(GitHubApiError);
      expect(error).not.toBeInstanceOf(GitHubRateLimitError);
    });
  });

  describe('errors', () => {
    it('normalizes HTTP failures into a GitHubApiError without headers', async () => {
      const pendingUser = service.getCurrentUser('work');
      httpTesting
        .expectOne(`${GITHUB_API_BASE_URL}/user`)
        .flush(
          { message: 'Bad credentials' },
          { status: 401, statusText: 'Unauthorized', headers: { 'x-secret': '1' } },
        );

      const error = await pendingUser.catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(GitHubApiError);
      expect(error).toMatchObject({ status: 401, endpoint: '/user' });
      expect(JSON.stringify(error)).not.toContain('x-secret');
      expect((error as GitHubApiError).message).toBe('El token no es válido o expiró.');
    });
  });
});
