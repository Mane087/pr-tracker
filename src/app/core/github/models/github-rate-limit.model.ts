export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  resetAt: Date;
}
