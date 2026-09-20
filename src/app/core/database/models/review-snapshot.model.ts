export interface ReviewSnapshot {
  id?: number;
  pullRequestId: string;
  reviewedAt: Date;
  headSha: string;
  issueCommentCount: number;
  reviewCommentCount: number;
  reviewCount: number;
}
