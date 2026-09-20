import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { TrackedPullRequestStatus } from '../../../core/database/models';
import { GitHubAccountSession } from '../../../core/github/models';
import {
  DEFAULT_PULL_REQUEST_FILTERS,
  hasActiveFilters,
  PullRequestFilters,
  PullRequestSortKey,
} from '../../../core/pull-requests/pull-request-filtering';
import { SelectOption } from '../../pull-request-labels';

const SORT_OPTIONS: readonly SelectOption<PullRequestSortKey>[] = [
  { value: 'priority', label: 'Prioridad' },
  { value: 'updated', label: 'Actualización' },
  { value: 'number', label: 'Número' },
];

@Component({
  selector: 'app-pull-request-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pull-request-filters.component.html',
})
export class PullRequestFiltersComponent {
  readonly value = model<PullRequestFilters>(DEFAULT_PULL_REQUEST_FILTERS);
  readonly statusOptions = input.required<readonly SelectOption[]>();
  readonly accounts = input<readonly GitHubAccountSession[]>([]);
  readonly totalCount = input(0);
  readonly visibleCount = input(0);

  protected readonly sortOptions = SORT_OPTIONS;

  protected hasActiveFilters(): boolean {
    return hasActiveFilters(this.value());
  }

  protected onSearchInput(event: Event): void {
    this.patch({ search: (event.target as HTMLInputElement).value });
  }

  protected onStatusChange(event: Event): void {
    this.patch({
      status: (event.target as HTMLSelectElement).value as TrackedPullRequestStatus | '',
    });
  }

  protected onAccountChange(event: Event): void {
    this.patch({ accountId: (event.target as HTMLSelectElement).value });
  }

  protected onAttentionChange(event: Event): void {
    this.patch({ isAttentionOnly: (event.target as HTMLInputElement).checked });
  }

  protected onSortChange(event: Event): void {
    this.patch({ sortKey: (event.target as HTMLSelectElement).value as PullRequestSortKey });
  }

  protected reset(): void {
    this.value.set({ ...DEFAULT_PULL_REQUEST_FILTERS, sortKey: this.value().sortKey });
  }

  private patch(changes: Partial<PullRequestFilters>): void {
    this.value.update((current) => ({ ...current, ...changes }));
  }
}
