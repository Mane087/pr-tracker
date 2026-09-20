import 'fake-indexeddb/auto';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { DatabaseService } from './core/database/database.service';
import { TrackedPullRequest } from './core/database/models';
import { GithubSessionService } from './core/github/github-session.service';
import { TrackedPullRequestsService } from './core/pull-requests/tracked-pull-requests.service';
import { RefreshService } from './core/refresh/refresh.service';
import { THEME_STORAGE_KEY } from './core/theme/theme.service';

function buildPullRequest(overrides: Partial<TrackedPullRequest>): TrackedPullRequest {
  const now = new Date('2026-09-19T12:00:00Z');
  return {
    id: 'work:acme/api#1',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 1,
    title: 'PR',
    url: 'https://github.com/acme/api/pull/1',
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AppComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(async () => {
    await TestBed.inject(DatabaseService).delete();
  });

  it('renders the application title', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('PR Tracker');
  });

  it('renders the Trabajo and Revisión tabs', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const tabLabels = Array.from(compiled.querySelectorAll('nav a')).map((link) =>
      link.textContent?.trim(),
    );

    expect(tabLabels).toEqual(['Trabajo', 'Revisión']);
  });

  it('toggles the theme from the header button', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('header button[aria-label^="Usar tema"]')?.click();
    await fixture.whenStable();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('hides the account selector until an account exists', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('header select')).toBeNull();
  });

  it('shows the missing token notice for restored accounts', async () => {
    await TestBed.inject(DatabaseService).githubAccounts.put({
      id: 'work',
      name: 'Trabajo',
      username: 'mane-work',
    });
    await TestBed.inject(GithubSessionService).initialize();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="status"]')?.textContent).toContain('Falta el token de');
    expect(compiled.querySelector('[role="status"]')?.textContent).toContain('Trabajo');
    expect(compiled.querySelectorAll('header select option')).toHaveLength(1);
  });

  it('marks accounts without token in the selector and hides the decorative initial', async () => {
    await TestBed.inject(DatabaseService).githubAccounts.put({
      id: 'work',
      name: 'Trabajo',
      username: 'mane-work',
    });
    await TestBed.inject(GithubSessionService).initialize();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('header select option')?.textContent?.trim()).toBe(
      'Trabajo · token requerido',
    );
    const initial = compiled.querySelector('header label span[aria-hidden="true"]');
    expect(initial?.textContent?.trim()).toBe('T');
    expect(compiled.querySelector('header label')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Cuenta de GitHub',
    );
  });

  it('shows the number of active pull requests of each section in its tab', async () => {
    await TestBed.inject(DatabaseService).trackedPullRequests.bulkPut([
      buildPullRequest({ id: 'work:acme/api#1', number: 1 }),
      buildPullRequest({ id: 'work:acme/api#2', number: 2 }),
      buildPullRequest({ id: 'work:acme/api#3', number: 3, isArchived: true }),
      buildPullRequest({ id: 'work:acme/api#4', number: 4, category: 'REVIEW', status: 'PENDING' }),
    ]);
    await TestBed.inject(TrackedPullRequestsService).load();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const badges = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav a .badge'),
    ).map((badge) => badge.textContent?.trim());

    expect(badges).toEqual(['2', '1']);
  });

  it('lists every refresh summary item, including failures', async () => {
    TestBed.overrideProvider(RefreshService, {
      useValue: {
        isRefreshing: signal(false),
        lastRefreshedAt: signal(new Date('2026-09-20T14:00:00Z')),
        sessionErrors: signal(new Map<string, string>()),
        lastSummary: signal({
          refreshedCount: 3,
          attentionCount: 2,
          archivedCount: 1,
          failedCount: 1,
        }),
        canRefresh: signal(false),
        refreshAll: jest.fn(),
      },
    });

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const summary =
      Array.from(compiled.querySelectorAll('p'))
        .map((paragraph) => paragraph.textContent?.replace(/\s+/g, ' ') ?? '')
        .find((text) => text.includes('Última actualización:')) ?? '';

    expect(summary).not.toBe('');
    expect(summary).toContain('3 sincronizados');
    expect(summary).toContain('2 con atención');
    expect(summary).toContain('1 archivados');
    expect(summary).toContain('1 con error');
    expect(summary).toContain('3 sincronizados 2 con atención 1 archivados 1 con error');
    expect(compiled.querySelector('.bg-danger-dot')).not.toBeNull();
  });
});
