# Security Policy

## Supported Versions

This project follows a **best-effort security support model**. Only the version deployed
from the `main` branch is actively maintained and receives security updates.

| Version               | Supported |
| --------------------- | --------- |
| `main` (GitHub Pages) | ✅ Yes    |
| Older builds          | ❌ No     |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public issue**. Report it
privately through GitHub:

1. Open the [Security tab](https://github.com/Mane087/pr-tracker/security) of the repository.
2. Choose **Report a vulnerability** and fill in the advisory form.

When reporting a vulnerability, include as much detail as possible:

- A clear description of the issue
- Steps to reproduce the vulnerability
- Affected commit or deployed version
- Potential impact
- Any proof-of-concept (PoC), if available

You can expect an initial response **within 48–72 hours**.

---

## Disclosure Process

Once a vulnerability is reported:

1. The report is reviewed and validated.
2. A fix or mitigation is developed.
3. The fix is merged to `main`, which redeploys the application.
4. The reporter may be credited, unless anonymity is requested.

Public disclosure happens **only after a fix is available**, or when mitigation guidance
has been provided.

---

## Security Model

PR Tracker runs entirely in the browser and has no backend. The rules below are part of the
design and any change that weakens them is considered a vulnerability:

- GitHub tokens live only in memory. They are never written to `localStorage`,
  `sessionStorage`, IndexedDB, cookies or files, and they are discarded on reload.
- Tokens travel only in the `Authorization` header, never in URLs, and the HTTP
  interceptor and error handling never log headers.
- Remote data is never rendered with `innerHTML` or `bypassSecurityTrust*`.
- The service worker caches application assets only. GitHub API responses are never
  cached.
- A Content Security Policy is declared in `index.html`.
- Tests and fixtures never contain real tokens.

Users are encouraged to create fine-grained Personal Access Tokens with the minimum
permissions: repository access limited to the selected repositories, `Metadata: Read` and
`Pull requests: Read`.

---

## Automated Checks

- CodeQL (TypeScript and GitHub Actions) runs on pushes to `main`, pull requests and a
  weekly schedule.
- Dependency review runs on pull requests.
- `pnpm audit` runs on every push and pull request, and weekly.
- Dependabot keeps dependencies and GitHub Actions up to date.

---

## Scope

This security policy applies to:

- Source code
- Configuration files
- Build, test and deployment workflows

It does **not** cover:

- GitHub itself or the GitHub REST API
- Browsers or operating systems of the users
- Infrastructure managed outside this repository

---

Thank you for helping keep this project and its users secure.
