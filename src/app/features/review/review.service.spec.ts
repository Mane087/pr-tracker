import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../../core/database/database.service';
import { GithubApiService } from '../../core/github/github-api.service';
import { GitHubPullRequest } from '../../core/github/models';
import {
  DuplicatePullRequestError,
  TrackedPullRequestsService,
} from '../../core/pull-requests/tracked-pull-requests.service';
import { ReviewService } from './review.service';

const remote: GitHubPullRequest = {
  number: 561,
  title: 'Detect expired certificate',
  url: 'https://github.com/acme/api/pull/561',
  author: 'colleague',
  labels: [{ name: 'bug', color: 'd73a4a' }],
  state: 'open',
  isDraft: false,
  isMerged: false,
  headSha: 'sha-1',
  issueCommentCount: 1,
  reviewCommentCount: 2,
  commitCount: 3,
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-18T10:00:00Z'),
};

describe('ReviewService', () => {
  const githubApi = { getPullRequest: jest.fn(), getPullRequestReviews: jest.fn() };
  let service: ReviewService;
  let trackedPullRequests: TrackedPullRequestsService;
  let database: DatabaseService;

  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: GithubApiService, useValue: githubApi }],
    });
    service = TestBed.inject(ReviewService);
    trackedPullRequests = TestBed.inject(TrackedPullRequestsService);
    database = TestBed.inject(DatabaseService);

    githubApi.getPullRequest.mockResolvedValue({ isModified: true, etag: 'W/"v1"', data: remote });
    githubApi.getPullRequestReviews.mockResolvedValue({
      isModified: true,
      data: [{ id: 1 }, { id: 2 }],
    });
  });

  afterEach(async () => {
    await database.delete();
  });

  describe('addPullRequest', () => {
    it('fetches the pull request and stores it as PENDING with baseline counters', async () => {
      const tracked = await service.addPullRequest('work', 'acme', 'api', 561);

      expect(githubApi.getPullRequest).toHaveBeenCalledWith('work', 'acme', 'api', 561);
      expect(tracked).toMatchObject({
        id: 'work:acme/api#561',
        category: 'REVIEW',
        status: 'PENDING',
        priority: 'P2',
        headSha: 'sha-1',
        reviewCount: 2,
        lastKnownReviewCount: 2,
        commitCount: 3,
        lastKnownCommitCount: 3,
        etag: 'W/"v1"',
      });
      expect(trackedPullRequests.review()).toHaveLength(1);
      await expect(database.trackedPullRequests.get('work:acme/api#561')).resolves.toMatchObject({
        status: 'PENDING',
      });
    });

    it('rejects a pull request that is already tracked without calling GitHub', async () => {
      await service.addPullRequest('work', 'acme', 'api', 561);
      githubApi.getPullRequest.mockClear();

      await expect(service.addPullRequest('work', 'acme', 'api', 561)).rejects.toBeInstanceOf(
        DuplicatePullRequestError,
      );
      expect(githubApi.getPullRequest).not.toHaveBeenCalled();
    });
  });

  describe('markAsReviewed', () => {
    it('saves a snapshot of the reviewed version and clears pending attention', async () => {
      await service.addPullRequest('work', 'acme', 'api', 561);
      await trackedPullRequests.update('work:acme/api#561', {
        status: 'REVIEWING',
        issueCommentCount: 5,
        isAttentionRequired: true,
        attentionReasons: ['NEW_COMMENTS'],
      });

      await service.markAsReviewed('work:acme/api#561');

      const reviewed = trackedPullRequests.review()[0];
      expect(reviewed).toMatchObject({
        status: 'REVIEWED',
        lastReviewedHeadSha: 'sha-1',
        lastKnownIssueCommentCount: 5,
        lastKnownReviewCommentCount: 2,
        lastKnownReviewCount: 2,
        isAttentionRequired: false,
        attentionReasons: [],
      });

      const snapshots = await database.reviewSnapshots
        .where('pullRequestId')
        .equals('work:acme/api#561')
        .toArray();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        headSha: 'sha-1',
        issueCommentCount: 5,
        reviewCommentCount: 2,
        reviewCount: 2,
      });
      expect(Object.prototype.toString.call(snapshots[0].reviewedAt)).toBe('[object Date]');
    });

    it('rejects unknown pull requests', async () => {
      await expect(service.markAsReviewed('missing')).rejects.toThrow(
        'El Pull Request no está en la lista de seguimiento.',
      );
    });
  });
});
