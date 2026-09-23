# Contributing Guide

Thank you for your interest in contributing to this project. 🚀
Contributions are welcome and appreciated, whether they are bug reports, feature requests,
documentation improvements, or code contributions.

This guide describes the workflow and rules to keep the project consistent, maintainable,
and easy to collaborate on.

---

## Project Scope

This project focuses on:

- Organizing Pull Requests from multiple GitHub accounts into a personal work queue and a
  personal review queue
- Tracking state that is personal to the user: priority, status, section and acknowledged
  activity
- Detecting new commits, comments and reviews on tracked Pull Requests with a manual
  refresh

Out of scope: diff viewer, code editor, commenting or approving from the app, merging,
creating PRs, git operations, GitHub Actions dashboard, webhooks, backend, own user system,
cloud sync, push notifications and automatic polling.

When contributing, please ensure your proposal aligns with these goals. See
[docs/architecture.md](docs/architecture.md) for the architecture notes.

---

## Ways to Contribute

You can contribute in several ways:

- Reporting bugs
- Suggesting new features or improvements
- Improving documentation
- Fixing issues or refactoring code
- Adding or improving tests

Small, focused contributions are preferred over large, unrelated changes.

---

## Reporting Bugs

Before reporting a bug:

- Verify the issue has not already been reported
- Test using the latest deployed version

When opening an issue, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots or console output if applicable
- Browser and operating system details

Do **not** report security vulnerabilities in public issues. Refer to
[SECURITY.md](SECURITY.md) instead.

---

## Suggesting Features

Feature requests should:

- Clearly describe the problem being solved
- Explain why the feature is useful
- Fit within the project scope described above

Avoid proposing features that significantly increase project complexity without clear
benefits.

---

## Development Setup

Requirements: Node.js 24 (see `.nvmrc`) and pnpm.

1. Fork the repository
2. Clone your fork locally
3. Install dependencies with `pnpm install`
4. Create a new branch for your change
5. Make your changes following the project conventions
6. Run `pnpm lint`, `pnpm test` and `pnpm e2e` (the first e2e run needs
   `pnpm exec playwright install firefox`)
7. Commit your changes following the commit conventions below
8. Push the branch to your fork
9. Open a Pull Request

---

## Coding Guidelines

To keep the codebase clean and consistent:

- Code, comments and documentation are written in English
- Use `camelCase` for variables and functions, `PascalCase` for classes and `kebab-case` for
  files and folders
- Name booleans with prefixes such as `is`, `has`, `can` or `should`
- Follow the existing patterns before introducing new abstractions
- Keep functions and components small and readable
- Avoid introducing unnecessary dependencies
- Never hardcode secrets, tokens or credentials, and never weaken the rules listed in
  [SECURITY.md](SECURITY.md)

ESLint and Prettier run on staged files through lint-staged, and the unit tests run on every
commit.

---

## Commit Messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org) and are checked
by Commitlint. Examples:

```text
feat(review): add repository selector
fix(refresh): keep attention reasons after a 304 response
docs: describe the refresh rules
```

---

## Documentation

Documentation is as important as code.

When adding or modifying features:

- Update the README if user-facing behavior changes
- Update `docs/architecture.md` when the design or the folder structure changes
- Keep explanations concise and accurate

---

## Pull Request Guidelines

Pull Requests should:

- Address a single issue or feature
- Include a clear description of the changes
- Reference related issues if applicable
- Pass CI: lint, unit tests, build, dependency audit, e2e, CodeQL and dependency review

Incomplete or unfocused Pull Requests may be requested for revision.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Be
respectful and professional in all interactions.

---

## Final Notes

By contributing, you agree that your work is licensed under the
[Apache License 2.0](LICENSE.md) of this project.

Thank you for helping improve this project ✨
