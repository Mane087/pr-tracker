import { computed, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'pr-tracker.theme';

const THEMES: readonly Theme[] = ['light', 'dark', 'system'];

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme);
}

/** Theme preference is not sensitive, so it may live in localStorage (see plan, section 30). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = this.document.defaultView?.localStorage;
  private readonly systemPrefersDark = signal(false);

  readonly theme = signal<Theme>(this.readStoredTheme());
  readonly isDark = computed(() => {
    const theme = this.theme();
    return theme === 'dark' || (theme === 'system' && this.systemPrefersDark());
  });

  constructor() {
    this.observeSystemPreference();

    effect(() => {
      this.document.documentElement.classList.toggle('dark', this.isDark());
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    this.persistTheme(theme);
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  private observeSystemPreference(): void {
    const mediaQuery = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) {
      return;
    }

    this.systemPrefersDark.set(mediaQuery.matches);
    mediaQuery.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));
  }

  private readStoredTheme(): Theme {
    try {
      const storedTheme = this.storage?.getItem(THEME_STORAGE_KEY);
      return isTheme(storedTheme) ? storedTheme : 'system';
    } catch {
      return 'system';
    }
  }

  private persistTheme(theme: Theme): void {
    try {
      this.storage?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode, blocked site data). The in-memory signal still works.
    }
  }
}
