import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  Priority,
  TrackedPullRequest,
  TrackedPullRequestStatus,
} from '../../../core/database/models';
import { WORK_STATUS_OPTIONS } from '../../pull-request-labels';
import { PullRequestCardComponent } from './pull-request-card.component';

function buildPullRequest(overrides: Partial<TrackedPullRequest> = {}): TrackedPullRequest {
  const now = new Date('2026-09-19T12:00:00Z');
  return {
    id: 'work:acme/api#501',
    githubSessionId: 'work',
    owner: 'acme',
    repository: 'api',
    number: 501,
    title: 'Fix token manager',
    url: 'https://github.com/acme/api/pull/501',
    author: 'mane-work',
    labels: [{ name: 'bug', color: 'd73a4a' }],
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

@Component({
  imports: [PullRequestCardComponent],
  template: `
    <app-pull-request-card
      [pullRequest]="pullRequest()"
      [statusOptions]="statusOptions"
      accountName="Trabajo"
      (statusChange)="lastStatus = $event"
      (priorityChange)="lastPriority = $event"
    />
  `,
})
class HostComponent {
  readonly pullRequest = signal(buildPullRequest());
  readonly statusOptions = WORK_STATUS_OPTIONS;
  lastStatus?: TrackedPullRequestStatus;
  lastPriority?: Priority;
}

describe('PullRequestCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  it('renders repository, number, title, account and labels', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('acme/api · #501');
    expect(compiled.textContent).toContain('Trabajo');
    expect(compiled.querySelector('h3 a')?.textContent?.trim()).toBe('Fix token manager');
    expect(compiled.querySelector('h3 a')?.getAttribute('href')).toBe(
      'https://github.com/acme/api/pull/501',
    );
    expect(compiled.querySelector('ul[aria-label="Labels"]')?.textContent).toContain('bug');
  });

  it('preselects the current status and priority', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select');

    expect(selects[0].value).toBe('PAUSED');
    expect(selects[1].value).toBe('P2');
  });

  it('emits status and priority changes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select');

    selects[0].value = 'CURRENT';
    selects[0].dispatchEvent(new Event('change'));
    selects[1].value = 'P3';
    selects[1].dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.lastStatus).toBe('CURRENT');
    expect(fixture.componentInstance.lastPriority).toBe('P3');
  });

  it('shows the status label as a pill and the priority as filled bars', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.pullRequest.set(
      buildPullRequest({ status: 'CURRENT', priority: 'P3' }),
    );
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const pill = compiled.querySelector('.pill');
    expect(pill?.textContent?.trim()).toBe('En curso');
    expect(pill?.classList).toContain('bg-success-soft');

    const bars = () =>
      compiled.querySelectorAll('[title^="Prioridad"] [aria-hidden="true"] > span');
    expect(bars()).toHaveLength(4);
    expect(Array.from(bars()).every((bar) => bar.classList.contains('bg-priority-3'))).toBe(true);
    expect(compiled.querySelector('[title="Prioridad P3 · Alta"]')).not.toBeNull();

    fixture.componentInstance.pullRequest.set(
      buildPullRequest({ status: 'POSTPONED', priority: 'P0' }),
    );
    await fixture.whenStable();

    expect(compiled.querySelector('.pill')?.textContent?.trim()).toBe('Pospuesto');
    expect(compiled.querySelector('.pill')?.classList).toContain('border-dashed');
    const filled = Array.from(bars()).filter((bar) => bar.classList.contains('bg-priority-0'));
    const empty = Array.from(bars()).filter((bar) => bar.classList.contains('bg-line-strong'));
    expect(filled).toHaveLength(1);
    expect(empty).toHaveLength(3);
  });

  it('shows the attention indicator with a summary of the reasons', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.pullRequest.set(
      buildPullRequest({
        isAttentionRequired: true,
        attentionReasons: ['NEW_COMMITS', 'NEW_COMMENTS'],
        commitCount: 2,
        lastKnownCommitCount: 0,
        issueCommentCount: 3,
        lastKnownIssueCommentCount: 1,
      }),
    );
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[aria-label="Requiere atención"]')).not.toBeNull();
    expect(compiled.textContent).toContain('2 commits nuevos · 2 comentarios nuevos');
  });
});
