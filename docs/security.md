# Security review (Phase 25)

Scope: the Express API (`api/`) and the Next.js application (`web/`) as they run on localhost. Controls follow assumption A10 of the specification. Every control below has an automated test; the full list of tests is in `docs/test-report.md`.

## Issues found and fixed in this phase

| # | Finding | Fix |
| --- | --- | --- |
| 1 | No cross-site request check beyond the SameSite cookie, and bodies of any content type were accepted. | `csrfGuard`: a state-changing request that names an `Origin` (or `Referer`) other than `WEB_ORIGIN` gets 403; a request body must be JSON (multipart only for the image upload). |
| 2 | Brute-force protection was only a rate limit of 10 attempts per 15 minutes per address and email. | `LoginThrottle`: after 5 failures an account is locked with an escalating delay (30 s, 1 min, 2 min, up to 15 min), including for unknown emails so the lock reveals nothing. |
| 3 | Request logs were free text and included query strings. | JSON request log: method, path without query, status, duration, user id. No headers, bodies or cookies. |
| 4 | No record of who changed what. | Audit lines (`staff.write` for every successful staff write, `booking.transition` for every status change) with identifiers only. |
| 5 | The example `JWT_SECRET` is a published string; nothing stopped it being used in production. | Startup refuses, in production, a secret under 32 characters, a known placeholder, or one with too little variety. |
| 6 | The web app sent no Content-Security-Policy or hardening headers. | Per-request nonce CSP from middleware plus `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `X-Powered-By` removed. |
| 7 | JSON bodies were accepted up to 1 MB. | Limit lowered to 100 KB (largest legitimate request is a few KB). Mitigates the Zod advisory below. |
| 8 | Email validation accepted quoted or routing forms that some mail libraries read differently. | Plain addresses only (`local@domain.tld`). Mitigates the Nodemailer advisory below. |
| 9 | Image optimiser allowed a remote host pattern that nothing used. | Removed; images are same-origin paths. Reduces exposure to the Next.js image advisory. |

No cross-user data access, SQL injection, XSS or upload defects were found; the negative tests for them are listed in the table.

## Controls

| Risk | Mitigation | Where in the code | Test |
| --- | --- | --- | --- |
| Weak password storage | bcrypt, cost 12; rules: 8 to 72 characters, a letter and a number | `api/src/utils/password.ts`, `validators/common.ts` | `auth.test.ts`, `validators.test.ts` |
| Session theft by script | JWT in an `httpOnly`, `SameSite=Lax` cookie, `Secure` in production, expiry equal to the token's (24 h) | `api/src/utils/cookies.ts`, `utils/token.ts` | `auth.test.ts` |
| Forged or tampered session | Signature verified on every request; `alg: none` and altered signatures rejected | `api/src/middleware/auth.ts` | `security.test.ts` (IDOR group) |
| Weak signing secret | Production refuses short, placeholder and low-variety secrets | `api/src/config/jwtSecret.ts`, `config/env.ts` | `security.test.ts` (JWT secret) |
| Deactivated user keeps access | The user row is read on every authenticated request; `ACCOUNT_DISABLED` immediately | `api/src/middleware/auth.ts` | `security.test.ts`, `auth.middleware.test.ts` |
| User enumeration at sign-in | Same status and message for unknown email and wrong password; a dummy hash is compared for unknown emails so timing matches; the disabled-account message appears only after a correct password | `api/src/services/auth.service.ts` | `security.test.ts` |
| Password guessing | Rate limit per address and email, plus account lockout with escalating delay and `Retry-After` | `api/src/middleware/rateLimiters.ts`, `middleware/loginThrottle.ts`, `utils/loginThrottle.ts` | `security.test.ts`, `rateLimiters.test.ts` |
| Missing role check | Every route passes through `authenticate` and `requireRole`; the route audit fails the build if a route is unclassified | `api/src/routes/*` | `routeAudit.test.ts` |
| Reading or changing another user's data (IDOR) | Services filter by the caller's id; another user's booking or notification answers 404 and is never changed; profile endpoints take no id | `myBooking.service.ts`, `notificationInbox.service.ts`, `profile.service.ts` | `security.test.ts` (IDOR group), `myBookings.test.ts`, `notifications.test.ts` |
| Unvalidated input | Strict zod schemas for body, query and path on every route; unknown fields rejected with 422 | `api/src/validators/*`, `middleware/validate.ts` | `routeAudit.test.ts`, `validators.test.ts` |
| Oversized or malformed bodies | 100 KB JSON limit; malformed JSON answered 400 in the standard envelope | `api/src/app.ts` | `health.test.ts` |
| Malicious uploads | MIME type and file signature (magic bytes) checked, 5 MB and 8-file limits, server-generated random names, stored under the vehicle's folder, served with `nosniff` and a sandbox CSP for SVG | `api/src/middleware/upload.ts`, `utils/imageFiles.ts`, `app.ts` | `vehicleImages.test.ts`, `health.test.ts` |
| Path traversal | Static serving denies dotfiles and traversal; file names never come from the client | `api/src/app.ts`, `utils/imageFiles.ts` | `health.test.ts`, `vehicleImages.test.ts` |
| SQL injection | Only Prisma's query builder and tagged-template raw queries (every value is a bound parameter); no `$queryRawUnsafe`, `$executeRawUnsafe` or string-built SQL (see search result below) | `catalog.service.ts`, `dashboard.service.ts`, `utils/locks.ts`, `health.service.ts` | `likeEscape.test.ts`, `catalog.test.ts`, `routeAudit.test.ts` |
| Cross-site scripting | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere in `web/src`; React escapes all text; nonce-based CSP forbids inline and foreign scripts | `web/src/**`, `web/src/lib/csp.ts`, `web/src/middleware.ts` | `csp.test.ts`, end-to-end tests run against the production build with the CSP active |
| Hostile image sources | `img-src 'self' data: blob:`; no remote image patterns; uploaded SVGs are sandboxed | `web/src/lib/csp.ts`, `web/next.config.mjs`, `api/src/app.ts` | `csp.test.ts`, `health.test.ts` |
| Clickjacking, MIME sniffing, referrer leakage | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` on the web app; helmet on the API | `web/next.config.mjs`, `api/src/app.ts` | `health.test.ts`, headers checked by hand (below) |
| Cross-site request forgery | `SameSite=Lax` cookie; Origin/Referer must equal `WEB_ORIGIN` (the API's own origin is trusted in development only, for Swagger UI); JSON-only bodies | `api/src/middleware/csrfGuard.ts` | `security.test.ts` (CSRF group) |
| Abuse of any endpoint | General limiter of 300 requests per 15 minutes per address; strict limiter on sign-in and registration | `api/src/middleware/rateLimiters.ts` | `rateLimiters.test.ts` |
| Secrets in the repository | `.env` and `*.env` are git-ignored; `.env.example` lists every variable with placeholders; nothing in source matches a secret pattern | `.gitignore`, `api/.env.example`, `web/.env.example` | search result below |
| Secrets or personal data in logs | Request log has no query string, headers or body; audit lines carry identifiers only | `api/src/middleware/requestLog.ts`, `utils/audit.ts` | `security.test.ts` (logging group) |
| Information leaks in errors | Standard envelope; 500s return a generic message; no stack traces | `api/src/middleware/errorHandler.ts` | `errorHandling.test.ts` |
| No trail of staff actions | `staff.write` (actor, method, route, ids, status) and `booking.transition` (booking, from, to, actor) lines; status changes are also stored in `booking_status_history` | `api/src/middleware/requestLog.ts`, `services/bookingTransition.ts` | `security.test.ts` (logging group) |

## Evidence

**Raw SQL in the API** (`grep -rnE "queryRaw|executeRaw|Unsafe|Prisma\.sql|Prisma\.raw" api/src`): every hit is a tagged template such as `` tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR NO KEY UPDATE` `` in `utils/locks.ts`, `catalog.service.ts`, `dashboard.service.ts` and `health.service.ts`. Tagged templates turn `${...}` into bound parameters. There are no `Unsafe` variants and no string concatenation into SQL.

**Dangerous DOM APIs in the web app** (`grep -rnE "dangerouslySetInnerHTML|innerHTML|eval\(|new Function" web/src`): no matches.

**Response headers of the web app** (production build, `curl -I`): `Content-Security-Policy` with a fresh nonce on each response, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`; no `X-Powered-By`. In the browser, every script tag carried the nonce and no CSP violation was reported.

## Dependency audit (`npm audit`)

18 findings (3 critical, 6 high, 9 moderate); every fix offered by npm is a **breaking major upgrade** (for example Next.js 14 to 16, Zod 3 to 4, Vitest 3 to 5), and the specification fixes the stack, so they were assessed instead of applied:

| Package | Severity | In production? | Assessment |
| --- | --- | --- | --- |
| `next` (image optimiser `remotePatterns` denial of service) | Critical | Yes | The unused remote pattern was removed; images are same-origin paths, so the optimiser never fetches remote URLs. Residual risk: a self-hosted denial of service, not applicable to a localhost demo. |
| `postcss` (unescaped `</style>` in stringified CSS) | High | Build time only (bundled in Next) | Only our own CSS is processed; no untrusted CSS is ever stringified. |
| `zod` (memory use on oversized collections) | High | Yes | Bodies are limited to 100 KB and every array in a schema has a maximum length. |
| `nodemailer` (address interpretation conflict) | High | Yes | Recipient addresses are restricted to plain `local@domain.tld` forms (finding 8), which removes the conflict. |
| `vitest`, `tinypool`, `@vitest/*`, `glob`, `minimatch`, `test-exclude` | Critical to moderate | No (development only) | Only run on the developer's machine against our own tests. |
| `eslint-config-next`, `@typescript-eslint/*` | High and moderate | No (development only) | Linting only. |

Re-run `npm audit` before any real deployment and plan the major upgrades then.

## Known limits

- The `Secure` cookie flag only takes effect over HTTPS, which is outside the localhost scope; set `NODE_ENV=production` behind HTTPS in any real deployment.
- The lockout counters live in the API process memory, so they reset when the API restarts. For several API instances they would need a shared store.
- A state-changing request with neither `Origin` nor `Referer` (curl, Postman, tests) is allowed; browsers always send at least one.
- The CSP keeps `style-src 'unsafe-inline'` because the framework and Tailwind emit style attributes; scripts are the protected surface.
- Staff accounts have no forced password change on first sign-in; the create-staff screen tells the creator to ask for it.
