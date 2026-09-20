import type { Page, Route } from '@playwright/test';

export const FAKE_TOKEN = 'github_pat_FAKE_0000';

export interface PullRequestMock {
  number: number;
  title: string;
  author: string;
  headSha: string;
  comments: number;
  reviewComments: number;
  commits: number;
  merged?: boolean;
  state?: 'open' | 'closed';
  labels?: { name: string; color: string }[];
}

export interface GithubMockState {
  login: string;
  repositories: { owner: string; name: string }[];
  pullRequests: Record<string, PullRequestMock>;
  reviews: Record<string, number>;
  /** Filled by the mock: one entry per request, e.g. `GET /repos/acme/api/pulls/561 304`. */
  requests?: string[];
}

/** GitHub exposes these headers to browser code; without this header a cross-origin script cannot read `ETag`. */
const EXPOSED_HEADERS = 'etag, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset';

function conditionalHeaders(etag: string): Record<string, string> {
  return {
    etag,
    'access-control-expose-headers': EXPOSED_HEADERS,
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4999',
    'x-ratelimit-reset': '1790000000',
  };
}

function pullRequestBody(owner: string, repository: string, pullRequest: PullRequestMock) {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    html_url: `https://github.com/${owner}/${repository}/pull/${pullRequest.number}`,
    state: pullRequest.state ?? 'open',
    draft: false,
    merged: pullRequest.merged ?? false,
    merged_at: pullRequest.merged ? '2026-09-19T10:00:00Z' : null,
    comments: pullRequest.comments,
    review_comments: pullRequest.reviewComments,
    commits: pullRequest.commits,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-18T10:00:00Z',
    user: { login: pullRequest.author },
    labels: pullRequest.labels ?? [],
    head: { sha: pullRequest.headSha },
  };
}

/**
 * Routes every api.github.com request to an in-memory state. Tests mutate `state` to simulate remote activity.
 * Requests without a bearer token are answered with 401, like GitHub does.
 */
export async function mockGithub(page: Page, state: GithubMockState): Promise<GithubMockState> {
  await page.route('https://api.github.com/**', async (route: Route) => {
    const request = route.request();
    const authorization = request.headers()['authorization'];
    if (authorization !== `Bearer ${FAKE_TOKEN}`) {
      await route.fulfill({ status: 401, json: { message: 'Bad credentials' } });
      return;
    }

    const url = new URL(request.url());
    const path = url.pathname;
    const ifNoneMatch = request.headers()['if-none-match'];
    const record = (status: number) => (state.requests ??= []).push(`GET ${path} ${status}`);

    if (path === '/user') {
      await route.fulfill({
        json: {
          login: state.login,
          name: null,
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
        },
      });
      return;
    }

    if (path === '/user/repos') {
      await route.fulfill({
        json: state.repositories.map((repository, index) => ({
          id: index + 1,
          name: repository.name,
          full_name: `${repository.owner}/${repository.name}`,
          html_url: `https://github.com/${repository.owner}/${repository.name}`,
          private: true,
          updated_at: '2026-09-18T10:00:00Z',
          owner: { login: repository.owner },
        })),
      });
      return;
    }

    const listMatch = /^\/repos\/([^/]+)\/([^/]+)\/pulls$/.exec(path);
    if (listMatch) {
      const [, owner, repository] = listMatch;
      const pullRequests = Object.values(state.pullRequests)
        .filter((pullRequest) => (pullRequest.state ?? 'open') === 'open')
        .map((pullRequest) => pullRequestBody(owner, repository, pullRequest));
      await route.fulfill({ json: pullRequests });
      return;
    }

    const reviewsMatch = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)\/reviews$/.exec(path);
    if (reviewsMatch) {
      const count = state.reviews[reviewsMatch[3]] ?? 0;
      const etag = `W/"reviews-${reviewsMatch[3]}-${count}"`;
      if (ifNoneMatch === etag) {
        record(304);
        await route.fulfill({ status: 304, headers: conditionalHeaders(etag) });
        return;
      }
      record(200);
      await route.fulfill({
        headers: conditionalHeaders(etag),
        json: Array.from({ length: count }, (_, index) => ({
          id: index + 1,
          state: 'COMMENTED',
          submitted_at: '2026-09-18T10:00:00Z',
          user: { login: 'reviewer' },
        })),
      });
      return;
    }

    const singleMatch = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/.exec(path);
    if (singleMatch) {
      const [, owner, repository, number] = singleMatch;
      const pullRequest = state.pullRequests[number];
      if (!pullRequest) {
        record(404);
        await route.fulfill({ status: 404, json: { message: 'Not Found' } });
        return;
      }
      const etag = `W/"pr-${number}-${pullRequest.headSha}-${pullRequest.comments}-${pullRequest.reviewComments}-${pullRequest.commits}-${pullRequest.state ?? 'open'}"`;
      if (ifNoneMatch === etag) {
        record(304);
        await route.fulfill({ status: 304, headers: conditionalHeaders(etag) });
        return;
      }
      record(200);
      await route.fulfill({
        headers: conditionalHeaders(etag),
        json: pullRequestBody(owner, repository, pullRequest),
      });
      return;
    }

    await route.fulfill({ status: 404, json: { message: `Unmocked endpoint ${path}` } });
  });

  return state;
}

/** Adds an account through the settings page and returns to the given route. */
export async function addAccount(page: Page, name: string): Promise<void> {
  await page.goto('/settings');
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Token de acceso').fill(FAKE_TOKEN);
  await page.getByRole('button', { name: 'Agregar cuenta' }).click();
  await page.getByText('Token en memoria').waitFor();
}

/** Client-side navigation through the tabs. A full page load would discard the in-memory tokens. */
export async function openTab(page: Page, tab: 'Trabajo' | 'Revisión'): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: tab })
    .click();
  await page.getByRole('heading', { level: 2, name: tab }).waitFor();
}
