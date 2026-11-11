# System Assumptions & Business Rules

The following assumptions and business rules govern the implementation of the Luxury Car Test-Drive Booking and Management System. These are documented here for supervisory confirmation and permanent alignment.

---

### A1. Roles and Account Management
- Two user roles: `CUSTOMER` and `STAFF`.
- Customers self-register via the portal.
- Dealership staff accounts are not self-registered; they are initialized via the database seed script or created by existing staff members.
- All staff members have global administrative access to manage all dealerships, vehicles, time slots, bookings, and customer accounts.

### A2. Booking Status Lifecycle
- Valid booking statuses: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `RESCHEDULED`.
- Active statuses (which occupy a time slot): `PENDING`, `APPROVED`, `RESCHEDULED`.
- Allowed state transitions:
  - `PENDING` $\rightarrow$ `APPROVED` | `REJECTED` | `CANCELLED` | `RESCHEDULED`
  - `APPROVED` $\rightarrow$ `RESCHEDULED` | `CANCELLED` | `COMPLETED`
  - `RESCHEDULED` $\rightarrow$ `RESCHEDULED` | `CANCELLED` | `COMPLETED`
  - `REJECTED`, `CANCELLED`, and `COMPLETED` are terminal (final) states.
- Rejection and staff cancellation require a non-empty reason.
- `COMPLETED` status is only permitted when the slot start time has elapsed in the past.

### A3. Cancellation Policy
- A customer may cancel their own `PENDING`, `APPROVED`, or `RESCHEDULED` booking only if the slot start time is at least `CANCELLATION_WINDOW_HOURS` (default: 24 hours) into the future.
- If less than 24 hours remain, cancellation is rejected with `CANCELLATION_WINDOW_PASSED`.
- Staff members can cancel any active booking at any time, provided they supply a cancellation reason.

### A4. Time Slots
- Each time slot belongs to exactly one vehicle at one specific dealership.
- A slot defines `start_at` and `end_at` timestamps (where `end_at > start_at`) and an `is_active` flag.
- Time slots for the same vehicle must never overlap (enforced at the database level).
- A slot is considered available when `is_active = true`, `start_at` is in the future, and no active booking (`PENDING`, `APPROVED`, `RESCHEDULED`) is assigned to it.
- Booking past slots is strictly forbidden.

### A5. Conflict-Free Scheduling & Concurrency
- Exactly one active booking per slot: enforced via a partial unique index in PostgreSQL (`WHERE status IN ('PENDING', 'APPROVED', 'RESCHEDULED')`) and pessimistic row locking (`SELECT FOR UPDATE`) within database transactions.
- A single customer cannot hold two overlapping active bookings across any vehicles.
- A customer can have at most `MAX_ACTIVE_BOOKINGS` (default: 3) active bookings concurrently.
- Simultaneous requests for the identical slot are handled gracefully: exactly one transaction succeeds, and subsequent requests fail with `409 SLOT_UNAVAILABLE`.

### A6. Soft Deactivation
- Deleting vehicles, dealerships, or slots is always a soft delete (`is_active = false`), preserving data integrity and historical records.
- Deactivating any vehicle, dealership, or slot that has upcoming active bookings is blocked with `409 HAS_ACTIVE_BOOKINGS`. Staff must cancel or reschedule those active appointments before deactivation.
- Deactivated entities are hidden from customer catalog searches, but remain visible to staff dashboards and audit histories.

### A7. Rescheduling Workflow
- Authorized staff can reschedule an active booking to another available slot for the same vehicle (either at the same dealership or another dealership where the vehicle is located).
- The booking status updates to `RESCHEDULED`, the historical audit trail records both the previous and new slot information, and the customer is notified.

### A8. Audit Trail & Notifications
- Every booking status transition writes an immutable row into `booking_status_history` (`id`, `booking_id`, `changed_by_user_id`, `from_status`, `to_status`, `reason_note`, `created_at`).
- Status changes generate an in-app customer notification record and trigger an asynchronous email attempt.
- Email delivery failures must be logged but must never roll back or abort the database transaction.

