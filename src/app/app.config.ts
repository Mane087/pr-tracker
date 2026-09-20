import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { githubInterceptor } from './core/github/github.interceptor';
import { GithubSessionService } from './core/github/github-session.service';
import { TrackedPullRequestsService } from './core/pull-requests/tracked-pull-requests.service';
import { RefreshService } from './core/refresh/refresh.service';
import { WatchedRepositoriesService } from './core/repositories/watched-repositories.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([githubInterceptor])),
    provideAppInitializer(() =>
      Promise.all([
        inject(GithubSessionService).initialize(),
        inject(TrackedPullRequestsService).load(),
        inject(WatchedRepositoriesService).load(),
        inject(RefreshService).initialize(),
      ]).then(() => undefined),
    ),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
