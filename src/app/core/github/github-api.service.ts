import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, of, throwError } from 'rxjs';

import { GITHUB_API_BASE_URL, GITHUB_SESSION_ID } from './github-api.constants';
import {
  toGitHubPullRequest,
  toGitHubPullRequestSummary,
  toGitHubRepository,
  toGitHubReview,
  toGitHubUser,
} from './github-api.mappers';
import { GitHubApiError, GitHubRateLimitError } from './github-errors';
import {
  ConditionalResponse,
  GitHubPullRequest,
  GitHubPullRequestSummary,
  GitHubRateLimit,
  GitHubRepository,
  GitHubReview,
  GitHubUser,
} from './models';
import {
  GitHubPullRequestResponse,
  GitHubPullRequestSummaryResponse,
  GitHubRepositoryResponse,
  GitHubReviewResponse,
  GitHubUserResponse,
} from './models/github-api-responses';

const PAGE_SIZE = 100;

interface RequestOptions {
  params?: Record<string, string | number>;
  /** Sent as `If-None-Match`; a 304 answer is reported as `isModified: false`. */
  etag?: string;
}

/**
 * Every GitHub endpoint goes through this service. Callers never handle tokens: the session id travels
 * in the request context and the interceptor attaches the token.
 *
 * Lists are limited to a single page of 100 items, which is enough for the personal scope of the app.
 */
@Injectable({ providedIn: 'root' })
export class GithubApiService {
  private readonly http = inject(HttpClient);
  private readonly rateLimitsState = signal<ReadonlyMap<string, GitHubRateLimit>>(new Map());

  /** Latest rate limit reported by GitHub, per session. */
  readonly rateLimits = this.rateLimitsState.asReadonly();

  getCurrentUser(sessionId: string): Promise<GitHubUser> {
    return this.getData<GitHubUserResponse>(sessionId, '/user').then(toGitHubUser);
  }

  getUserRepositories(sessionId: string): Promise<GitHubRepository[]> {
    return this.getData<GitHubRepositoryResponse[]>(sessionId, '/user/repos', {
      params: {
        per_page: PAGE_SIZE,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member',
      },
    }).then((repositories) => repositories.map(toGitHubRepository));
  }

  getOpenPullRequests(
    sessionId: string,
    owner: string,
    repository: string,
  ): Promise<GitHubPullRequestSummary[]> {
    return this.getData<GitHubPullRequestSummaryResponse[]>(
      sessionId,
      `/repos/${owner}/${repository}/pulls`,
      {
        params: { state: 'open', per_page: PAGE_SIZE, sort: 'updated', direction: 'desc' },
      },
    ).then((pullRequests) => pullRequests.map(toGitHubPullRequestSummary));
  }

  getPullRequest(
    sessionId: string,
    owner: string,
    repository: string,
    pullNumber: number,
    etag?: string,
  ): Promise<ConditionalResponse<GitHubPullRequest>> {
    return this.getConditional<GitHubPullRequestResponse, GitHubPullRequest>(
      sessionId,
      `/repos/${owner}/${repository}/pulls/${pullNumber}`,
      toGitHubPullRequest,
      etag,
    );
  }

  getPullRequestReviews(
    sessionId: string,
    owner: string,
    repository: string,
    pullNumber: number,
    etag?: string,
  ): Promise<ConditionalResponse<GitHubReview[]>> {
    return this.getConditional<GitHubReviewResponse[], GitHubReview[]>(
      sessionId,
      `/repos/${owner}/${repository}/pulls/${pullNumber}/reviews`,
      (reviews) => reviews.map(toGitHubReview),
      etag,
      { per_page: PAGE_SIZE },
    );
  }

