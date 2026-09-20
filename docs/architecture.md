# Architecture

PR Tracker is an Angular PWA that organizes Pull Requests from multiple GitHub accounts into a personal work and review queue. It does not replace GitHub: code review, comments, approvals and merges stay in GitHub. The application only tracks state that is personal to the user.

## Stack

- Angular with Signals, zoneless change detection and `HttpClient`.
- Angular service worker (PWA).
- IndexedDB through Dexie for local persistence.
- GitHub REST API with fine-grained Personal Access Tokens.
- pnpm as package manager.

There is no backend.

## Remote state vs local state

Remote state comes from GitHub and is never edited locally: number, title, labels, author, state, head SHA, comment and review counts, merged and closed flags.

Local state belongs to the user's workflow and is never written back to GitHub: priority, personal status, section (work or review), last reviewed SHA, last acknowledged counters, attention flags, last sync date and the associated GitHub account.

## Sessions and tokens

Each GitHub account is a session with its own token. Several sessions coexist in memory at the same time, and every request selects the token by the `githubSessionId` of the resource it touches.

Tokens live only in RAM. They are never stored in `localStorage`, `sessionStorage`, IndexedDB, cookies or files. Closing or reloading the application discards them and the user must enter them again. Only non-sensitive account metadata (id, name, username, avatar URL) is persisted.

Tokens should be created with the minimum permissions: repository access limited to selected repositories, `Metadata: Read` and `Pull requests: Read`.

Implementation notes:

- `GithubSessionService` keeps tokens in a private in-memory map and exposes only account metadata plus a `hasToken` flag.
- `githubInterceptor` reads the session id from the `HttpContext` of each request and attaches the bearer token. No other code touches tokens.
- Re-entering a token after a reload validates that the GitHub login matches the stored account.
- HTTP failures are normalized to `GitHubApiError` with status and endpoint only; headers are never kept.
- Accounts are managed in the `/settings` route.

## GitHub API access

`GithubApiService` is the only place that calls GitHub. It exposes typed methods (`getCurrentUser`, `getUserRepositories`, `getOpenPullRequests`, `getPullRequest`, `getPullRequestReviews`) and maps raw payloads to domain models.

- The single pull request endpoint already returns comment, review comment and commit counters plus the head SHA, so no extra endpoints are needed to detect changes.
- `getPullRequest` and `getPullRequestReviews` accept the previous `ETag` and send `If-None-Match`. A `304` answer is reported as `isModified: false` and does not consume rate limit.
- Rate limit headers of every response are recorded per session in `rateLimits`. A `403` or `429` with the limit exhausted becomes a `GitHubRateLimitError` with the reset time.
- Lists are limited to one page of 100 items.

## Sections

- **Work**: Pull Requests created by the user, imported from the repositories the user watches per account. Statuses: `CURRENT`, `PAUSED`, `POSTPONED`. Only one `CURRENT` per session; marking another as `CURRENT` pauses the previous one. Imported PRs start as `PAUSED` with priority `P2`.
- **Review**: Pull Requests the user chose to follow, added by account, repository and number. Statuses: `PENDING`, `REVIEWING`, `REVIEWED`, `NEEDS_REVIEW`. Marking a PR as reviewed stores a `ReviewSnapshot` with the reviewed head SHA and counters, and acknowledges all current activity.

Both sections use priorities `P0` to `P3`, where `P3` is the highest.

## Refresh

Refresh is manual. For every tracked Pull Request the application fetches the remote state, compares it with the last known state and updates local flags:

- new head SHA on a `REVIEWED` PR changes its status to `NEEDS_REVIEW`;
- new comments or reviews set `attentionRequired` with the reason;
- merged or closed PRs are archived, not deleted.

Requests are grouped by session so each one uses its own token.

Implementation notes (`core/refresh`):

