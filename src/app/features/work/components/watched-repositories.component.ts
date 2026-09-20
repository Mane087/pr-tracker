import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { GithubApiService } from '../../../core/github/github-api.service';
import { describeGithubError } from '../../../core/github/github-errors';
import { GitHubAccountSession, GitHubRepository } from '../../../core/github/models';
import { WatchedRepositoriesService } from '../../../core/repositories/watched-repositories.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-watched-repositories',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './watched-repositories.component.html',
})
export class WatchedRepositoriesComponent {
  private readonly githubApi = inject(GithubApiService);
  private readonly watchedRepositories = inject(WatchedRepositoriesService);

  readonly account = input.required<GitHubAccountSession>();

  protected readonly repositories = computed(() =>
    this.watchedRepositories
      .all()
      .filter((repository) => repository.githubSessionId === this.account().id),
  );
  protected readonly availableRepositories = signal<GitHubRepository[]>([]);
  protected readonly selectableRepositories = computed(() => {
    const watchedIds = new Set(this.repositories().map((repository) => repository.fullName));
    return this.availableRepositories().filter(
      (repository) => !watchedIds.has(repository.fullName),
    );
  });
  protected readonly selectedFullName = signal('');
  protected readonly isLoading = signal(false);
  protected readonly hasLoaded = signal(false);
  protected readonly errorMessage = signal('');

  protected async loadRepositories(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      this.availableRepositories.set(await this.githubApi.getUserRepositories(this.account().id));
      this.hasLoaded.set(true);
    } catch (error) {
      this.errorMessage.set(describeGithubError(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  protected onSelectionChange(event: Event): void {
    this.selectedFullName.set((event.target as HTMLSelectElement).value);
  }

  protected async addSelected(): Promise<void> {
    const repository = this.selectableRepositories().find(
      (candidate) => candidate.fullName === this.selectedFullName(),
    );
    if (!repository) {
      return;
    }
    await this.watchedRepositories.add(this.account().id, repository);
    this.selectedFullName.set('');
  }

  protected async remove(watchedRepositoryId: string): Promise<void> {
    await this.watchedRepositories.remove(watchedRepositoryId);
  }
}
