import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';

import { GithubApiService } from '../../../core/github/github-api.service';
import { describeGithubError } from '../../../core/github/github-errors';
import { GithubSessionService } from '../../../core/github/github-session.service';
import { GitHubRepository } from '../../../core/github/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { parseRepositoryFullName } from '../../../shared/utils/parse-repository-full-name';
import { ReviewService } from '../review.service';

@Component({
  selector: 'app-add-review-pull-request-form',
  imports: [FormField, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-review-pull-request-form.component.html',
})
export class AddReviewPullRequestFormComponent {
  private readonly review = inject(ReviewService);
  private readonly githubApi = inject(GithubApiService);
  protected readonly sessions = inject(GithubSessionService);

  protected readonly model = signal({
    accountId: this.sessions.activeSessionId() ?? '',
    repository: '',
    number: 0,
  });
  protected readonly pullRequestForm = form(this.model, (schemaPath) => {
    required(schemaPath.accountId, { message: 'Selecciona una cuenta.' });
    required(schemaPath.repository, { message: 'Selecciona un repositorio.' });
    min(schemaPath.number, 1, { message: 'Escribe el número del Pull Request.' });
  });
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly selectedAccount = computed(
    () => this.sessions.accounts().find((account) => account.id === this.model().accountId) ?? null,
  );
  /** Repositories the selected account can access, fetched from GitHub. */
  protected readonly repositories = signal<GitHubRepository[]>([]);
  protected readonly isLoadingRepositories = signal(false);
  protected readonly repositoriesError = signal('');
  private latestRepositoriesRequest = 0;

  constructor() {
    // Reload the repository list whenever the selected account or its token changes.
    effect(() => {
      const account = this.selectedAccount();
      untracked(() => void this.loadRepositories(account?.hasToken ? account.id : ''));
    });
  }

  private async loadRepositories(accountId: string): Promise<void> {
    const requestId = ++this.latestRepositoriesRequest;
    this.repositories.set([]);
    this.repositoriesError.set('');
    this.model.update((current) =>
      current.repository === '' ? current : { ...current, repository: '' },
    );
    if (accountId === '') {
      this.isLoadingRepositories.set(false);
      return;
    }

    this.isLoadingRepositories.set(true);
    try {
      const repositories = await this.githubApi.getUserRepositories(accountId);
      if (requestId === this.latestRepositoriesRequest) {
        this.repositories.set(repositories);
      }
    } catch (error) {
      if (requestId === this.latestRepositoriesRequest) {
        this.repositoriesError.set(describeGithubError(error));
      }
    } finally {
      if (requestId === this.latestRepositoriesRequest) {
        this.isLoadingRepositories.set(false);
      }
    }
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set('');
    this.successMessage.set('');

    await submit(this.pullRequestForm, async () => {
      const { accountId, repository, number } = this.model();
      const reference = parseRepositoryFullName(repository);
      if (!reference) {
        this.errorMessage.set('Selecciona un repositorio.');
        return;
      }

      try {
        const tracked = await this.review.addPullRequest(
          accountId,
          reference.owner,
          reference.name,
          number,
        );
        this.successMessage.set(`#${tracked.number} ${tracked.title} agregado a Revisión.`);
        this.model.update((current) => ({ ...current, number: 0 }));
        this.pullRequestForm().reset();
      } catch (error) {
        this.errorMessage.set(describeGithubError(error));
      }
    });
  }
}
