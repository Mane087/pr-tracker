import 'fake-indexeddb/auto';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DatabaseService } from '../../core/database/database.service';
import { TrackedPullRequest } from '../../core/database/models';
import { GithubSessionService } from '../../core/github/github-session.service';
import { TrackedPullRequestsService } from '../../core/pull-requests/tracked-pull-requests.service';
import { ReviewComponent } from './review.component';

const NOW = new Date('2026-09-19T12:00:00Z');

function buildPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  return {
    id: 'work:acme/api#561',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 561,
    title: 'Detect expired certificate',
    url: 'https://github.com/acme/api/pull/561',
    author: 'colleague',
    labels: [],
    category: 'REVIEW',
    status: 'PENDING',
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

describe('ReviewComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(async () => {
    await TestBed.inject(DatabaseService).delete();
  });

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

  async function render(): Promise<ComponentFixture<ReviewComponent>> {
    const fixture = TestBed.createComponent(ReviewComponent);
    await fixture.whenStable();
    return fixture;
  }

  function textOf(fixture: ComponentFixture<ReviewComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('asks to configure an account and hides the empty queue hint when there is no account', async () => {
    const fixture = await render();

    expect(textOf(fixture)).toContain('Configura una cuenta de GitHub en');
    expect(textOf(fixture)).not.toContain('Todavía no sigues Pull Requests para revisar');
  });

  it('shows the empty queue hint for a restored account before its token is entered', async () => {
    await restoreAccountWithoutToken();

    const fixture = await render();

    expect(textOf(fixture)).toContain('Todavía no sigues Pull Requests para revisar');
  });

  it('keeps the no-match message when filters hide every pull request', async () => {
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

  it('summarizes several pull requests with how many need review', async () => {
    await restoreAccountWithoutToken();
    await storePullRequests(
      buildPullRequest({ id: 'work:acme/api#1', number: 1, status: 'NEEDS_REVIEW' }),
      buildPullRequest({ id: 'work:acme/api#2', number: 2, status: 'NEEDS_REVIEW' }),
      buildPullRequest({ id: 'work:acme/api#3', number: 3, status: 'REVIEWED' }),
      buildPullRequest({ id: 'work:acme/api#4', number: 4, isArchived: true }),
    );

    const fixture = await render();

    expect(textOf(fixture)).toContain('3 Pull Requests que sigues · 2 necesitan revisión');
  });

  it('summarizes one pull request that needs review in singular', async () => {
    await restoreAccountWithoutToken();
    await storePullRequests(buildPullRequest({ status: 'NEEDS_REVIEW' }));

    const fixture = await render();

    expect(textOf(fixture)).toContain('1 Pull Request que sigues · 1 necesita revisión');
  });
});
