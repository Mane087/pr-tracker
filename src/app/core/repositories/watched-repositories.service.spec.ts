import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../database/database.service';
import { GitHubRepository } from '../github/models';
import { WatchedRepositoriesService } from './watched-repositories.service';

const repository: GitHubRepository = {
  id: 1,
  owner: 'acme',
  name: 'api',
  fullName: 'acme/api',
  url: 'https://github.com/acme/api',
  isPrivate: true,
  updatedAt: new Date('2026-09-18T10:00:00Z'),
};

describe('WatchedRepositoriesService', () => {
  let service: WatchedRepositoriesService;
  let database: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WatchedRepositoriesService);
    database = TestBed.inject(DatabaseService);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('adds a repository for a session and persists it', async () => {
    const watched = await service.add('work', repository);

    expect(watched.id).toBe('work:acme/api');
    expect(service.forSession('work')).toEqual([watched]);
    expect(service.forSession('personal')).toEqual([]);
    await expect(database.watchedRepositories.get('work:acme/api')).resolves.toEqual(watched);
  });

  it('does not duplicate the same repository for the same session', async () => {
    await service.add('work', repository);
    await service.add('work', repository);

    expect(service.all()).toHaveLength(1);
  });

  it('removes a repository', async () => {
    const watched = await service.add('work', repository);

    await service.remove(watched.id);

    expect(service.all()).toEqual([]);
    await expect(database.watchedRepositories.count()).resolves.toBe(0);
  });

  it('loads persisted repositories', async () => {
    await database.watchedRepositories.put({
      id: 'work:acme/api',
      githubSessionId: 'work',
      owner: 'acme',
      name: 'api',
      fullName: 'acme/api',
      addedAt: new Date('2026-09-18T10:00:00Z'),
    });

    await service.load();

    expect(service.forSession('work')).toHaveLength(1);
  });
});
