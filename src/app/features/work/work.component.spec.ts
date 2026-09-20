import 'fake-indexeddb/auto';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DatabaseService } from '../../core/database/database.service';
import { TrackedPullRequest, WatchedRepository } from '../../core/database/models';
import { GithubSessionService } from '../../core/github/github-session.service';
import { TrackedPullRequestsService } from '../../core/pull-requests/tracked-pull-requests.service';
import { WatchedRepositoriesService } from '../../core/repositories/watched-repositories.service';
import { WorkComponent } from './work.component';

const NOW = new Date('2026-09-19T12:00:00Z');

function buildPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  return {
    id: 'work:acme/api#501',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 501,
    title: 'Fix token manager',
    url: 'https://github.com/acme/api/pull/501',
    author: 'mane-work',
    labels: [],
    category: 'WORK',
    status: 'PAUSED',
    priority: 'P2',
    headSha: 'abc',
    issueCommentCount: 0,
    reviewCommentCount: 0,
    reviewCount: 0,
    commitCount: 0,
    lastKnownIssueCommentCount: 0,
    lastKnownReviewCommentCount: 0,
    lastKnownReviewCount: 0,
    lastKnownCommitCount: 0,
    isAttentionRequired: false,
    attentionReasons: [],
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildWatchedRepository(githubSessionId: string, fullName: string): WatchedRepository {
  const [owner, name] = fullName.split('/');
  return {
    id: `${githubSessionId}:${fullName}`,
    githubSessionId,
    owner,
    name,
    fullName,
    addedAt: NOW,
  };
}

describe('WorkComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(async () => {
    await TestBed.inject(DatabaseService).delete();
  });

  /** Mirrors a reload: the account metadata is restored but its token is gone. */
  async function restoreAccountWithoutToken(): Promise<void> {
    await TestBed.inject(DatabaseService).githubAccounts.put({
      id: 'work',
      name: 'Trabajo',
      username: 'mane-work',
    });
    await TestBed.inject(GithubSessionService).initialize();
  }

  async function storePullRequests(...pullRequests: TrackedPullRequest[]): Promise<void> {
    await TestBed.inject(DatabaseService).trackedPullRequests.bulkPut(pullRequests);
    await TestBed.inject(TrackedPullRequestsService).load();
  }

  async function render(): Promise<ComponentFixture<WorkComponent>> {
    const fixture = TestBed.createComponent(WorkComponent);
    await fixture.whenStable();
    return fixture;
  }

  function textOf(fixture: ComponentFixture<WorkComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('asks to configure an account and hides the empty queue hint when there is no account', async () => {
    const fixture = await render();

    expect(textOf(fixture)).toContain('Configura una cuenta de GitHub en');
    expect(textOf(fixture)).not.toContain('Todavía no hay Pull Requests en trabajo');
  });

  it('shows the empty queue hint for a restored account before its token is entered', async () => {
    await restoreAccountWithoutToken();

    const fixture = await render();

    expect(textOf(fixture)).toContain('Todavía no hay Pull Requests en trabajo');
    expect(textOf(fixture)).not.toContain('Configura una cuenta de GitHub en');
  });

  it('keeps the no-match message when filters hide every pull request of an account without token', async () => {
    await restoreAccountWithoutToken();
    await storePullRequests(buildPullRequest({}));
    const fixture = await render();
    const compiled = fixture.nativeElement as HTMLElement;

    const search = compiled.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search).not.toBeNull();
    search!.value = 'no such pull request';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(compiled.querySelectorAll('article')).toHaveLength(0);
    expect(textOf(fixture)).toContain('Ningún Pull Request coincide con los filtros.');
  });

  it('summarizes several pull requests with the number in progress', async () => {
    await restoreAccountWithoutToken();
    await storePullRequests(
      buildPullRequest({ id: 'work:acme/api#501', number: 501, status: 'CURRENT' }),
      buildPullRequest({ id: 'work:acme/api#502', number: 502, status: 'PAUSED' }),
      buildPullRequest({ id: 'work:acme/api#503', number: 503, isArchived: true }),
    );

    const fixture = await render();

    expect(textOf(fixture)).toContain('2 Pull Requests tuyos · 1 en curso');
  });

  it('summarizes a single pull request in singular', async () => {
    await restoreAccountWithoutToken();
    await storePullRequests(buildPullRequest({ status: 'POSTPONED' }));

    const fixture = await render();

    expect(textOf(fixture)).toContain('1 Pull Request tuyo · 0 en curso');
  });

  it('counts only the watched repositories of the active account', async () => {
    await restoreAccountWithoutToken();
    await TestBed.inject(DatabaseService).watchedRepositories.bulkPut([
      buildWatchedRepository('work', 'acme/api'),
      buildWatchedRepository('work', 'acme/web'),
      buildWatchedRepository('other', 'acme/api'),
    ]);
    await TestBed.inject(WatchedRepositoriesService).load();

    const fixture = await render();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('button .badge');

    expect(badge?.textContent?.trim()).toBe('2');
  });
});
