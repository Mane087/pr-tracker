/** Non-sensitive account metadata persisted in IndexedDB. Tokens are never stored here. */
export interface GitHubAccount {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
}
