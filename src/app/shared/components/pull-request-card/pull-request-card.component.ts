import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  Priority,
  TrackedPullRequest,
  TrackedPullRequestStatus,
} from '../../../core/database/models';
import { PRIORITY_OPTIONS, SelectOption } from '../../pull-request-labels';

@Component({
  selector: 'app-pull-request-card',
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
