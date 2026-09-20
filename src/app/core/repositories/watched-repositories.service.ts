import { inject, Injectable, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { WatchedRepository } from '../database/models';
import { GitHubRepository } from '../github/models';

export function buildWatchedRepositoryId(
  githubSessionId: string,
  owner: string,
  name: string,
): string {
  return `${githubSessionId}:${owner}/${name}`;
}

/** Repositories selected by the user, per account, whose open pull requests feed the Work section. */
@Injectable({ providedIn: 'root' })
export class WatchedRepositoriesService {
  private readonly database = inject(DatabaseService);
  private readonly repositoriesState = signal<WatchedRepository[]>([]);

  readonly all = this.repositoriesState.asReadonly();

  async load(): Promise<void> {
    this.repositoriesState.set(await this.database.watchedRepositories.toArray());
  }

  forSession(githubSessionId: string): WatchedRepository[] {
    return this.repositoriesState().filter(
      (repository) => repository.githubSessionId === githubSessionId,
    );
  }

  async add(githubSessionId: string, repository: GitHubRepository): Promise<WatchedRepository> {
    const watched: WatchedRepository = {
      id: buildWatchedRepositoryId(githubSessionId, repository.owner, repository.name),
      githubSessionId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      addedAt: new Date(),
    };

    await this.database.watchedRepositories.put(watched);
    this.repositoriesState.update((repositories) => [
      ...repositories.filter((current) => current.id !== watched.id),
      watched,
    ]);

    return watched;
  }

  async remove(watchedRepositoryId: string): Promise<void> {
    await this.database.watchedRepositories.delete(watchedRepositoryId);
    this.repositoriesState.update((repositories) =>
      repositories.filter((current) => current.id !== watchedRepositoryId),
    );
  }
}