- `syncPullRequest` is a pure function that applies the remote state to a local record. New commits are flagged only on Review pull requests; new comments and reviews are flagged in both sections; merged or closed pull requests are archived. Reasons accumulate until the user presses "Visto", which acknowledges the current counters without changing the status.
- `RefreshService` sends the stored `ETag`s, runs at most four requests per session, shares a single in-flight refresh, and stops a session on rate limit, missing token or 401 while reporting the error per account. The last refresh time is persisted in `settings`.

## Presentation notes

- Visual tokens live in `src/styles.css`: semantic CSS variables on `:root` and `.dark` (canvas, surface, ink, primary, attention, success, review, danger, priority) exposed to Tailwind through `@theme inline`, plus a small set of component classes (`btn`, `icon-btn`, `field`, `card`, `pill`, `chip`, `tab`, `badge`, `switch`, `notice`). Fonts are self-hosted from `@fontsource` because the CSP does not allow Google Fonts.
- Icons are single SVG files under `public/assets/icons`, rendered by `shared/components/icon` as a CSS mask so they take `currentColor` in both themes. They are decorative (`aria-hidden`); the surrounding control provides the accessible name.
- Each queue has a filter bar (`shared/components/pull-request-filters`) backed by the pure `filterAndSortPullRequests`: search, status, account, attention only, and sort by priority, last update or number. Pull requests that require attention are always listed first.
- The shell shows the refresh button, the last refresh time with a summary, per-account sync errors and a banner when a new PWA version is ready (`core/pwa/AppUpdateService`).

## Local data services

- `TrackedPullRequestsService` (`core/pull-requests`) mirrors the `trackedPullRequests` table in a signal and persists every change before updating it. It exposes the sorted `work` and `review` queues (attention first, then priority, then last update).
- `WatchedRepositoriesService` (`core/repositories`) stores the repositories selected per account.
- `createTrackedPullRequest` builds a tracked record from a full GitHub pull request, using the remote counters as the acknowledged baseline so nothing is flagged on import.
- All three are loaded by the application initializer together with the account metadata.

## Folder structure

```text
src/app/
├── core/
│   ├── github/        # api service, session service, interceptor, models
│   ├── database/      # Dexie database and models
│   ├── pull-requests/ # tracked pull requests state, factory, sorting
│   ├── refresh/       # sync rules and refresh engine
│   ├── pwa/           # service worker update notice
│   ├── repositories/  # watched repositories state
│   └── theme/
├── features/
│   ├── work/
│   ├── review/
│   └── settings/
├── shared/
│   ├── components/
│   └── models/
├── app.config.ts
└── app.routes.ts
```

## Security rules

- Never render remote data with `innerHTML` or `bypassSecurityTrust*`.
- The token travels only in the `Authorization` header, never in URLs.
- The HTTP interceptor and error handling never log headers.
- The service worker caches application assets only. GitHub API responses are never cached.
- Token inputs use `type="password"` and `autocomplete="off"`.
- Tests and fixtures never contain real tokens.

## Testing

- Unit and integration tests run with Jest (`pnpm test`), using `fake-indexeddb` for Dexie and `HttpTestingController` for GitHub calls. The refresh rules are covered by pure function tests in `core/refresh`.
- End-to-end tests run with Playwright in Firefox (`pnpm e2e`). The GitHub API is fully mocked with `page.route` in `e2e/github-mock.ts`; no real token is ever used. Tests navigate through the application links because a full page load discards the in-memory tokens by design.
- The mock answers with `ETag` and `Access-Control-Expose-Headers`, like GitHub does. Without the latter a cross-origin script cannot read `ETag`, so conditional requests would silently stop working.
- CI runs lint, unit tests, build and audit on every push and pull request, and the e2e job on pull requests.

## Out of scope

Diff viewer, code editor, commenting or approving from the app, merging, creating PRs, git operations, GitHub Actions dashboard, webhooks, backend, own user system, cloud sync, push notifications and automatic polling.
