import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  Priority,
  TrackedPullRequest,
  TrackedPullRequestStatus,
} from '../../../core/database/models';
import { PRIORITY_OPTIONS, SelectOption } from '../../pull-request-labels';
import { IconComponent } from '../icon/icon.component';

interface StatusStyle {
  pill: string;
  dot: string;
}

interface PriorityStyle {
  level: number;
  text: string;
  bar: string;
}

const STATUS_STYLES: Record<TrackedPullRequestStatus, StatusStyle> = {
  CURRENT: { pill: 'bg-success-soft text-success-ink', dot: 'bg-success-dot' },
  PAUSED: { pill: 'bg-neutral-soft text-neutral-ink', dot: 'bg-neutral-dot' },
  POSTPONED: {
    pill: 'border border-dashed border-line-strong text-ink-muted',
    dot: 'bg-neutral-dot',
  },
  PENDING: { pill: 'bg-neutral-soft text-neutral-ink', dot: 'bg-neutral-dot' },
  REVIEWING: { pill: 'bg-primary-soft text-primary-ink', dot: 'bg-primary' },
  REVIEWED: { pill: 'bg-success-soft text-success-ink', dot: 'bg-success-dot' },
  NEEDS_REVIEW: { pill: 'bg-review-soft text-review-ink', dot: 'bg-review-dot' },
};

/** P3 is the highest priority, drawn with four bars. */
const PRIORITY_STYLES: Record<Priority, PriorityStyle> = {
  P3: { level: 4, text: 'text-priority-3', bar: 'bg-priority-3' },
  P2: { level: 3, text: 'text-priority-2', bar: 'bg-priority-2' },
  P1: { level: 2, text: 'text-priority-1', bar: 'bg-priority-1' },
  P0: { level: 1, text: 'text-priority-0', bar: 'bg-priority-0' },
};

@Component({
  selector: 'app-pull-request-card',
  imports: [DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-card.component.html',
})
export class PullRequestCardComponent {
  readonly pullRequest = input.required<TrackedPullRequest>();
  readonly statusOptions = input.required<readonly SelectOption[]>();
  readonly accountName = input<string>('');

  readonly statusChange = output<TrackedPullRequestStatus>();
  readonly priorityChange = output<Priority>();
  readonly acknowledge = output<void>();

  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly priorityLevels = [1, 2, 3, 4] as const;

  protected readonly statusLabel = computed(
    () =>
      this.statusOptions().find((option) => option.value === this.pullRequest().status)?.label ??
      this.pullRequest().status,
  );
  protected readonly statusStyle = computed(() => STATUS_STYLES[this.pullRequest().status]);

  protected readonly priorityLabel = computed(
    () =>
      PRIORITY_OPTIONS.find((option) => option.value === this.pullRequest().priority)?.label ??
      this.pullRequest().priority,
  );
  protected readonly priorityStyle = computed(() => PRIORITY_STYLES[this.pullRequest().priority]);

  protected readonly attentionSummary = computed(() => {
    const pullRequest = this.pullRequest();
    const parts: string[] = [];

    if (pullRequest.attentionReasons.includes('NEW_COMMITS')) {
      const newCommits = pullRequest.commitCount - pullRequest.lastKnownCommitCount;
      parts.push(
        newCommits > 0
          ? newCommits === 1
            ? '1 commit nuevo'
            : `${newCommits} commits nuevos`
          : 'código nuevo',
      );
    }
    if (pullRequest.attentionReasons.includes('NEW_COMMENTS')) {
      const newComments =
        pullRequest.issueCommentCount +
        pullRequest.reviewCommentCount -
        pullRequest.lastKnownIssueCommentCount -
        pullRequest.lastKnownReviewCommentCount;
      parts.push(newComments === 1 ? '1 comentario nuevo' : `${newComments} comentarios nuevos`);
    }
    if (pullRequest.attentionReasons.includes('NEW_REVIEWS')) {
      const newReviews = pullRequest.reviewCount - pullRequest.lastKnownReviewCount;
      parts.push(newReviews === 1 ? '1 review nueva' : `${newReviews} reviews nuevas`);
    }

    return parts.join(' · ');
  });

  protected onStatusChange(event: Event): void {
    this.statusChange.emit((event.target as HTMLSelectElement).value as TrackedPullRequestStatus);
  }

  protected onPriorityChange(event: Event): void {
    this.priorityChange.emit((event.target as HTMLSelectElement).value as Priority);
  }
}
