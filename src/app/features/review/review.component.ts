import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Priority, TrackedPullRequest, TrackedPullRequestStatus } from '../../core/database/models';
import { describeGithubError } from '../../core/github/github-errors';
import { GithubSessionService } from '../../core/github/github-session.service';
import {
  DEFAULT_PULL_REQUEST_FILTERS,
  filterAndSortPullRequests,
  PullRequestFilters,
} from '../../core/pull-requests/pull-request-filtering';
import { TrackedPullRequestsService } from '../../core/pull-requests/tracked-pull-requests.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { PullRequestCardComponent } from '../../shared/components/pull-request-card/pull-request-card.component';
import { PullRequestFiltersComponent } from '../../shared/components/pull-request-filters/pull-request-filters.component';
import { REVIEW_STATUS_OPTIONS } from '../../shared/pull-request-labels';
import { AddReviewPullRequestFormComponent } from './components/add-review-pull-request-form.component';
import { ReviewService } from './review.service';

@Component({
  selector: 'app-review',
  imports: [
    RouterLink,
    IconComponent,
    PullRequestCardComponent,
    PullRequestFiltersComponent,
    AddReviewPullRequestFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review.component.html',
})
export class ReviewComponent {
  private readonly review = inject(ReviewService);
  protected readonly sessions = inject(GithubSessionService);
  protected readonly trackedPullRequests = inject(TrackedPullRequestsService);

  protected readonly statusOptions = REVIEW_STATUS_OPTIONS;
  protected readonly isAddFormOpen = signal(false);
  protected readonly summaryText = computed(() => {
    const pullRequests = this.trackedPullRequests.review();
    const needsReviewCount = pullRequests.filter(
      (pullRequest) => pullRequest.status === 'NEEDS_REVIEW',
    ).length;
    const total =
      pullRequests.length === 1
        ? '1 Pull Request que sigues'
        : `${pullRequests.length} Pull Requests que sigues`;
    const needsReview =
      needsReviewCount === 1 ? '1 necesita revisión' : `${needsReviewCount} necesitan revisión`;
    return `${total} · ${needsReview}`;
  });
  protected readonly errorMessage = signal('');
  protected readonly filters = signal<PullRequestFilters>(DEFAULT_PULL_REQUEST_FILTERS);
  protected readonly visiblePullRequests = computed(() =>
    filterAndSortPullRequests(this.trackedPullRequests.review(), this.filters()),
  );

  protected readonly accountNameById = computed(() => {
    const showNames = this.sessions.accounts().length > 1;
    return new Map(
      this.sessions.accounts().map((account) => [account.id, showNames ? account.name : '']),
    );
  });

  protected toggleAddForm(): void {
    this.isAddFormOpen.update((isOpen) => !isOpen);
  }

  protected async changeStatus(
    pullRequest: TrackedPullRequest,
    status: TrackedPullRequestStatus,
  ): Promise<void> {
    await this.persist(() => this.trackedPullRequests.setStatus(pullRequest.id, status));
  }

  protected async changePriority(
    pullRequest: TrackedPullRequest,
    priority: Priority,
  ): Promise<void> {
    await this.persist(() => this.trackedPullRequests.setPriority(pullRequest.id, priority));
  }

  protected async markAsReviewed(pullRequest: TrackedPullRequest): Promise<void> {
    await this.persist(() => this.review.markAsReviewed(pullRequest.id));
  }

  protected async acknowledge(pullRequest: TrackedPullRequest): Promise<void> {
    await this.persist(() => this.trackedPullRequests.acknowledge(pullRequest.id));
  }

  private async persist(operation: () => Promise<void>): Promise<void> {
    this.errorMessage.set('');
    try {
      await operation();
    } catch (error) {
      this.errorMessage.set(describeGithubError(error));
    }
  }
}
