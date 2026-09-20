import 'fake-indexeddb/auto';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { DatabaseService } from './core/database/database.service';
import { GithubSessionService } from './core/github/github-session.service';
import { THEME_STORAGE_KEY } from './core/theme/theme.service';

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
});
