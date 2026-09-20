import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, min, pattern, required, submit } from '@angular/forms/signals';

import { describeGithubError } from '../../../core/github/github-errors';
import { GithubSessionService } from '../../../core/github/github-session.service';
import { WatchedRepositoriesService } from '../../../core/repositories/watched-repositories.service';
import {
  parseRepositoryFullName,
  REPOSITORY_FULL_NAME_PATTERN,
} from '../../../shared/utils/parse-repository-full-name';
import { ReviewService } from '../review.service';

@Component({
  selector: 'app-add-review-pull-request-form',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-review-pull-request-form.component.html',
})
export class AddReviewPullRequestFormComponent {
  private readonly review = inject(ReviewService);
  private readonly watchedRepositories = inject(WatchedRepositoriesService);
  protected readonly sessions = inject(GithubSessionService);

  protected readonly model = signal({
    accountId: this.sessions.activeSessionId() ?? '',
    repository: '',
    number: 0,
  });
  protected readonly pullRequestForm = form(this.model, (schemaPath) => {
    required(schemaPath.accountId, { message: 'Selecciona una cuenta.' });
    required(schemaPath.repository, { message: 'Escribe el repositorio como propietario/nombre.' });
    pattern(schemaPath.repository, REPOSITORY_FULL_NAME_PATTERN, {
      message: 'Usa el formato propietario/nombre.',
    });
    min(schemaPath.number, 1, { message: 'Escribe el número del Pull Request.' });
  });
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  /** Watched repositories of the selected account, offered as suggestions. */
  protected readonly suggestedRepositories = computed(() =>
    this.watchedRepositories
      .all()
      .filter((repository) => repository.githubSessionId === this.model().accountId)
      .map((repository) => repository.fullName),
  );

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set('');
    this.successMessage.set('');

    await submit(this.pullRequestForm, async () => {
      const { accountId, repository, number } = this.model();
      const reference = parseRepositoryFullName(repository);
      if (!reference) {
        this.errorMessage.set('Usa el formato propietario/nombre.');
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
