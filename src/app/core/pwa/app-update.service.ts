import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Tells the shell when a new build of the PWA is ready. Reloading is left to the user (plan, section 48). */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly document = inject(DOCUMENT);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly isUpdateAvailableState = signal(false);

  readonly isUpdateAvailable = this.isUpdateAvailableState.asReadonly();

  constructor() {
    if (!this.swUpdate?.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.isUpdateAvailableState.set(true));
  }

  reload(): void {
    this.document.defaultView?.location.reload();
  }
}
