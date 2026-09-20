import { GitHubLabel } from '../../database/models';

export type GitHubPullRequestState = 'open' | 'closed';

/** Shape returned by the list endpoint. It has no comment or commit counters. */
export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  url: string;
  author: string;
  labels: GitHubLabel[];
  state: GitHubPullRequestState;
  isDraft: boolean;
  isMerged: boolean;
  headSha: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape returned by the single pull request endpoint. */
export interface GitHubPullRequest extends GitHubPullRequestSummary {
  issueCommentCount: number;
  reviewCommentCount: number;
  commitCount: number;
}
