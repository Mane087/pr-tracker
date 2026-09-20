import 'fake-indexeddb/auto';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DatabaseService } from '../../../core/database/database.service';
import { GITHUB_API_BASE_URL, GITHUB_SESSION_ID } from '../../../core/github/github-api.constants';
import { githubInterceptor } from '../../../core/github/github.interceptor';
import { GithubSessionService } from '../../../core/github/github-session.service';
import { AddReviewPullRequestFormComponent } from './add-review-pull-request-form.component';

const USER_ENDPOINT = `${GITHUB_API_BASE_URL}/user`;
const REPOSITORIES_ENDPOINT = `${GITHUB_API_BASE_URL}/user/repos`;
const FAKE_TOKEN = 'github_pat_FAKE_0000';

function repositoryResponse(fullName: string, id: number) {
  const [owner, name] = fullName.split('/');
  return {
    id,
    name,
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    private: true,
    updated_at: '2026-09-18T10:00:00Z',
    owner: { login: owner },
  };
}

describe('AddReviewPullRequestFormComponent', () => {
  let sessions: GithubSessionService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddReviewPullRequestFormComponent],
      providers: [
        provideHttpClient(withInterceptors([githubInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    sessions = TestBed.inject(GithubSessionService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(async () => {
    httpTesting.verify();
    await TestBed.inject(DatabaseService).delete();
  });

  async function addAccount(name: string, login: string): Promise<string> {
    const pending = sessions.addAccount(name, FAKE_TOKEN);
    httpTesting.expectOne(USER_ENDPOINT).flush({ login, name: null, avatar_url: null });
    return (await pending).id;
  }

  async function render(): Promise<ComponentFixture<AddReviewPullRequestFormComponent>> {
    const fixture = TestBed.createComponent(AddReviewPullRequestFormComponent);
    await fixture.whenStable();
    return fixture;
  }

  function selects(fixture: ComponentFixture<AddReviewPullRequestFormComponent>) {
    const [account, repository] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('select'),
    );
    return { account, repository };
  }

  function optionLabels(select: HTMLSelectElement): string[] {
    return Array.from(select.options).map((option) => option.textContent?.trim() ?? '');
  }

  async function choose(
    fixture: ComponentFixture<AddReviewPullRequestFormComponent>,
    select: HTMLSelectElement,
    value: string,
  ): Promise<void> {
    select.value = value;
    select.dispatchEvent(new Event('input'));
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
  }

  async function flushRepositories(
    fixture: ComponentFixture<AddReviewPullRequestFormComponent>,
    fullNames: string[],
    accountId?: string,
  ): Promise<void> {
    httpTesting
      .expectOne(
        (request) =>
          request.url === REPOSITORIES_ENDPOINT &&
          (accountId === undefined || request.context.get(GITHUB_SESSION_ID) === accountId),
      )
      .flush(fullNames.map((fullName, index) => repositoryResponse(fullName, index + 1)));
    await settle(fixture);
  }

  /** Lets the pending HTTP promise resolve before Angular re-renders. */
  async function settle(
    fixture: ComponentFixture<AddReviewPullRequestFormComponent>,
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  it('loads the repositories of the preselected account into the select', async () => {
    await addAccount('Trabajo', 'mane-work');

    const fixture = await render();
    expect(optionLabels(selects(fixture).repository)).toEqual(['Cargando repositorios…']);

    await flushRepositories(fixture, ['acme/api', 'acme/web']);

    expect(optionLabels(selects(fixture).repository)).toEqual([
      'Selecciona un repositorio',
      'acme/api',
      'acme/web',
    ]);
  });

  it('asks for the token instead of calling GitHub when the account has none', async () => {
    await TestBed.inject(DatabaseService).githubAccounts.put({
      id: 'work',
      name: 'Trabajo',
      username: 'mane-work',
    });
    await sessions.initialize();

    const fixture = await render();

    httpTesting.expectNone((request) => request.url === REPOSITORIES_ENDPOINT);
    expect(optionLabels(selects(fixture).repository)).toEqual(['Ingresa el token de la cuenta']);
  });

  it('reloads the list for the new account and clears the selection when the account changes', async () => {
    const workId = await addAccount('Trabajo', 'mane-work');
    const personalId = await addAccount('Personal', 'mane-personal');

    const fixture = await render();
    expect(selects(fixture).account.value).toBe(workId);
    await flushRepositories(fixture, ['acme/api'], workId);
    await choose(fixture, selects(fixture).repository, 'acme/api');
    expect(selects(fixture).repository.value).toBe('acme/api');

    await choose(fixture, selects(fixture).account, personalId);
    await flushRepositories(fixture, ['personal/blog'], personalId);

    expect(selects(fixture).repository.value).toBe('');
    expect(optionLabels(selects(fixture).repository)).toEqual([
      'Selecciona un repositorio',
      'personal/blog',
    ]);
  });

  it('shows the GitHub error under the field when the list cannot be loaded', async () => {
    await addAccount('Trabajo', 'mane-work');

    const fixture = await render();
    httpTesting
      .expectOne((request) => request.url === REPOSITORIES_ENDPOINT)
      .flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    await settle(fixture);

    const error = (fixture.nativeElement as HTMLElement).querySelector('label .text-danger-ink');
    expect(error?.textContent?.trim()).not.toBe('');
    expect(optionLabels(selects(fixture).repository)).toEqual(['Sin repositorios accesibles']);
  });
});
