<h1 align="center">PR Tracker</h1>

<p align="center">
  Personal work and review queue for Pull Requests from multiple GitHub accounts.
</p>

<!-- BADGES -->
<p align="center">
    <a title="Deploy" href="https://github.com/Mane087/pr-tracker/actions/workflows/deploy.yml">
       <img src="https://github.com/Mane087/pr-tracker/actions/workflows/deploy.yml/badge.svg" alt="Deploy" />
    </a>
    <a title="CI" href="https://github.com/Mane087/pr-tracker/actions/workflows/ci.yml">
       <img src="https://github.com/Mane087/pr-tracker/actions/workflows/ci.yml/badge.svg" alt="CI" />
    </a>
    <a title="Security" href="https://github.com/Mane087/pr-tracker/actions/workflows/security.yml">
       <img src="https://github.com/Mane087/pr-tracker/actions/workflows/security.yml/badge.svg" alt="Security" />
    </a>
    <a title="Apache-2.0" href="LICENSE.md">
       <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0" />
    </a>
    <a title="Angular" href="https://angular.dev">
       <img src="https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white" alt="Angular 22" />
    </a>
    <a title="TypeScript" href="https://www.typescriptlang.org">
       <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
    </a>
    <a title="Tailwind CSS" href="https://tailwindcss.com">
       <img src="https://img.shields.io/badge/Tailwind%20CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4.3" />
    </a>
    <a title="node.js" href="https://nodejs.org">
       <img src="https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white" alt="node.js 24" />
    </a>
</p>

## Description

PR Tracker is an Angular 22 PWA (zoneless, signals) that organizes Pull Requests from
several GitHub accounts into a personal work queue and a personal review queue. It does
not replace GitHub: code review, comments, approvals and merges stay in GitHub. The
application only tracks the state that is personal to you: priority, status, section and
what you have already seen.

Everything runs in the browser. There is no backend, tokens live only in memory and local
data is stored in IndexedDB. The application is published at
<https://mane087.github.io/pr-tracker/>.

## What problem does it solve?

When you work with more than one GitHub account (personal, company, client) the Pull
Requests you author and the ones you review are spread across accounts, organizations
and repositories. PR Tracker gathers them in one place, lets you decide what you are
working on right now, and tells you when a tracked Pull Request received new commits,
comments or reviews since you last looked at it.

## Features

- Multiple GitHub accounts, each with its own fine-grained Personal Access Token. Tokens
  are kept only in RAM and are requested again after a reload; only account metadata
  (id, name, username, avatar) is persisted.
- **Work** section: Pull Requests you authored, imported from the repositories you watch
  per account. Statuses `CURRENT`, `PAUSED` and `POSTPONED`, with a single `CURRENT` per
  account.
- **Review** section: Pull Requests you chose to follow, added by account, repository and
  number. Statuses `PENDING`, `REVIEWING`, `REVIEWED` and `NEEDS_REVIEW`. Marking a PR as
  reviewed stores the reviewed head SHA and counters.
- Priorities `P0` to `P3` in both sections, where `P3` is the highest.
- Manual refresh with change detection: a new head SHA on a reviewed PR sets
  `NEEDS_REVIEW`, new comments or reviews raise an attention flag with the reason, and
  merged or closed PRs are archived instead of deleted.
- Conditional requests with `ETag` / `If-None-Match`, so unchanged PRs do not consume
  GitHub rate limit. Rate limit is tracked per account and reported when exhausted.
- Filter bar per queue: search, status, account, attention only, and sort by priority,
  last update or number. PRs that require attention are always listed first.
- Light and dark theme, installable as a PWA, with a banner when a new version is ready.
- Local persistence in IndexedDB through Dexie. GitHub API responses are never cached by
  the service worker.

## How to use

1. Open **Settings** and add a GitHub account with a fine-grained Personal Access Token.
   Recommended permissions: repository access limited to the selected repositories,
   `Metadata: Read` and `Pull requests: Read`.
2. In **Work**, open the repositories panel of the active account, choose the
   repositories to watch and press **Import my open PRs**. Your open Pull Requests in
   those repositories are imported as `PAUSED` with priority `P2`.
3. In **Review**, add the Pull Requests you want to follow by account, repository and
   number.
