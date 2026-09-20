import { ALLOWED_AVATAR_HOST } from './github-api.constants';
import {
  GitHubPullRequest,
  GitHubPullRequestSummary,
  GitHubRepository,
  GitHubReview,
  GitHubReviewState,
  GitHubUser,
} from './models';
import {
  GitHubPullRequestResponse,
  GitHubPullRequestSummaryResponse,
  GitHubRepositoryResponse,
  GitHubReviewResponse,
  GitHubUserResponse,
} from './models/github-api-responses';

const REVIEW_STATES: readonly GitHubReviewState[] = [
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
  'PENDING',
];

export function toGitHubUser(response: GitHubUserResponse): GitHubUser {
  return {
    login: response.login,
    name: response.name,
    avatarUrl: toAllowedAvatarUrl(response.avatar_url),
  };
}

export function toGitHubRepository(response: GitHubRepositoryResponse): GitHubRepository {
  return {
    id: response.id,
    owner: response.owner.login,
    name: response.name,
    fullName: response.full_name,
    url: response.html_url,
    isPrivate: response.private,
    updatedAt: new Date(response.updated_at),
  };
}

export function toGitHubPullRequestSummary(
  response: GitHubPullRequestSummaryResponse,
): GitHubPullRequestSummary {
  return {
    number: response.number,
    title: response.title,
    url: response.html_url,
    author: response.user?.login ?? 'ghost',
    labels: response.labels.map((label) => ({ name: label.name, color: label.color })),
    state: response.state,
    isDraft: response.draft ?? false,
    isMerged: response.merged_at !== null,
    headSha: response.head.sha,
    createdAt: new Date(response.created_at),
    updatedAt: new Date(response.updated_at),
  };
}

export function toGitHubPullRequest(response: GitHubPullRequestResponse): GitHubPullRequest {
  return {
    ...toGitHubPullRequestSummary(response),
    isMerged: response.merged,
    issueCommentCount: response.comments,
    reviewCommentCount: response.review_comments,
    commitCount: response.commits,
  };
}

export function toGitHubReview(response: GitHubReviewResponse): GitHubReview {
  return {
    id: response.id,
    author: response.user?.login ?? 'ghost',
    state: REVIEW_STATES.includes(response.state as GitHubReviewState)
      ? (response.state as GitHubReviewState)
      : 'COMMENTED',
    submittedAt: response.submitted_at ? new Date(response.submitted_at) : undefined,
  };
}

function toAllowedAvatarUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.host === ALLOWED_AVATAR_HOST
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
