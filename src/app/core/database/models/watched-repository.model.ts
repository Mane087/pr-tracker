/** Repository whose open pull requests are imported into the Work section for one account. */
export interface WatchedRepository {
  /** Stable key: `${githubSessionId}:${owner}/${name}`. */
  id: string;
  githubSessionId: string;
  owner: string;
  name: string;
  fullName: string;
  addedAt: Date;
}
