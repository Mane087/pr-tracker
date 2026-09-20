import { GitHubAccount } from '../../database/models';

/** Account metadata plus whether its token is currently loaded in memory. Never exposes the token itself. */
export interface GitHubAccountSession extends GitHubAccount {
  hasToken: boolean;
}
