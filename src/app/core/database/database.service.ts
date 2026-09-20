import { Injectable } from '@angular/core';
import Dexie, { type EntityTable } from 'dexie';

import {
  AppSetting,
  GitHubAccount,
  ReviewSnapshot,
  TrackedPullRequest,
  WatchedRepository,
} from './models';

export const DATABASE_NAME = 'pr-tracker';

/**
 * Local persistence layer. Every schema change must be added as a new `version(n)`;
 * published versions are never modified.
 *
 * Boolean fields are not indexed because IndexedDB does not accept booleans as keys.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService extends Dexie {
  declare readonly githubAccounts: EntityTable<GitHubAccount, 'id'>;
  declare readonly trackedPullRequests: EntityTable<TrackedPullRequest, 'id'>;
  declare readonly reviewSnapshots: EntityTable<ReviewSnapshot, 'id'>;
  declare readonly settings: EntityTable<AppSetting, 'key'>;
  declare readonly watchedRepositories: EntityTable<WatchedRepository, 'id'>;

  constructor() {
    super(DATABASE_NAME);

    this.version(1).stores({
      githubAccounts: 'id, username',
      trackedPullRequests: 'id, githubSessionId, category, updatedAt',
      reviewSnapshots: '++id, pullRequestId, reviewedAt',
      settings: 'key',
    });

    this.version(2).stores({
      watchedRepositories: 'id, githubSessionId',
    });

    // Version 3 adds commit counters to tracked pull requests; existing records are backfilled with 0.
    this.version(3)
      .stores({})
      .upgrade((transaction) =>
        transaction
          .table('trackedPullRequests')
          .toCollection()
          .modify((pullRequest: Partial<TrackedPullRequest>) => {
            pullRequest.commitCount ??= 0;
            pullRequest.lastKnownCommitCount ??= pullRequest.commitCount;
          }),
      );
  }
}
