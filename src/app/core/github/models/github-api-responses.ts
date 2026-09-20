/** Raw payloads of the GitHub REST API. Only the fields the application reads are declared. */

export interface GitHubUserResponse {
  login: string;
  name: string | null;
  avatar_url?: string;
}

export interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  updated_at: string;
  owner: { login: string };
}

export interface GitHubLabelResponse {
  name: string;
  color: string;
}

export interface GitHubPullRequestSummaryResponse {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  draft?: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  user: { login: string } | null;
  labels: GitHubLabelResponse[];
  head: { sha: string };
}

export interface GitHubPullRequestResponse extends GitHubPullRequestSummaryResponse {
  merged: boolean;
  comments: number;
  review_comments: number;
  commits: number;
}

export interface GitHubReviewResponse {
  id: number;
  state: string;
  submitted_at?: string;
  user: { login: string } | null;
}