4. Press **Refresh** whenever you want to sync with GitHub. Attention flags stay until
   you acknowledge them with the **Seen** action.

After a reload the accounts are still listed, but you must enter the token again before
refreshing. The GitHub login is validated against the stored account.

## Structure

```text
src/app/
├── core/
│   ├── github/        GitHub API service, session service, interceptor, models
│   ├── database/      Dexie database and models
│   ├── pull-requests/ tracked pull requests state, factory, sorting
│   ├── refresh/       sync rules (pure functions) and refresh engine
│   ├── pwa/           service worker update notice
│   ├── repositories/  watched repositories state
│   └── theme/         light / dark theme
├── features/
│   ├── work/          Work queue
│   ├── review/        Review queue
│   └── settings/      accounts and watched repositories
└── shared/
    ├── components/    icon, pull request card, filter bar
    └── utils/
```

`GithubApiService` is the only place that calls GitHub, and `githubInterceptor` is the
only code that attaches a token to a request.

Visual tokens are semantic CSS variables in `src/styles.css`, exposed to Tailwind through
`@theme inline`. Fonts are self-hosted from `@fontsource` because the Content Security
Policy does not allow Google Fonts. Icons are single SVG files rendered as CSS masks so
they follow `currentColor` in both themes.

See [docs/architecture.md](docs/architecture.md) for the full architecture notes.

## Tools

| Tool                                                | Version         |
| --------------------------------------------------- | --------------- |
| Angular                                             | 22.1.7          |
| TypeScript (required by `@angular/compiler-cli` 22) | 6.0.3           |
| Tailwind CSS                                        | 4.3.3           |
| PostCSS                                             | 8.5.28          |
| Dexie                                               | 4.4.6           |
| ESLint + angular-eslint                             | 10.9.1 / 22.5.0 |
| Prettier                                            | 3.9.7           |
| Jest + `jest-preset-angular` (zoneless environment) | 30.5.1 / 17.0.0 |
| Testing Library for Angular                         | 19.5.0          |
| Playwright                                          | 1.63.0          |
| Husky + lint-staged                                 | 9.1.7 / 17.5.1  |
| Commitlint                                          | 21.2.2          |

Node.js 24 (see `.nvmrc`) and pnpm are required.

## Development

Local server with automatic reload on source changes, served at `http://localhost:4200/`:

```bash
pnpm exec ng serve
```

Build; artifacts are written to `dist/`:

```bash
pnpm run build
```

Angular CLI scaffolding:

```bash
pnpm exec ng generate component component-name
pnpm exec ng generate --help
```

Static analysis:

```bash
pnpm run lint
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org) and are
checked by Commitlint. lint-staged runs ESLint and Prettier on staged files.

## Tests

### Unit and integration

```bash
pnpm test
pnpm run test:watch
pnpm run test:ci
```

Jest is the only unit test runner; there is no `ng test` target. Dexie runs against
`fake-indexeddb` and GitHub calls are intercepted with `HttpTestingController`. The
refresh rules are covered by pure function tests in `core/refresh`.

### End to end

```bash
pnpm exec playwright install firefox   # once
pnpm run e2e
pnpm run e2e:report
```

`playwright.config.ts` starts the development server on port 4300 and runs the
`*.e2e.spec.ts` files in Firefox. The GitHub API is fully mocked with `page.route` in
`e2e/github-mock.ts`; no real token is ever used. Tests navigate through the application
links because a full page load discards the in-memory tokens by design.

## CI and deployment

- **CI** runs lint, unit tests, build and dependency audit on every push and pull
  request, and the e2e job on pull requests.
- **Security** runs CodeQL (TypeScript and GitHub Actions) on pushes to `main`, pull
  requests and a weekly schedule, dependency review on pull requests, and the dependency
  audit weekly.
- **Deploy** publishes the application to GitHub Pages on every push to `main`. The build
  uses `--base-href /pr-tracker/` and copies `index.html` as `404.html` so deep links
  such as `/work` resolve through the router.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, coding guidelines and commit
conventions. This project follows the [Contributor Covenant Code of
Conduct](CODE_OF_CONDUCT.md). Security issues must be reported privately as described in
[SECURITY.md](SECURITY.md).

## License

Licensed under the [Apache License 2.0](LICENSE.md).