### A9. Customer Appointment Filtering
Customer portal presents distinct filtered appointment views:
- **Pending**: Status is `PENDING`.
- **Upcoming**: Status is `APPROVED` or `RESCHEDULED` with `start_at` in the future.
- **Completed**: Status is `COMPLETED`.
- **Cancelled**: Status is `CANCELLED` or `REJECTED` (with appropriate badge distinction).
- **Previous**: Any booking whose slot start time is in the past.
- **All**: Unfiltered chronological history.

### A10. Security & Privacy
- Passwords hashed using `bcrypt` with work factor / cost 12; minimum 8 characters requiring at least one letter and one number.
- JWT session tokens stored exclusively in `httpOnly`, `SameSite=Lax` cookies (`Secure` flag enabled in production).
- Hardened HTTP headers using `helmet`.
- Strict CORS configuration restricted to the web frontend origin with credentials enabled.
- Rate limiting on authentication and sensitive endpoints.
- All request payloads validated using `zod` schemas.
- Role-based authorization enforced on all protected routes; customer data isolation guaranteed (customers cannot view or modify other users' records).
- Zero secrets committed to version control.

### A11. Network Architecture & Reverse Proxying
- Frontend and backend communicate via Next.js rewrites: the client browser interacts exclusively with the Next.js origin (`http://localhost:3000`), which proxies `/api/*` and `/uploads/*` requests to the standalone Express API (`http://localhost:4000`).
- This setup ensures cookies operate in a first-party, same-origin context.
- Uploaded vehicle images are stored and served by Express under `/uploads` and accessible through the reverse proxy.


## Implementation decisions (not in the original specification)

These were made while building the API and are listed so they can be confirmed or changed.

### D1. Email address cannot be changed from the profile
`PATCH /api/profile` rejects `email` as an unknown field. The email address is the login identity and the address used for booking notifications. Changing it safely needs a verification step (a confirmation message to the new address), which is outside the agreed scope. Staff who need a correction can create a replacement account.

### D2. Profile endpoints serve both roles
`GET/PATCH /api/profile` and `PATCH /api/profile/password` act only on the signed-in user, for customers and staff alike. There is no route that accepts another user's id, so users cannot read or change each other's data.

### D3. Password change does not sign other sessions out
Sessions are stateless JWTs. After a password change the current cookie keeps working until it expires (24 hours by default). Revoking sessions would need a token-version column, which is not part of the agreed schema.

### D4. Deactivating a customer cancels only future active bookings
Bookings that are PENDING, APPROVED or RESCHEDULED with a slot starting in the future are cancelled by staff with the reason "Account deactivated". Past bookings are left as they are so that staff can still complete or review them. Reactivating a customer does not restore cancelled bookings.

### D5. Additional error codes
`INVALID_CURRENT_PASSWORD` (400), `RATE_LIMITED` (429) and `CONFLICT` (409, generic database conflicts) were added to the error codes listed in the specification.

### D6. Dealership names are unique per city
The same dealership name may exist in different cities, but not twice in one city. The comparison ignores letter case and is enforced both in the service (clear error message) and by a database unique index on `lower(name), lower(city)` as a safety net. Violations return 409 `CONFLICT`.

### D7. Deactivating a dealership
Deactivation is blocked (409 `HAS_ACTIVE_BOOKINGS`, with the number of bookings in the message and in `details`) while any PENDING, APPROVED or RESCHEDULED booking has a slot at that dealership starting in the future. The check and the update run in one transaction that locks the dealership row. Reactivation is always allowed. Customers only ever see active dealerships; a customer endpoint treats an inactive dealership as not found.

### D8. Removing a dealership from a vehicle keeps slot history
Slots reference the vehicle-dealership link, and bookings reference slots, so deleting a link would either erase slot history or fail. `PUT /api/admin/vehicles/:id/dealerships` therefore behaves as follows: a dealership omitted from the list is deleted from the vehicle only if it never had any slots; otherwise the link is kept with `isAvailable = false`, so history stays intact while customers no longer see the vehicle there. Making a dealership unavailable, or omitting it, is refused (409) while future PENDING, APPROVED or RESCHEDULED bookings exist (`HAS_ACTIVE_BOOKINGS`) or while active upcoming slots remain (`CONFLICT`). The response lists each blocking dealership with the counts. The whole replacement is applied in one transaction, or not at all. New links can only be added for existing, active dealerships.

### D9. Vehicle images
Images are checked by declared mime type and by file signature (JPEG, PNG or WebP), stored in memory first and written only after every file in the request is valid. Stored names are random UUIDs; the original file name is never used. A vehicle holds up to 12 images and a request may carry up to 8 files of at most `MAX_UPLOAD_MB` (5) each. Failures return 422 `UPLOAD_INVALID` (400 if the request is not readable multipart data). Exactly one image per vehicle is primary, enforced by a partial unique index: the first upload becomes primary, the primary cannot be unset directly (another image is promoted instead), and deleting the primary promotes the next image in display order. Deleting an image removes its file only when the file lives in that vehicle's upload folder, so seed images are never deleted from disk.

### D10. Public catalog query conventions
- **Multi-value filters** (`manufacturer`, `model`, `vehicleType`, `fuelType`, `transmission`) accept a comma-separated list (`manufacturer=BMW,Audi`, the documented form) and also repeated parameters (`manufacturer=BMW&manufacturer=Audi`). Up to 20 values; matching is case-insensitive for manufacturer and model. Values within one filter are alternatives (OR); different filters combine with AND.
- **Text search** (`q`) splits the text into words; every word must match the manufacturer, model, description or at least one feature (part of a word is enough, case ignored). The characters `%` and `_` are searched literally.
- **Strict queries:** unknown parameters, unknown enum values, inverted ranges (`minYear > maxYear`, `minPrice > maxPrice`) and malformed numbers return 422 with the valid options in the message. Empty parameters (`?q=`) are treated as not provided. Vehicles without a price are left out when a price filter is used and sort last when sorting by price.
- **Availability:** a slot counts as available when it is active, starts in the future, has no PENDING, APPROVED or RESCHEDULED booking, and its vehicle and dealership are active with the vehicle offered there. `availableOnly=true` keeps vehicles with at least one such slot, and `nextAvailableSlotAt` is the earliest one. When `dealershipId` or `city` is also given, only slots at matching dealerships are considered.
- **Detail page:** lists only active dealerships that currently offer the vehicle, each with `upcomingAvailableSlots`.
- **Filter options** (`GET /api/vehicles/filters`) are computed from active vehicles; cities come from active dealerships that offer at least one active vehicle.
- **Query cost:** the list uses at most four queries however many results it returns: the feature search (only when `q` is given), the page and its total count in one transaction, and one grouped query for the next slot of every vehicle on the page.

### D11. Time slots
- **Creation rules:** a slot must start in the future (`SLOT_IN_PAST`, 422), end after it starts and last between 15 and 240 minutes (`VALIDATION_ERROR`, 422). The dealership and vehicle must exist and be active, and the vehicle must be offered at that dealership; otherwise 422 with the field named, so a deactivated dealership can no longer receive new slots. Times are accepted as ISO 8601 with an offset and stored in UTC.
- **Overlaps:** slots of the same vehicle may not overlap while active, even at different dealerships (the vehicle is in one place at a time). Back-to-back slots are fine. The service checks first and answers `409 SLOT_OVERLAP`, naming the clashing slot; the database exclusion constraint remains the final safeguard, and any violation it reports is mapped to the same response. All writes that can create or move slots lock the vehicle row first, so simultaneous requests cannot slip through.
- **Editing and deactivating:** blocked with `409 HAS_ACTIVE_BOOKINGS` while a PENDING, APPROVED or RESCHEDULED booking exists on the slot (even if the slot is already in the past, so staff must complete or cancel the booking first). A slot that has already started cannot have its times changed (`409 SLOT_IN_PAST`). Reactivating a slot re-checks overlaps.
- **Customer availability** (`GET /api/vehicles/:vehicleId/slots`): default range is the next 14 days, at most 60. Results are grouped by calendar date. The optional `timeZone` parameter (an IANA name such as `Europe/London`, default `UTC`) decides which day a slot belongs to, so the date picker matches the customer's local calendar; the instants themselves are always UTC. `dates` lists the days that have at least one slot.
- **Bulk generation** (`POST /api/admin/slots/bulk`): the specification did not say how the wall-clock window is interpreted, so the request carries an IANA `timeZone` (default `UTC`) together with calendar dates (`YYYY-MM-DD`), 24-hour times (`HH:mm`) and weekdays (`MON` to `SUN`); daylight-saving changes are handled. A range may cover at most 92 days and a single request at most 500 slots. `?dryRun=true` previews without writing. Candidate slots that overlap existing active slots or start in the past are skipped and reported with the reason (and the clashing slot); the rest are created in one transaction, so repeating a request is harmless.

### D12. Booking creation
- **One transaction.** The booking, its first history row (`CREATED`) and the `BOOKING_CREATED` notification are written together; if any step fails nothing is kept. The confirmation email is attempted only after the commit and is never allowed to fail or undo the booking (when SMTP is not configured the message is printed to the API console).
- **Checks, in order:** the customer account is active; the slot exists (404); the slot, its vehicle and dealership are active and the vehicle is still offered there (`SLOT_UNAVAILABLE`, 409); the slot has not started (`SLOT_IN_PAST`, 422); no PENDING, APPROVED or RESCHEDULED booking holds the slot (`SLOT_UNAVAILABLE`); the customer has no active booking at an overlapping time (`BOOKING_CONFLICT`); the customer has fewer than `MAX_ACTIVE_BOOKINGS` (3) active bookings (`ACTIVE_BOOKING_LIMIT`). A booking whose slot has passed but is still APPROVED counts as active until staff complete or cancel it.
- **Locking.** Every booking takes locks in the same order: the customer row, shared locks on the slot's vehicle and dealership, then the slot row. The customer lock makes the overlap and limit checks safe against the same person double-clicking or booking two slots at once. The shared vehicle and dealership locks mean that deactivating a vehicle, a dealership or a slot, or changing the vehicle's dealership availability, waits for bookings in progress and then sees them, so an active booking can never end up on something that has just been deactivated. Deactivating a customer is serialised the same way. The database's partial unique index `one_active_booking_per_slot` remains the last line of defence; a violation of it is reported as `SLOT_UNAVAILABLE`, never as a server error.
- **Customer input:** only `slotId` and an optional `customerNote` (up to 500 characters; blank means no note) are accepted. The customer always comes from the session; any other field is rejected with 422.

### D13. Staff booking actions
- **Endpoints** are `PATCH /api/admin/bookings/:id/approve | reject | reschedule | cancel | complete`, staff only. Request fields: `approve` and `complete` take an optional `staffNote`; `reject` requires `rejectionReason`; `cancel` requires `cancellationReason`; `reschedule` requires `newSlotId` and takes an optional `note`. Reasons are trimmed and must be 5 to 500 characters (the specification gives the 5-character minimum for rejection; the same minimum is applied to staff cancellation). Unknown fields are rejected with 422.
- **Every action** runs in one transaction that locks the booking row, re-reads its current status, checks the transition with the state machine (409 `INVALID_STATUS_TRANSITION`, naming the current and requested status), then writes the booking change, a `booking_status_history` row and a customer notification together. The email is attempted only after the commit and can never fail the action. A booking that someone else changed in the meantime is therefore refused cleanly, and of two simultaneous actions only a legal sequence of them succeeds.
- **Complete** needs the slot to have started; otherwise 409 `INVALID_STATUS_TRANSITION` with a message that says so. **Cancel** by staff works at any time and for any active booking.
- **Reschedule** moves the booking to another slot of the same vehicle (any dealership that currently offers it). The new slot must be active, in the future, free, and its vehicle and dealership active; the customer's other bookings may not overlap it. It does not count against the active-booking limit, because the number of bookings is unchanged. History records the old and new slot ids, and the notification states both times and dealerships. Locks are taken in a fixed order (customer, vehicle, dealership, then both slots sorted by id, then the booking), which prevents deadlocks when reschedules swap or chain slots.
- **Errors specific to reschedule:** unknown new slot 404; a slot of another vehicle, or the slot the booking already has, 422 on `newSlotId`; past slot 422 `SLOT_IN_PAST`; inactive slot, taken slot, or a dealership/vehicle no longer offered 409 `SLOT_UNAVAILABLE`; customer overlap 409 `BOOKING_CONFLICT`.
- **Race between approve and cancel:** both orders are legal under the transition rules (a pending booking can be approved and then cancelled), so two simultaneous requests may both succeed. The history always forms an unbroken chain ending in the booking's current status.

### D14. Customer booking views and cancellation
- **Views (A9)**, defined once and used by both the lists and the counts: `pending` (status PENDING), `upcoming` (APPROVED or RESCHEDULED with the slot starting in the future), `completed` (COMPLETED), `cancelled` (CANCELLED and REJECTED, told apart by the `status` field), `previous` (any booking whose slot has started) and `all` (the default). `upcoming` and `pending` are sorted by slot start ascending; every other view, including `all`, by slot start descending. A booking can appear in more than one view (a completed booking is also "previous"), so the counts are not expected to add up to the total.
- **Cancellation rule (A3), one function.** `getCancellationEligibility` decides both the `canCancel` / `cancelBlockedReason` fields shown on every booking and the verdict of `PATCH /api/bookings/:id/cancel`, which only throws what that function reports. A booking can be cancelled when it is PENDING, APPROVED or RESCHEDULED and its slot starts at least `CANCELLATION_WINDOW_HOURS` (24) from now; exactly on the boundary is allowed. Otherwise: `CANCELLATION_WINDOW_PASSED` (409, with the window in the message, or a "has already started" message when the slot has begun) or `INVALID_STATUS_TRANSITION` (409, with a plain-language reason for rejected, cancelled and completed bookings).
- **Ownership.** A customer asking for someone else's booking, or one that does not exist, gets the identical 404 response, so existence is never revealed. Staff accounts are refused (403) on these customer endpoints.
- **Timeline** (`GET /api/bookings/:id`): the full status history in order, with old and new slot details for reschedules. Staff identities are never shown to customers; their actions appear as "Prestige team" and the customer's own as "You".
- **Cancelling** records `cancelledBy = CUSTOMER`, the optional reason (up to 500 characters), a history row and a `BOOKING_CANCELLED` notification, attempts an email afterwards, and frees the slot. It uses the same transaction helper as the staff actions, so it is equally safe against double clicks and simultaneous staff actions.
- **Locking note (affects Phases 5, 9, 10, 11).** The serialising row locks use `FOR NO KEY UPDATE` rather than `FOR UPDATE`. Writing a history or notification row makes PostgreSQL take a shared "key" lock on the referenced customer row, and `FOR UPDATE` conflicts with that, which allowed a deadlock between a reschedule (customer row first, booking row last) and an approve, cancel or reject of the same booking. `FOR NO KEY UPDATE` still excludes every other writer but not those foreign-key checks. Tests that race a reschedule against each of these actions guard against a regression.

### D15. Notifications and email
- **One path.** `notify(tx, userId, bookingId, type, vars)` in `notificationService.ts` is the only code that creates notification rows. It is called inside the same transaction as the status change, so a booking change, its history row and its notification always succeed or fail together. (The signature takes the transaction as its first argument, which the specification's `notify(userId, bookingId, type, vars)` does not show; without it the notification could not be part of the transaction.) It returns the prepared email, and `deliverEmails` sends those emails only after the commit, awaited, with each failure caught and logged. A failed or slow email can never undo or fail the booking action; the response simply waits for the attempt to finish. Booking creation, every staff action, customer cancellation and the customer-deactivation cascade all use it.
- **Templates** (`notificationTemplates.ts`) cover BOOKING_CREATED, APPROVED, REJECTED (with the reason), RESCHEDULED (old and new date, time and dealership), CANCELLED (says whether the customer or the team cancelled, and why) and COMPLETED. Every message names the vehicle, dealership, date and time. Times are shown in UTC because dealerships have no time zone yet.
- **Email format.** Each email has a plain-text part and an HTML part in the Prestige style (charcoal header, gold accent, serif headings, a details table). All user-supplied text is HTML-escaped in the HTML part.
- **Mail transport** (`mailService.ts`): with `SMTP_HOST` set, mail goes through nodemailer (port 465 uses TLS; authentication only when `SMTP_USER` is set; sender from `MAIL_FROM`). Without it, a readable preview of the email is printed to the API console and nothing is sent, so the demo works offline.
- **Cascade emails.** Cancelling a deactivated customer's future bookings now also emails one message per booking (previously only the in-app notification was created).
- **Inbox endpoints** (any signed-in user, own data only): `GET /api/notifications?unreadOnly=&page=&pageSize=` (newest first), `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read` (idempotent) and `PATCH /api/notifications/read-all`. Someone else's notification gets the same 404 as one that does not exist.

### D16. Staff booking list and dashboard
- **Booking list** (`GET /api/admin/bookings`): filters are `status` (one or several, comma-separated or repeated), `dealershipId`, `vehicleId`, `customerId`, `q`, `dateFrom` / `dateTo` (on the slot start, inclusive), `createdFrom` / `createdTo` (inclusive), `upcomingOnly` (slot starts in the future, whatever the status) and `sort` (`createdDesc`, the default, `slotStartAsc`, `slotStartDesc`). Dates are ISO 8601 with an offset. `q` splits into words that must all match somewhere in the customer's first name, last name, email or phone, or the vehicle's make or model; `%` and `_` are literal. Unknown parameters, bad enums and inverted ranges return 422. Empty parameters (`?upcomingOnly=`) count as not provided. The list uses one query for the page, one for the total and one batched query for the images, whatever the page size.
- **Booking detail** (`GET /api/admin/bookings/:id`): customer profile (including driving licence number and active flag), slot, vehicle, dealership, notes and reasons, and the status timeline with the real name and role of whoever made each change, plus old and new slot for reschedules.
- **Dashboard definitions.** All counts are computed in SQL. "Today", "this month" and the trend's days follow the optional `timeZone` parameter (IANA name, default `UTC`), including 23- and 25-hour days.
  - `pending`: bookings in status PENDING.
  - `todaysTestDrives`: confirmed or completed test drives (APPROVED, RESCHEDULED, COMPLETED) whose slot starts today.
  - `next7Days`: APPROVED or RESCHEDULED bookings whose slot starts between now and seven days from now.
  - `approvedUpcoming`: APPROVED or RESCHEDULED bookings whose slot is still in the future (the same meaning as the customer's "upcoming" view).
  - `completedThisMonth`, `cancelledThisMonth`, `rejectedThisMonth`: status changes to that status recorded in the history during the current month. (Bookings have no cancellation timestamp, so the history is the record of when each change happened.)
  - `totalCustomers`: every customer account; `activeVehicles` and `activeDealerships`: those not deactivated.
  - `freeSlotsNext7Days`: slots that are genuinely bookable (same rule as the customer slot list) and start within seven days.
  - `needsAttention.pendingOlderThan24h`: PENDING bookings created more than 24 hours ago. `needsAttention.pastNotCompleted`: APPROVED or RESCHEDULED bookings whose slot has started but that staff have not yet completed (RESCHEDULED is included because a rescheduled booking is a confirmed one). Each carries the full count and the ten oldest bookings.
- **Trend** (`/bookings-trend?days=14`, 1 to 90): bookings created per day, grouped by their current status into `pending`, `confirmed` (APPROVED and RESCHEDULED), `completed` and `cancelled` (CANCELLED and REJECTED), oldest day first, with empty days as zeros. The zero-filling is done in the SQL query.
- **Top vehicles** (`/top-vehicles?days=30&limit=5`, days 1 to 365, limit 1 to 20): requests of any status created in the window, most requested first, ties broken alphabetically. The optional `limit` is an addition to the specification.
- **Indexes added** (`20260101000400_dashboard_indexes`): `bookings(created_at)`, `time_slots(start_at)` and `booking_status_history(to_status, created_at)`. Checked with the query planner: the history counts, the trend window, the slot-window queries and the pending queue all use an index when the table is large enough to warrant one; with seed-sized data PostgreSQL correctly prefers scanning the tiny tables.

### D17. Backend hardening (Phase 15)
- **Strict input everywhere.** Every body, query string and path-parameter schema is strict, and a route that declares no schema for one of them accepts nothing in that place. An unexpected query parameter or body field is answered with `422 VALIDATION_ERROR` naming the field, on all 63 endpoints, instead of being ignored. Two exceptions: `GET /api/health` (so monitors may append anything) and the registration form's `role` field, which is accepted and discarded, as Phase 4 requires, so a customer can never choose a role (every other unknown field on registration is rejected). Empty query values (`?upcomingOnly=`) still count as "not provided".
- **Bounded lists.** Every paginated list caps `pageSize` at 50 (422 above that). The two lists that are not paginated are bounded another way: the public dealership list returns at most 100 dealerships, and a vehicle's dealership list is limited to 100 links by validation.
- **Automated audit.** `tests/routeAudit.test.ts` walks the real Express router and, for every route, checks: anonymous callers get 401, the wrong role gets 403, a malformed id gets 422, unknown query parameters and body fields get 422, the response uses the standard envelope and never contains a password hash, and no list endpoint issues more database operations when it returns more rows (no N+1). New routes must be classified there or the test fails.
- **API description.** `api/openapi.yaml` describes all 63 operations with request examples and error responses; tests check it against the real router, the real validation schemas (every example body is validated) and the real responses (documented field names equal the ones actually returned). It is served as Swagger UI at `/api/docs` only when `NODE_ENV=development`, with a relaxed content-security-policy on that path alone.
- **Postman.** `docs/postman-collection.json` and two environments are generated from the OpenAPI document by `npm run docs:postman`; a test fails if the committed files are out of date.
- **Coverage.** `@vitest/coverage-v8` was added as a development dependency (it is the official coverage plugin of the already-allowed vitest). The configuration fails the run if any source file is below 80% of lines.

### D18. Slot summary endpoint for the booking page (Phase 19)

- The Phase 19 brief opens the confirmation page from `/book?slotId=...` and needs the vehicle, dealership, times and the cancellation window, but no endpoint could look a slot up by id. `GET /api/bookings/slots/:id` was added (customers only, like every `/api/bookings` route). It returns the slot with its vehicle, dealership, `isAvailable` and `cancellationWindowHours` (from `CANCELLATION_WINDOW_HOURS`), and answers 404 for slots whose vehicle, dealership or slot is deactivated (A6).
- A slot that exists but can no longer be booked (taken, started, or withdrawn from the dealership) is returned with `isAvailable: false` so the page can explain it kindly instead of showing an error. The authoritative check remains the transactional one in `POST /api/bookings`.
- The booking reference shown to customers is derived from the booking id (`TD-` plus its first eight characters, upper case); there is no separate reference column.
