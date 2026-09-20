import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { GithubSessionService } from './core/github/github-session.service';
import { AppUpdateService } from './core/pwa/app-update.service';
import { RefreshService } from './core/refresh/refresh.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly sessions = inject(GithubSessionService);
  protected readonly refresh = inject(RefreshService);
  protected readonly appUpdate = inject(AppUpdateService);

  protected readonly refreshSummaryText = computed(() => {
    const summary = this.refresh.lastSummary();
    if (!summary) {
      return '';
    }
    const parts = [`${summary.refreshedCount} sincronizados`];
    if (summary.attentionCount > 0) {
      parts.push(`${summary.attentionCount} con atención`);
    }
    if (summary.archivedCount > 0) {
      parts.push(`${summary.archivedCount} archivados`);
    }
    if (summary.failedCount > 0) {
      parts.push(`${summary.failedCount} con error`);
    }
    return parts.join(' · ');
  });

  protected readonly sessionErrorMessages = computed(() =>
    [...this.refresh.sessionErrors()].map(([accountId, message]) => ({
      accountId,
      accountName:
        this.sessions.accounts().find((account) => account.id === accountId)?.name ?? accountId,
      message,
    })),
  );

  protected refreshAll(): void {
    void this.refresh.refreshAll();
  }

  protected onAccountChange(event: Event): void {
    const accountId = (event.target as HTMLSelectElement).value;
    void this.sessions.setActiveSession(accountId === '' ? null : accountId);
  }
}
