import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  function createService(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  it('defaults to the system theme when nothing is stored', () => {
    const service = createService();

    expect(service.theme()).toBe('system');
  });

  it('restores the stored theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const service = createService();

    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blue');

    const service = createService();

    expect(service.theme()).toBe('system');
  });

  it('applies the dark class to the document root and persists the choice', () => {
    const service = createService();

    service.setTheme('dark');
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('removes the dark class when switching back to light', () => {
    const service = createService();

    service.setTheme('dark');
    TestBed.tick();
    service.setTheme('light');
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles between light and dark based on the effective theme', () => {
    const service = createService();

    service.toggle();
    expect(service.theme()).toBe('dark');

    service.toggle();
    expect(service.theme()).toBe('light');
  });
});