  private async getData<TResponse>(
    sessionId: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<TResponse> {
    const response = await firstValueFrom(this.get<TResponse>(sessionId, path, options));
    if (!response.isModified) {
      // Without an etag GitHub never answers 304, so this branch is unreachable in practice.
      throw new GitHubApiError(304, path, 'GitHub respondió sin contenido.');
    }
    return response.data;
  }

  private getConditional<TResponse, TResult>(
    sessionId: string,
    path: string,
    mapResponse: (response: TResponse) => TResult,
    etag: string | undefined,
    params?: RequestOptions['params'],
  ): Promise<ConditionalResponse<TResult>> {
    return firstValueFrom(
      this.get<TResponse>(sessionId, path, { etag, params }).pipe(
        map((response): ConditionalResponse<TResult> =>
          response.isModified
            ? { isModified: true, data: mapResponse(response.data), etag: response.etag }
            : response,
        ),
      ),
    );
  }

  private get<TResponse>(
    sessionId: string,
    path: string,
    options: RequestOptions,
  ): Observable<ConditionalResponse<TResponse>> {
    const context = new HttpContext().set(GITHUB_SESSION_ID, sessionId);
    const headers = options.etag ? new HttpHeaders({ 'If-None-Match': options.etag }) : undefined;

    return this.http
      .get<TResponse>(`${GITHUB_API_BASE_URL}${path}`, {
        context,
        headers,
        params: options.params,
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<TResponse>): ConditionalResponse<TResponse> => {
          this.recordRateLimit(sessionId, response.headers);
          return {
            isModified: true,
            data: response.body as TResponse,
            etag: response.headers.get('etag') ?? undefined,
          };
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            this.recordRateLimit(sessionId, error.headers);
            if (error.status === 304) {
              return of<ConditionalResponse<TResponse>>({
                isModified: false,
                etag: error.headers.get('etag') ?? options.etag,
              });
            }
          }
          return throwError(() => normalizeError(error, path));
        }),
      );
  }

  private recordRateLimit(sessionId: string, headers: HttpHeaders): void {
    const rateLimit = readRateLimit(headers);
    if (!rateLimit) {
      return;
    }
    this.rateLimitsState.update((rateLimits) => new Map(rateLimits).set(sessionId, rateLimit));
  }
}

function readRateLimit(headers: HttpHeaders): GitHubRateLimit | undefined {
  const limit = Number(headers.get('x-ratelimit-limit'));
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const resetSeconds = Number(headers.get('x-ratelimit-reset'));

  if (
    !headers.has('x-ratelimit-remaining') ||
    !Number.isFinite(remaining) ||
    !Number.isFinite(resetSeconds)
  ) {
    return undefined;
  }

  return {
    limit: Number.isFinite(limit) ? limit : 0,
    remaining,
    resetAt: new Date(resetSeconds * 1000),
  };
}

function readRateLimitReset(error: HttpErrorResponse): Date | undefined {
  const retryAfterSeconds = Number(error.headers.get('retry-after'));
  if (error.headers.has('retry-after') && Number.isFinite(retryAfterSeconds)) {
    return new Date(Date.now() + retryAfterSeconds * 1000);
  }

  const rateLimit = readRateLimit(error.headers);
  return rateLimit && rateLimit.remaining === 0 ? rateLimit.resetAt : undefined;
}

function describeStatus(status: number): string {
  switch (status) {
    case 0:
      return 'No fue posible conectar con GitHub.';
    case 401:
      return 'El token no es válido o expiró.';
    case 403:
      return 'GitHub rechazó la petición. Revisa los permisos del token.';
    case 404:
      return 'El recurso no existe o el token no tiene acceso a él.';
    case 422:
      return 'GitHub no aceptó los parámetros de la petición.';
    default:
      return `GitHub respondió con el estado ${status}.`;
  }
}

function normalizeError(error: unknown, endpoint: string): Error {
  if (error instanceof HttpErrorResponse) {
    // Only status and endpoint are kept: headers and the request itself must never be stored or shown.
    if (error.status === 403 || error.status === 429) {
      const resetAt = readRateLimitReset(error);
      if (resetAt) {
        return new GitHubRateLimitError(error.status, endpoint, resetAt);
      }
    }
    return new GitHubApiError(error.status, endpoint, describeStatus(error.status));
  }
  return error instanceof Error ? error : new Error('Error desconocido al llamar a GitHub.');
}
