# Viva preparation

Thirty likely questions with concise answers specific to this codebase. File names are relative to the repository root. Numbers quoted for tests come from the latest run recorded in `docs/test-report.md`.

## A. Project and architecture

**1. What problem does the system solve?**
Test-drive requests handled by phone, visits or e-mail cause double bookings, delays, incomplete data and no tracking. The system gives customers one place to choose a vehicle, dealership and slot and see the status, and gives staff one place to manage vehicles, slots and bookings. The key promise is that a slot can never be booked twice.

**2. Describe the architecture.**
Three tiers: a Next.js 14 web application, a standalone Express REST API and a PostgreSQL database. The browser calls `/api/*` on the web origin and Next.js rewrites to Express (`web/next.config.mjs`), so the cookie stays same-origin. See `docs/design.md`, section 1.

**3. Why is Express a separate server instead of Next.js API routes?**
The specification fixes it, and it has real benefits: the API is independent of the UI (it can serve another client later), it has its own tests, OpenAPI document and security middleware, and business rules are not mixed with rendering code. The cost is one extra process and the rewrite that keeps cookies same-origin.

**4. Explain the layering (MVC-like).**
Route, then validator (zod), then controller, then service, then Prisma. Routes only wire; validators reject bad input; controllers are thin adapters that call one service and send the envelope; services hold business rules and transactions; Prisma is the data layer. The "view" is the separate Next.js application. This keeps rules testable without HTTP. Example: `routes/bookings.routes.ts`, `validators/booking.validators.ts`, `controllers/booking.controller.ts`, `services/booking.service.ts`.

**5. What is the response envelope and why use it?**
Every endpoint returns `{success, data}` or `{success:false, error:{code, message, details}}` (`api/src/utils/response.ts`). The client can handle every outcome in one place, the machine-readable `code` drives UI behaviour (for example `SLOT_UNAVAILABLE` shows the "time just taken" message), and `details` maps validation errors onto form fields.

## B. Authentication and security

**6. How does authentication work?**
On login the API verifies the password and issues a JWT (24 h) stored in an httpOnly, SameSite=Lax cookie named `td_session` (Secure in production). `authenticate` (`api/src/middleware/auth.ts`) verifies the signature on each request and then loads the user row, so a deactivated account loses access immediately. `requireRole` checks CUSTOMER or STAFF.

**7. Why a cookie instead of a token in local storage?**
An httpOnly cookie cannot be read by JavaScript, so an injected script cannot steal the session. SameSite=Lax plus the Origin/Referer check (`csrfGuard`) and JSON-only bodies mitigate cross-site request forgery. The Next.js rewrite keeps the cookie same-origin, which is why this works without exposing the API origin to the browser.

