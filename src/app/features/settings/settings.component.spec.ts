import 'fake-indexeddb/auto';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DatabaseService } from '../../core/database/database.service';
import { GithubSessionService } from '../../core/github/github-session.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(async () => {
    await TestBed.inject(DatabaseService).delete();
  });

  it('shows the empty state and the add account form when there are no accounts', async () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Todavía no hay cuentas configuradas.');
    expect(compiled.querySelector('app-add-account-form input[type="password"]')).not.toBeNull();
  });

  it('lists restored accounts and asks for their missing tokens', async () => {
    const database = TestBed.inject(DatabaseService);
    await database.githubAccounts.put({ id: 'work', name: 'Trabajo', username: 'mane-work' });
    await TestBed.inject(GithubSessionService).initialize();

    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Trabajo');
    expect(compiled.textContent).toContain('@mane-work');
    expect(compiled.textContent).toContain('Token requerido');
    expect(compiled.querySelector('app-account-token-form')).not.toBeNull();
  });
});
