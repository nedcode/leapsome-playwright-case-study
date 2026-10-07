# Findings

Defects and observations found while building the test suite. Every defect is reproduced by an automated test in
`tests/api/feedback.spec.ts`; open defects live in the `known defects` group and are marked with `test.fail()`, so the
suite stays green while the defect exists and turns red once it is fixed. Severity is my own assessment.

| ID                                                                     | Severity | Summary                                                      | Status                         |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------ | ------------------------------ |
| [F1](#f1-error-responses-destroy-the-keep-alive-connection)            | High     | Error responses destroy the keep-alive connection            | Fixed in `src/api/app.ts`      |
| [F2](#f2-unvalidated-input-reaches-the-database-layer-and-returns-500) | Medium   | Unvalidated input reaches the database layer and returns 500 | Open                           |
| [F3](#f3-a-valid-token-of-a-non-existent-user-returns-500)             | Medium   | A valid token of a non-existent user returns 500             | Open                           |
| [F4](#f4-the-api-accepts-feedback-addressed-to-the-author)             | Low      | The API accepts feedback addressed to the author             | Open, needs a product decision |
| [F5](#f5-title-validation-runs-before-sanitization)                    | Low      | Title validation runs before sanitization                    | Open                           |
| [F6](#f6-the-authorization-scheme-is-not-checked)                      | Low      | The authorization scheme is not checked                      | Open                           |

## F1: Error responses destroy the keep-alive connection

**Steps:** Over one keep-alive connection, send a request the API rejects (for example `POST /feedback` with an
invalid body or without a token), then immediately send any other request over the same connection.

**Expected:** The rejected request receives its 4xx response and the follow-up request is served normally.

**Actual:** The follow-up request fails with `ECONNRESET`. With a plain Node.js HTTP client forcing connection reuse,
80 of 80 follow-up requests failed; after successful responses, 0 of 160 failed. The error response itself announces
`Connection: keep-alive`, so clients have no reason to open a new connection.

**Root cause:** `routing-controllers` sends the error response and then still calls `next(error)`. Express's final
handler sees that the headers were already sent and destroys the socket.

**Impact:** Any client that reuses connections (browsers, API consumers, test runners) gets intermittent network
errors right after a validation or authentication error. In the original suite this surfaced as failures under
parallel execution, which is why the suite had been limited to a single worker.

**Fix:** An error-handling middleware in `src/api/app.ts` stops the error once a response has been sent.

**Test:** `connection handling › keeps the keep-alive connection usable after error responses`. Without the fix it
failed in 5 of 5 runs; with the fix it passed in 10 of 10.

## F2: Unvalidated input reaches the database layer and returns 500

**Steps:** `POST /feedback` with `receiverId: 1.5`, or with a JSON array instead of an object as the body.

**Expected:** `400 Bad Request` with a validation error.

**Actual:** `500` with a `PrismaClientValidationError`. The response body also exposes internal details, such as the
Prisma call and the server's file path.

**Suggestion:** Validate `receiverId` with `@IsInt()` and `@IsPositive()`, reject non-object bodies, and map unexpected
errors to a generic 500 response without internal details.

**Tests:** `known defects › rejects a non-integer receiver ID with 400 instead of 500` and
`known defects › rejects a JSON array payload with 400 instead of 500`.

## F3: A valid token of a non-existent user returns 500

**Steps:** Sign a token with the API secret for a user ID that does not exist (for example a user deleted after the
token was issued) and call `POST /feedback` with it.

**Expected:** `401 Unauthorized`.

**Actual:** `500` with a `PrismaClientKnownRequestError` (foreign-key violation on `authorId`).

**Suggestion:** Resolve the user in `currentUserChecker` (or in the service) and reject tokens whose user no longer
exists.

**Test:** `known defects › rejects a valid token of a user that no longer exists with 401 instead of 500`.

## F4: The API accepts feedback addressed to the author

**Steps:** `POST /feedback` with `receiverId` equal to the signed-in user's own ID.

**Expected:** The UI never offers the signed-in user as a receiver, which suggests the business rule "no feedback to
yourself". If that rule is intended, the API should enforce it as well.

**Actual:** `200`; the feedback is stored with the same user as author and receiver.

**Note:** This needs a product decision. The test documents the rule the UI implies.

**Test:** `known defects › rejects feedback addressed to the author, as the UI does`.

## F5: Title validation runs before sanitization

**Steps:** `POST /feedback` with `title: "<b></b>"`, or with a title of three spaces.

**Expected:** `400`, because neither value is a meaningful title.

**Actual:** `200`. The markup-only title is validated as seven characters and then stored as an empty string after
sanitization; the whitespace-only title passes the minimum-length rule unchanged.

**Related:** The title has no maximum length (a 20,000-character title was accepted), while the body is limited to
10,000 characters. There is no test for this because no limit is specified.

**Suggestion:** Trim and sanitize before validating, and define a maximum title length.

**Tests:** `known defects › rejects a title that is empty after HTML sanitization` and
`known defects › rejects a title that consists only of whitespace`.

## F6: The authorization scheme is not checked

**Steps:** `POST /feedback` with the header `Authorization: Basic <valid access token>`.

**Expected:** `401`, because the API issues bearer tokens.

**Actual:** `200`. The API only takes the second part of the header and ignores the scheme.

**Suggestion:** Accept the token only when the scheme is `Bearer`.

**Test:** `known defects › rejects an authorization header that does not use the Bearer scheme`.

## Observations

These are not treated as defects, but they are worth a conversation:

- Error responses include stack traces. This follows from `NODE_ENV=development` in `.env.example`
  (`routing-controllers` enables its development mode outside production); the production configuration should be
  checked.
- `POST /feedback` responds with `200 OK`; `201 Created` would be the more common convention for resource creation.
- `GET /feedback` returns at most the 50 newest items and offers no pagination, so older feedback cannot be reached.
- The seed script generates feedback titles and bodies with Faker, so seeded content differs between runs. The tests
  therefore never rely on seeded feedback content, only on the seeded users.
