import { GitHubPullRequest } from '../github/models';
import {
  buildTrackedPullRequestId,
  createTrackedPullRequest,
} from './tracked-pull-request.factory';

const remote: GitHubPullRequest = {
  number: 501,
  title: 'Fix token manager',
  url: 'https://github.com/acme/api/pull/501',
  author: 'mane-work',
  labels: [{ name: 'bug', color: 'd73a4a' }],
  state: 'open',
  isDraft: false,
  isMerged: false,
  headSha: 'abc123',
  issueCommentCount: 2,
  reviewCommentCount: 3,
  commitCount: 4,
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-18T10:00:00Z'),
};

describe('createTrackedPullRequest', () => {
  it('builds a stable id from session, repository and number', () => {
    expect(buildTrackedPullRequestId('work', 'acme', 'api', 501)).toBe('work:acme/api#501');
  });

  it('uses the remote counters as the acknowledged baseline', () => {
    const tracked = createTrackedPullRequest({
      githubSessionId: 'work',
      owner: 'acme',
      repository: 'api',
      category: 'WORK',
      status: 'PAUSED',
      priority: 'P2',
      remote,
      reviewCount: 1,
      etag: 'W/"v1"',
    });

    expect(tracked).toMatchObject({
      id: 'work:acme/api#501',
      category: 'WORK',
      status: 'PAUSED',
      priority: 'P2',
      headSha: 'abc123',
      issueCommentCount: 2,
      reviewCommentCount: 3,
      reviewCount: 1,
      lastKnownIssueCommentCount: 2,
      lastKnownReviewCommentCount: 3,
      lastKnownReviewCount: 1,
      commitCount: 4,
      lastKnownCommitCount: 4,
      isAttentionRequired: false,
      attentionReasons: [],
      isArchived: false,
      etag: 'W/"v1"',
    });
    expect(tracked.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('archives pull requests that are already merged or closed', () => {
    const merged = createTrackedPullRequest({
      githubSessionId: 'work',
      owner: 'acme',
      repository: 'api',
      category: 'REVIEW',
      status: 'PENDING',
      priority: 'P1',
      remote: { ...remote, state: 'closed', isMerged: true },
      reviewCount: 0,
    });

    expect(merged.isArchived).toBe(true);
  });
});
