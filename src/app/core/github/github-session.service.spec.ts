import 'fake-indexeddb/auto';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../database/database.service';
import { GITHUB_API_BASE_URL } from './github-api.constants';
import {
  AccountMismatchError,
  DuplicateAccountError,
  GitHubApiError,
  MissingSessionTokenError,
} from './github-errors';
import { GithubApiService } from './github-api.service';
import { githubInterceptor } from './github.interceptor';
import { GithubSessionService } from './github-session.service';

const USER_ENDPOINT = `${GITHUB_API_BASE_URL}/user`;
const FAKE_TOKEN = 'github_pat_FAKE_0000';

describe('GithubSessionService', () => {
  let service: GithubSessionService;
  let database: DatabaseService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([githubInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(GithubSessionService);
    database = TestBed.inject(DatabaseService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    httpTesting.verify();
    await database.delete();
  });

  function flushCurrentUser(
    login: string,
    avatarUrl = `https://avatars.githubusercontent.com/u/1?v=4`,
  ): void {
    httpTesting.expectOne(USER_ENDPOINT).flush({ login, name: null, avatar_url: avatarUrl });
  }

  async function addWorkAccount(): Promise<string> {
    const pendingAccount = service.addAccount('Trabajo', FAKE_TOKEN);
    flushCurrentUser('mane-work');
    return (await pendingAccount).id;
  }

  describe('addAccount', () => {
    it('validates the token against GitHub using the bearer header', async () => {
      const pendingAccount = service.addAccount('Trabajo', FAKE_TOKEN);

      const request = httpTesting.expectOne(USER_ENDPOINT);
      expect(request.request.headers.get('Authorization')).toBe(`Bearer ${FAKE_TOKEN}`);
      expect(request.request.headers.get('X-GitHub-Api-Version')).toBe('2022-11-28');
      request.flush({
        login: 'mane-work',
        name: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
      });

      const account = await pendingAccount;
      expect(account).toMatchObject({ name: 'Trabajo', username: 'mane-work', hasToken: true });
    });

    it('persists only account metadata, never the token', async () => {
      const accountId = await addWorkAccount();

      const storedAccount = await database.githubAccounts.get(accountId);

      expect(storedAccount).toEqual({
        id: accountId,
        name: 'Trabajo',
        username: 'mane-work',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      });
      expect(JSON.stringify(storedAccount)).not.toContain(FAKE_TOKEN);
    });

    it('makes the first account the active session', async () => {
      const accountId = await addWorkAccount();

      expect(service.activeSessionId()).toBe(accountId);
      await expect(database.settings.get('activeAccountId')).resolves.toEqual({
        key: 'activeAccountId',
        value: accountId,
      });
    });

    it('discards the token and the account when GitHub rejects the token', async () => {
      const pendingAccount = service.addAccount('Trabajo', 'github_pat_FAKE_BAD');
      httpTesting
        .expectOne(USER_ENDPOINT)
        .flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });

      await expect(pendingAccount).rejects.toBeInstanceOf(GitHubApiError);
      expect(service.accounts()).toEqual([]);
      await expect(database.githubAccounts.count()).resolves.toBe(0);
    });

    it('rejects a second account for the same GitHub user', async () => {
      await addWorkAccount();

      const pendingDuplicate = service.addAccount('Duplicada', 'github_pat_FAKE_1111');
      flushCurrentUser('mane-work');

      await expect(pendingDuplicate).rejects.toBeInstanceOf(DuplicateAccountError);
      expect(service.accounts()).toHaveLength(1);
    });

    it('drops avatar urls outside the GitHub avatars host', async () => {
      const pendingAccount = service.addAccount('Trabajo', FAKE_TOKEN);
      flushCurrentUser('mane-work', 'https://evil.example/avatar.png');

      const account = await pendingAccount;

      expect(account.avatarUrl).toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('restores account metadata without tokens after a reload', async () => {
      await database.githubAccounts.put({ id: 'work', name: 'Trabajo', username: 'mane-work' });
      await database.settings.put({ key: 'activeAccountId', value: 'work' });

      await service.initialize();

      expect(service.accounts()).toEqual([
        { id: 'work', name: 'Trabajo', username: 'mane-work', hasToken: false },
      ]);
      expect(service.accountsMissingToken()).toHaveLength(1);
      expect(service.activeSessionId()).toBe('work');
      expect(service.hasReadySession()).toBe(false);
    });

    it('falls back to the first account when the stored active account no longer exists', async () => {
      await database.githubAccounts.put({ id: 'personal', name: 'Personal', username: 'mane' });
      await database.settings.put({ key: 'activeAccountId', value: 'missing' });

      await service.initialize();

      expect(service.activeSessionId()).toBe('personal');
    });
  });

  describe('provideToken', () => {
    beforeEach(async () => {
      await database.githubAccounts.put({ id: 'work', name: 'Trabajo', username: 'mane-work' });
      await service.initialize();
    });

    it('loads the token in memory when the login matches the account', async () => {
      const pendingToken = service.provideToken('work', FAKE_TOKEN);
      flushCurrentUser('mane-work');
      await pendingToken;

      expect(service.accounts()[0].hasToken).toBe(true);
      expect(service.accountsMissingToken()).toEqual([]);
      expect(service.getToken('work')).toBe(FAKE_TOKEN);
    });

    it('does not report the token as ready while GitHub is still validating it', async () => {
      const pendingToken = service.provideToken('work', FAKE_TOKEN);

      expect(service.accounts()[0].hasToken).toBe(false);
      expect(service.getToken('work')).toBe(FAKE_TOKEN);

      httpTesting
        .expectOne(USER_ENDPOINT)
        .flush({ message: 'Bad credentials' }, { status: 401, statusText: 'Unauthorized' });

      await expect(pendingToken).rejects.toBeInstanceOf(GitHubApiError);
      expect(service.accounts()[0].hasToken).toBe(false);
      expect(service.getToken('work')).toBeUndefined();
    });

    it('rejects a token that belongs to a different GitHub user', async () => {
      const pendingToken = service.provideToken('work', FAKE_TOKEN);
      flushCurrentUser('someone-else');

      await expect(pendingToken).rejects.toBeInstanceOf(AccountMismatchError);
      expect(service.getToken('work')).toBeUndefined();
    });
  });

  describe('clearToken', () => {
    it('removes the token from memory but keeps the account', async () => {
      const accountId = await addWorkAccount();

      service.clearToken(accountId);

      expect(service.accounts()).toEqual([
        expect.objectContaining({ id: accountId, hasToken: false }),
      ]);
      await expect(database.githubAccounts.count()).resolves.toBe(1);
    });
  });

  describe('forgetAccount', () => {
    it('deletes the account together with its repositories, pull requests and snapshots', async () => {
      const accountId = await addWorkAccount();
      const now = new Date();
      await database.trackedPullRequests.put({
        id: `${accountId}:acme/api#1`,
        githubSessionId: accountId,
        owner: 'acme',
        repository: 'api',
        number: 1,
        title: 'PR',
        url: 'https://github.com/acme/api/pull/1',
        author: 'mane-work',
        labels: [],
        category: 'WORK',
        status: 'CURRENT',
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
      });
      await database.reviewSnapshots.add({
        pullRequestId: `${accountId}:acme/api#1`,
        reviewedAt: now,
        headSha: 'abc',
        issueCommentCount: 0,
        reviewCommentCount: 0,
        reviewCount: 0,
      });

      await database.watchedRepositories.put({
        id: `${accountId}:acme/api`,
        githubSessionId: accountId,
        owner: 'acme',
        name: 'api',
        fullName: 'acme/api',
        addedAt: now,
      });

      await service.forgetAccount(accountId);

      expect(service.accounts()).toEqual([]);
      expect(service.activeSessionId()).toBeNull();
      await expect(database.githubAccounts.count()).resolves.toBe(0);
      await expect(database.trackedPullRequests.count()).resolves.toBe(0);
      await expect(database.reviewSnapshots.count()).resolves.toBe(0);
      await expect(database.watchedRepositories.count()).resolves.toBe(0);
    });
  });

  describe('requests without a token', () => {
    it('fails before reaching GitHub when the session has no token', async () => {
      const githubApi = TestBed.inject(GithubApiService);

      await expect(githubApi.getCurrentUser('unknown')).rejects.toBeInstanceOf(
        MissingSessionTokenError,
      );
      httpTesting.expectNone(USER_ENDPOINT);
    });
  });
});
