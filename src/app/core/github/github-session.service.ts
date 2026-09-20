import { computed, inject, Injectable, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { GitHubAccount } from '../database/models';
import { GithubApiService } from './github-api.service';
import { AccountMismatchError, DuplicateAccountError, UnknownAccountError } from './github-errors';
import { GitHubAccountSession, GitHubUser } from './models';

function createAccountId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

/**
 * Holds every GitHub session at the same time. Tokens live only in memory and are discarded on reload;
 * account metadata is persisted so the user can be asked for the missing tokens again.
 */
@Injectable({ providedIn: 'root' })
export class GithubSessionService {
  private readonly database = inject(DatabaseService);
  private readonly githubApi = inject(GithubApiService);

  private readonly accountsState = signal<GitHubAccount[]>([]);
  private readonly tokensBySessionId = signal<ReadonlyMap<string, string>>(new Map());
  /** Tokens being validated against GitHub. Visible to the interceptor, but not reported as ready. */
  private readonly pendingTokensBySessionId = new Map<string, string>();
  private readonly activeSessionIdState = signal<string | null>(null);

  readonly accounts = computed<GitHubAccountSession[]>(() => {
    const tokens = this.tokensBySessionId();
    return this.accountsState().map((account) => ({
      ...account,
      hasToken: tokens.has(account.id),
    }));
  });
  readonly activeSessionId = this.activeSessionIdState.asReadonly();
  readonly activeAccount = computed(
    () => this.accounts().find((account) => account.id === this.activeSessionId()) ?? null,
  );
  readonly accountsMissingToken = computed(() =>
    this.accounts().filter((account) => !account.hasToken),
  );
  readonly hasReadySession = computed(() => this.accounts().some((account) => account.hasToken));

  /** Loads persisted account metadata. Tokens are never restored. */
  async initialize(): Promise<void> {
    const [accounts, activeAccountSetting] = await Promise.all([
      this.database.githubAccounts.toArray(),
      this.database.settings.get('activeAccountId'),
    ]);

    this.accountsState.set(accounts);

    const storedActiveId = activeAccountSetting?.value ?? null;
    const isStoredActiveValid = accounts.some((account) => account.id === storedActiveId);
    this.activeSessionIdState.set(isStoredActiveValid ? storedActiveId : (accounts[0]?.id ?? null));
  }

  async addAccount(name: string, token: string): Promise<GitHubAccountSession> {
    const id = createAccountId();
    const user = await this.validateToken(id, token);

    if (this.accountsState().some((account) => account.username === user.login)) {
      this.clearToken(id);
      throw new DuplicateAccountError(user.login);
    }

    const account: GitHubAccount = {
      id,
      name: name.trim(),
      username: user.login,
      avatarUrl: user.avatarUrl,
    };
    await this.database.githubAccounts.put(account);
    this.accountsState.update((accounts) => [...accounts, account]);

    if (this.activeSessionId() === null) {
      await this.setActiveSession(id);
    }

    return { ...account, hasToken: true };
  }

  /** Re-enters the token of an existing account, typically after a reload. */
  async provideToken(accountId: string, token: string): Promise<void> {
    const account = this.requireAccount(accountId);
    const user = await this.validateToken(accountId, token);

    if (user.login !== account.username) {
      this.clearToken(accountId);
      throw new AccountMismatchError(account.username, user.login);
    }

    if (user.avatarUrl !== account.avatarUrl) {
      const updatedAccount: GitHubAccount = { ...account, avatarUrl: user.avatarUrl };
      await this.database.githubAccounts.put(updatedAccount);
      this.accountsState.update((accounts) =>
        accounts.map((current) => (current.id === accountId ? updatedAccount : current)),
      );
    }
  }

  /** Drops the token from memory. The account metadata stays so the token can be entered again. */
  clearToken(sessionId: string): void {
    this.tokensBySessionId.update((tokens) => {
      if (!tokens.has(sessionId)) {
        return tokens;
      }
      const nextTokens = new Map(tokens);
      nextTokens.delete(sessionId);
      return nextTokens;
    });
  }

  /** Removes the account, its watched repositories, tracked pull requests and review snapshots. */
  async forgetAccount(accountId: string): Promise<void> {
    this.requireAccount(accountId);

    await this.database.transaction(
      'rw',
      [
        this.database.githubAccounts,
        this.database.trackedPullRequests,
        this.database.reviewSnapshots,
        this.database.watchedRepositories,
      ],
      async () => {
        const pullRequestIds = await this.database.trackedPullRequests
          .where('githubSessionId')
          .equals(accountId)
          .primaryKeys();
        await this.database.reviewSnapshots.where('pullRequestId').anyOf(pullRequestIds).delete();
        await this.database.trackedPullRequests.bulkDelete(pullRequestIds);
        await this.database.watchedRepositories.where('githubSessionId').equals(accountId).delete();
        await this.database.githubAccounts.delete(accountId);
      },
    );

    this.clearToken(accountId);
    this.accountsState.update((accounts) => accounts.filter((account) => account.id !== accountId));

    if (this.activeSessionId() === accountId) {
      await this.setActiveSession(this.accountsState()[0]?.id ?? null);
    }
  }

  async setActiveSession(accountId: string | null): Promise<void> {
    if (accountId !== null) {
      this.requireAccount(accountId);
    }
    this.activeSessionIdState.set(accountId);
    await this.database.settings.put({ key: 'activeAccountId', value: accountId });
  }

  /** Intended for the GitHub HTTP interceptor only. Do not call it from features or components. */
  getToken(sessionId: string): string | undefined {
    return this.tokensBySessionId().get(sessionId) ?? this.pendingTokensBySessionId.get(sessionId);
  }

  /**
   * The token is kept as pending while GitHub validates it, so `accounts()` does not report it as ready
   * before the answer arrives. Only a successful validation stores it.
   */
  private async validateToken(sessionId: string, token: string): Promise<GitHubUser> {
    const trimmedToken = token.trim();
    this.pendingTokensBySessionId.set(sessionId, trimmedToken);

    try {
      const user = await this.githubApi.getCurrentUser(sessionId);
      this.storeToken(sessionId, trimmedToken);
      return user;
    } finally {
      this.pendingTokensBySessionId.delete(sessionId);
    }
  }

  private storeToken(sessionId: string, token: string): void {
    this.tokensBySessionId.update((tokens) => new Map(tokens).set(sessionId, token));
  }

  private requireAccount(accountId: string): GitHubAccount {
    const account = this.accountsState().find((current) => current.id === accountId);
    if (!account) {
      throw new UnknownAccountError(accountId);
    }
    return account;
  }
}
