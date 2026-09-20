import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { GITHUB_API_BASE_URL, GITHUB_SESSION_ID } from './github-api.constants';
import { MissingSessionTokenError } from './github-errors';
import { githubInterceptor } from './github.interceptor';
import { GithubSessionService } from './github-session.service';

describe('githubInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  const getToken = jest.fn<string | undefined, [string]>();

  beforeEach(() => {
    getToken.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([githubInterceptor])),
        provideHttpClientTesting(),
        { provide: GithubSessionService, useValue: { getToken } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('adds the session token to GitHub requests', async () => {
    getToken.mockReturnValue('github_pat_FAKE_0000');
    const context = new HttpContext().set(GITHUB_SESSION_ID, 'work');

    const pendingResponse = firstValueFrom(http.get(`${GITHUB_API_BASE_URL}/user`, { context }));
    const request = httpTesting.expectOne(`${GITHUB_API_BASE_URL}/user`);
    request.flush({});
    await pendingResponse;

    expect(getToken).toHaveBeenCalledWith('work');
    expect(request.request.headers.get('Authorization')).toBe('Bearer github_pat_FAKE_0000');
    expect(request.request.headers.get('Accept')).toBe('application/vnd.github+json');
  });

  it('leaves requests without a session context untouched', async () => {
    const pendingResponse = firstValueFrom(http.get(`${GITHUB_API_BASE_URL}/meta`));
    const request = httpTesting.expectOne(`${GITHUB_API_BASE_URL}/meta`);
    request.flush({});
    await pendingResponse;

    expect(getToken).not.toHaveBeenCalled();
    expect(request.request.headers.has('Authorization')).toBe(false);
  });

  it('never sends the token to hosts other than the GitHub API', async () => {
    getToken.mockReturnValue('github_pat_FAKE_0000');
    const context = new HttpContext().set(GITHUB_SESSION_ID, 'work');

    const pendingResponse = firstValueFrom(http.get('https://example.com/data', { context }));
    const request = httpTesting.expectOne('https://example.com/data');
    request.flush({});
    await pendingResponse;

    expect(getToken).not.toHaveBeenCalled();
    expect(request.request.headers.has('Authorization')).toBe(false);
  });

  it('fails without sending the request when the session has no token', async () => {
    getToken.mockReturnValue(undefined);
    const context = new HttpContext().set(GITHUB_SESSION_ID, 'work');

    await expect(
      firstValueFrom(http.get(`${GITHUB_API_BASE_URL}/user`, { context })),
    ).rejects.toBeInstanceOf(MissingSessionTokenError);
    httpTesting.expectNone(`${GITHUB_API_BASE_URL}/user`);
  });
});