**8. How are passwords stored?**
bcrypt with cost 12 (`api/src/utils/password.ts`); never plain text and never returned by the API (`safeUser`). Rules: 8 to 72 characters (72 is bcrypt's input limit), with a letter and a number.

**9. How do you prevent user enumeration and brute force?**
Unknown e-mail and wrong password return the same 401 and message, and a dummy hash is compared for unknown e-mails so response time matches. A per-address rate limit and an account lockout (`LoginThrottle`: 5 failures, then 30 s doubling to 15 min, `Retry-After`) slow guessing. The disabled-account message appears only after the correct password.

**10. How is input validated?**
Strict zod schemas for body, query and path on every route (`api/src/validators`, `middleware/validate.ts`). Unknown fields are rejected, types are coerced and bounded, and failures return 422 with `details`. The web forms reuse the same rules with react-hook-form, and server errors are mapped back onto fields. Because validation is server-side too, bypassing the form gains nothing.

**11. How do you stop one user reading another's data (IDOR)?**
Services always filter by the authenticated user's id: another customer's booking or notification returns 404, profile endpoints take no id at all, and staff-only routes sit behind `requireRole('STAFF')`. `api/tests/routeAudit.test.ts` fails if a route lacks authentication or role classification, and `security.test.ts` tests cross-user access.

**12. What other security controls exist?**
helmet, CORS restricted to the web origin with credentials, rate limiting, 100 KB JSON limit, upload checks (MIME, magic bytes, size, random file names), parameterised queries only, a nonce-based Content-Security-Policy on the web app, JSON request logs without secrets, audit lines for staff writes, and a production check that refuses weak JWT secrets. All of it is listed with tests in `docs/security.md`.

## C. Database and scheduling

**13. Why PostgreSQL and how is the data modelled?**
Bookings, slots and users are strongly relational with integrity rules, so a relational database with transactions and constraints fits. Nine tables (see the data dictionary in `docs/design.md`): users, dealerships, vehicles, vehicle_images, dealership_vehicles, time_slots, bookings, booking_status_history and notifications.

**14. How do you guarantee there are no double bookings?**
Three layers. (1) In the booking transaction the service locks rows with `FOR NO KEY UPDATE` and re-checks that the slot is free. (2) A partial unique index `one_active_booking_per_slot` on `bookings(slot_id)` for PENDING, APPROVED and RESCHEDULED means the database itself refuses a second active booking. (3) The service translates the constraint violation into 409 `SLOT_UNAVAILABLE`. The concurrency test fires simultaneous requests and asserts exactly one succeeds (`npm run test:concurrency`).

**15. How do you stop overlapping slots for one vehicle?**
An exclusion constraint `time_slots_no_vehicle_overlap` using `btree_gist` on `(vehicle_id =, tstzrange(start_at, end_at) &&)` for active slots, plus a check that `end_at > start_at`. This is why the setup needs the `btree_gist` extension. The service also checks first so the API can return a friendly `SLOT_OVERLAP` message.

**16. What does a transaction do here and why does it matter?**
A booking action reads, checks and writes several rows (booking, history, notification, sometimes two slots). A transaction makes this atomic: either everything is saved or nothing, and row locks serialise competing requests. Without it a crash between the booking update and the history insert would leave inconsistent data. Reschedule is the best example: the old slot is released and the new one occupied in one atomic step.

**17. Explain the booking status machine.**
`api/src/services/bookingStateMachine.ts` holds the allowed transitions (A2): PENDING to APPROVED, REJECTED, CANCELLED or RESCHEDULED; APPROVED to RESCHEDULED, CANCELLED or COMPLETED; RESCHEDULED to RESCHEDULED, CANCELLED or COMPLETED; the rest are final. Every change goes through one function (`bookingTransition.ts`) that locks the booking, asserts the transition, updates, writes history and the notification. Illegal moves return 409 `INVALID_STATUS_TRANSITION`. Reject and staff-cancel need a reason; complete needs the slot start in the past.

**18. How does the cancellation rule work?**
`cancellationPolicy.ts` allows a customer to cancel their own active booking only if the slot starts at least `CANCELLATION_WINDOW_HOURS` (24) from now; otherwise 409 `CANCELLATION_WINDOW_PASSED`. Staff can cancel at any time with a reason. The API also returns `canCancel` and the reason so the UI shows the rule rather than a failing button.

**19. What are the booking limits and why?**
A customer can hold at most `MAX_ACTIVE_BOOKINGS` (3) active bookings and cannot hold two whose slot times overlap. This stops one person hoarding slots and double-booking themselves. The customer row is locked in the transaction so two parallel requests cannot both pass the count.

**20. What is soft deletion and what happens to existing bookings?**
Deactivation sets `is_active = false` instead of deleting. History stays intact and staff can still see the item; customers cannot. If a vehicle, dealership or slot has future active bookings the API refuses with 409 `HAS_ACTIVE_BOOKINGS`, so staff must cancel or reschedule first and no customer is left with an orphaned booking.

**21. How do notifications work and what if e-mail fails?**
Each status change inserts a `notifications` row in the same transaction (so the in-app notice exists exactly when the change does). After the commit, `deliverEmails` tries SMTP (or logs the message when SMTP is not configured). Failures are caught and logged, so an e-mail problem never rolls back or fails the booking action (A8). The customer sees an unread count and list under Notifications.

**22. How are times and time zones handled?**
All timestamps are `timestamptz` in UTC. The browser converts to the user's local time with date-fns, and bulk slot creation sends the time zone so "09:00 to 17:00" means the staff member's local time. This avoids server time-zone bugs.

## D. Frontend

**23. How is the frontend structured and how does it talk to the API?**
Next.js App Router with a `(site)` customer group, a protected `(member)` group and an `/admin` area. A small API client (`web/src/lib/api.ts`) unwraps the envelope into typed data or an `ApiError`. React Query caches server data with a central key factory, and mutations use optimistic updates with rollback (customer cancel, staff actions).

**24. How are protected pages enforced?**
Three levels: Next.js middleware redirects visitors from protected paths to login (with a safe `next` target); server components call `requireSession` to check role; and the API enforces everything again, because client checks are only for usability. A customer opening `/admin` sees an access-denied page and the API answers 403.

**25. What did you do for accessibility and usability?**
Labelled fields, error messages tied to fields, visible focus, keyboard-operable dialogs and tabs, sufficient contrast, responsive layouts, empty, loading and error states; checks and measurements are recorded in `docs/ux-accessibility.md`.

## E. Quality and process

**26. What is your testing strategy?**
A pyramid. API unit and integration tests with Vitest and Supertest against a real test database (rules, state machine, validators, every endpoint's success and failure paths, security, concurrency); web component tests with Testing Library; and 11 Playwright end-to-end tests against a production build (customer booking, staff workflow, access control, rule violations, catalogue administration). Latest run: API 1509 tests, web 219 tests, 11 end-to-end tests, all passing (details and coverage in `docs/test-report.md`). Concurrency is tested explicitly by racing requests for one slot.

**27. How do you know the requirements are covered?**
`docs/requirements-traceability.md` maps each FR-1 to FR-10 to endpoints, pages and tests. The route audit test (`api/tests/routeAudit.test.ts`) fails if a route lacks authentication, a role rule or input validation; `openapi.test.ts` compares the OpenAPI file with the real routes; and the generated `docs/api-reference.md` and Postman files have freshness tests.

**28. Which bugs did you find and how?**
They are recorded in `docs/bug-log.md` with cause and fix (for example the sign-in form submitting natively and putting the e-mail and password in the URL before the page finished loading, the `/book` page not being protected by middleware, and a slot-overlap message that exposed internal identifiers). They were found by unit tests, browser checks and audits.

**29. What are the limitations of the system?**
Staff can manage everything (no per-dealership permissions), the login lockout is in memory, e-mail is optional and untested against a real provider here, no payments or maps by design, no password reset by e-mail, runs on localhost only, and a few dependency advisories need major upgrades (assessed in `docs/security.md`). The full list with future work is in `docs/limitations-and-future-work.md`.

**30. What would you do next with more time?**
Per-dealership staff roles, password reset and e-mail verification, a shared store for rate limiting and lockout, calendar integration and reminders, a waiting list for taken slots, production deployment behind HTTPS with Docker and CI, and upgrading dependencies to current majors. Priorities and effort are in `docs/limitations-and-future-work.md`.
