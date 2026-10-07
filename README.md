# Leapsome Case Study

Welcome and thank you for taking the time to prepare a submission for our case study! The code in this repository is a strongly simplified application to give and show feedback to other users.

## Prerequisites

To continue you need to have the following installed:

- NodeJS >= 18.17.1
- Docker

## Tasks

When working on the tasks, you are free to modify any existing code and merge into branch(es) or create pull requests for feature branches if required. (Example: To improve testability). The only restrictions are that Playwright must be used for browser automation and testing, and no other programming language other than JavaScript/TypeScript can be used. We hope you enjoy this challenge and be sure to set yourself a time limit of 2-4 hours. If not all tasks could be tackled and you are running out of time, let us know where you spent the most time and which parts could not be tackled. We would also love to hear which future improvements you would make with more time at hand and your overall feedback on this challenge.

1. Add `E2E test(s)` to check the functionality from the perspective of a real user
2. Add `API test(s)` for the `"[POST] /feedback"` endpoint

## Local Setup

```
cp .env.example .env
npm install
```

Database:

```
docker-compose up
```

First time setup:

```
npm run db:migrate
npm run db:seed // for setting up test data and users
```

Service + Client:

```
npm run dev
```

## Tests

The suite uses Playwright for browser-based E2E tests and for direct API tests. Make sure the PostgreSQL container is
running and the migrations are applied (see Local Setup), then run everything with:

```
npm test
```

Playwright starts the service and the client automatically when they are not already running, and the global setup
re-seeds the database before each run, so every run starts from the same users and a fresh set of feedback.

| Command                  | Purpose                                |
| ------------------------ | -------------------------------------- |
| `npm run test:api`       | API tests only (no browser)            |
| `npm run test:e2e`       | E2E tests in Chromium and Firefox      |
| `npm run test:headed`    | E2E tests in a visible Chromium window |
| `npm run test:report`    | Open the HTML report of the last run   |
| `npm run test:typecheck` | Type-check the test code               |
| `npm run test:lint`      | Lint the test code                     |

### Test architecture

- **Projects:** `api` runs without a browser; `setup` signs in once through the UI and stores the session;
  `e2e-chromium` and `e2e-firefox` reuse that session and run in parallel.
- **Page objects:** `tests/pages` contains the sign-in page, the feedback wall and the feedback dialog. Locators are
  role- and label-based, with `data-testid` used only where the markup has no accessible name.
- **Fixtures:** `tests/fixtures` injects the page objects and an authenticated API session. The session is
  worker-scoped, so the bcrypt-based sign-in runs once per worker instead of once per test. Third-party avatar
  requests are stubbed, so UI tests never depend on the internet.
- **Support code:** `tests/support` holds the environment configuration (one source for URLs and secrets), the API
  client, a keep-alive HTTP client for the connection-handling test, and test-data builders that give every
  scenario unique content, which keeps parallel tests independent.
- **Specs** contain only scenarios and assertions; selectors and repeated setup stay outside them.

### Coverage

**E2E:** protected navigation, sign-in with valid and invalid credentials, sign-out, receiver selection rules,
browser-side validation of an empty form, API validation errors shown in the UI, a simulated service failure, and
feedback creation with persistence after a reload.

**API (`POST /feedback`):** successful creation and persistence, minimum and maximum field lengths, HTML sanitization,
the author always being taken from the token, rejection of missing, malformed, foreign-signed, unsigned and expired
tokens, field-level validation, unknown receivers, and connection reuse after error responses. Error envelopes and the
absence of side effects are asserted in addition to status codes.

**Known defects:** the defects described in [FINDINGS.md](FINDINGS.md) are covered by tests marked with `test.fail()`.
They document the expected behaviour and turn red as soon as a defect is fixed. The list reporter marks them with ✘,
but Playwright counts them as passed because they fail as expected.

### Continuous integration

`.github/workflows/playwright.yml` runs type-checking, linting and the complete suite on every push and pull request,
with PostgreSQL as a service container, and uploads the HTML report as an artifact.

## Submission Comments

- **Changes to the application:** I added accessible names and a few `data-testid` attributes for stable locators,
  fixed the keep-alive defect F1 in `src/api/app.ts` (it made parallel test runs unreliable), and upgraded Prisma from
  3.12 to 3.15 because 3.12 has no engine for OpenSSL 3, which current Linux CI runners use.
- **Findings:** six defects and a few observations are documented in [FINDINGS.md](FINDINGS.md), including steps to
  reproduce, root cause where known, and suggested fixes.
- **With more time I would add:** an accessibility scan of the main pages (for example with `@axe-core/playwright`),
  response-schema validation for the API tests, WebKit coverage, and tests for `GET /feedback` and the sign-in endpoint.
