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
import { PullRequestCardComponent } from '../../shared/components/pull-request-card/pull-request-card.component';
import { PullRequestFiltersComponent } from '../../shared/components/pull-request-filters/pull-request-filters.component';
import { WORK_STATUS_OPTIONS } from '../../shared/pull-request-labels';
import { WatchedRepositoriesComponent } from './components/watched-repositories.component';
import { WorkService } from './work.service';

@Component({
  selector: 'app-work',
  imports: [
    RouterLink,
    PullRequestCardComponent,
    PullRequestFiltersComponent,
    WatchedRepositoriesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './work.component.html',
})
export class WorkComponent {
  private readonly work = inject(WorkService);
  protected readonly sessions = inject(GithubSessionService);
  protected readonly trackedPullRequests = inject(TrackedPullRequestsService);

  protected readonly statusOptions = WORK_STATUS_OPTIONS;
  protected readonly isImporting = signal(false);
  protected readonly message = signal('');
  protected readonly errorMessage = signal('');
  protected readonly filters = signal<PullRequestFilters>(DEFAULT_PULL_REQUEST_FILTERS);
  protected readonly visiblePullRequests = computed(() =>
    filterAndSortPullRequests(this.trackedPullRequests.work(), this.filters()),
  );

  protected readonly accountNameById = computed(() => {
    const showNames = this.sessions.accounts().length > 1;
    return new Map(
      this.sessions.accounts().map((account) => [account.id, showNames ? account.name : '']),
    );
  });

  protected async importPullRequests(): Promise<void> {
    const account = this.sessions.activeAccount();
    if (!account) {
      return;
    }

    this.isImporting.set(true);
    this.message.set('');
    this.errorMessage.set('');
    try {
      const result = await this.work.importOpenPullRequests(account.id);
      this.message.set(
        result.repositoryCount === 0
          ? 'Agrega al menos un repositorio para importar tus Pull Requests.'
          : `${result.importedCount} Pull Request(s) nuevo(s) importado(s).`,
      );
    } catch (error) {
      this.errorMessage.set(describeGithubError(error));
    } finally {
      this.isImporting.set(false);
    }
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
