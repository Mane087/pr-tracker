import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  it('stays silent when the service worker is not available', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(AppUpdateService).isUpdateAvailable()).toBe(false);
  });

  it('reports when a new version is ready', () => {
    const versionUpdates = new Subject<VersionEvent>();
    TestBed.configureTestingModule({
      providers: [{ provide: SwUpdate, useValue: { isEnabled: true, versionUpdates } }],
    });
    const service = TestBed.inject(AppUpdateService);

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'a' } });
    expect(service.isUpdateAvailable()).toBe(false);

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    expect(service.isUpdateAvailable()).toBe(true);
  });
});
