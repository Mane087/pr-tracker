import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { GithubSessionService } from './core/github/github-session.service';
import { TrackedPullRequestsService } from './core/pull-requests/tracked-pull-requests.service';
import { AppUpdateService } from './core/pwa/app-update.service';
import { RefreshService } from './core/refresh/refresh.service';
import { ThemeService } from './core/theme/theme.service';
import { IconComponent } from './shared/components/icon/icon.component';

interface RefreshSummaryItem {
  label: string;
  dotClass: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly sessions = inject(GithubSessionService);
  protected readonly refresh = inject(RefreshService);
  protected readonly appUpdate = inject(AppUpdateService);
  private readonly trackedPullRequests = inject(TrackedPullRequestsService);

  protected readonly workCount = computed(() => this.trackedPullRequests.work().length);
  protected readonly reviewCount = computed(() => this.trackedPullRequests.review().length);

  protected readonly activeAccountInitial = computed(() =>
    (this.sessions.activeAccount()?.name ?? '?').charAt(0).toUpperCase(),
  );

  protected readonly refreshSummaryItems = computed<RefreshSummaryItem[]>(() => {
    const summary = this.refresh.lastSummary();
    if (!summary) {
      return [];
    }
    const items: RefreshSummaryItem[] = [
      { label: `${summary.refreshedCount} sincronizados`, dotClass: 'bg-success-dot' },
    ];
    if (summary.attentionCount > 0) {
      items.push({
        label: `${summary.attentionCount} con atención`,
        dotClass: 'bg-attention-icon',
      });
    }
    if (summary.archivedCount > 0) {
      items.push({ label: `${summary.archivedCount} archivados`, dotClass: 'bg-neutral-dot' });
    }
    if (summary.failedCount > 0) {
      items.push({ label: `${summary.failedCount} con error`, dotClass: 'bg-danger-dot' });
    }
    return items;
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
