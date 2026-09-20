export type GitHubReviewState =
  'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';

export interface GitHubReview {
  id: number;
  author: string;
  state: GitHubReviewState;
  submittedAt?: Date;
}
