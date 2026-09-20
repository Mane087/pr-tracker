import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';

import { GITHUB_API_BASE_URL, GITHUB_API_VERSION, GITHUB_SESSION_ID } from './github-api.constants';
import { MissingSessionTokenError } from './github-errors';
import { GithubSessionService } from './github-session.service';

/**
 * Attaches the in-memory token of the session named in the request context.
 * The token is read here and nowhere else; it is never logged.
 */
export const githubInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionId = request.context.get(GITHUB_SESSION_ID);

  if (sessionId === null || !request.url.startsWith(GITHUB_API_BASE_URL)) {
    return next(request);
  }

  const token = inject(GithubSessionService).getToken(sessionId);

  if (!token) {
    return throwError(() => new MissingSessionTokenError(sessionId));
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    }),
  );
};
