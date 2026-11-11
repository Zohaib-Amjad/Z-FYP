# Software Requirements Specification (draft)

Luxury Car Test-Drive Booking and Management System ("Prestige Test Drive")

This document is self-contained so that it can be copied into a university template. Requirement identifiers (FR-n.m, NFR-x.n) are stable and are used by `docs/requirements-traceability.md`. Business rules A1 to A11 are the assumptions recorded in `docs/assumptions.md` and are subject to supervisor confirmation.

## 1. Introduction

### 1.1 Purpose

This specification defines what the system must do, the rules it applies and the qualities it must have. It is written for the project supervisor, examiners and the developer.

### 1.2 Problem statement

Test-drive requests that are handled by telephone, walk-in visits, e-mail or informal messages cause scheduling conflicts, delays, incomplete customer information, fragmented records and poor tracking. Two customers can be promised the same car at the same hour, staff cannot see one list of appointments, and customers cannot tell whether a request was accepted.

### 1.3 Product summary

A centralised web application with two interfaces over one relational database:

- a **Customer Portal** for browsing vehicles, choosing a dealership, date and time slot, submitting a test-drive request and following its status;
- a **Dealership Administration Portal** for authorised staff to manage vehicles, dealerships, time slots, customers and bookings.

### 1.4 Definitions

| Term | Meaning |
| --- | --- |
| Slot | A bookable window (start and end time) for one vehicle at one dealership |
| Active booking | A booking in status PENDING, APPROVED or RESCHEDULED; it occupies its slot |
| Available slot | A slot that is active, starts in the future and has no active booking |
| Deactivation | Soft delete: the record is kept (`is_active = false`) and hidden from customers |
| Staff | Dealership employees with the STAFF role |
| Customer | A self-registered user with the CUSTOMER role |

## 2. Scope

### 2.1 In scope

Registration and sign-in, customer profile, vehicle and dealership catalogue management, slot management, booking requests with conflict prevention, booking workflow (approve, reject, reschedule, cancel, complete), customer booking history, administrative dashboard with filtering, in-app and e-mail notifications, input validation, REST API with documentation, relational database.

### 2.2 Out of scope

Online payments, maps, live chat, mobile application, social login, AI features, cloud deployment and production container setup. The system runs on localhost only.

## 3. Stakeholders and user classes

| User class | Description | Privileges |
| --- | --- | --- |
| Visitor | Not signed in | Browse and filter vehicles, view vehicle details and available slots, register, sign in |
| Customer | Registered customer | Everything a visitor can do, plus manage own profile, book, view and cancel own bookings, read own notifications |
| Dealership staff | Employee with an account created by the seed script or another staff member | Manage all dealerships, vehicles, slots, bookings and customers; create staff accounts |
| System | The application itself and its mail transport | Sends notifications, applies business rules |

Other stakeholders: the project supervisor (confirms business rules), examiners (assess the project), dealership management (benefits from consolidated records).

## 4. Product perspective

The system is a three-tier web application:

1. a Next.js web application (React, TypeScript, Tailwind CSS) that renders both portals;
2. a standalone Express REST API (TypeScript) that holds all business rules;
3. a PostgreSQL database accessed through Prisma.

The browser calls `/api/*` on the web origin and Next.js proxies the request to Express, so the session cookie stays same-origin (A11). Optional e-mail is sent through SMTP; without SMTP settings, messages are written to the API log. Details are in `docs/design.md`.

## 5. Assumptions and constraints

### 5.1 Assumptions

- Business rules A1 to A11 (section 9) hold until the supervisor changes them.
- Dealerships, vehicles and slots are all in one time zone context per user; times are stored in UTC and shown in the viewer's local time.
- Customers have a modern browser with JavaScript and cookies enabled.
- A staff member can manage every dealership (no per-dealership scoping).

### 5.2 Constraints

- Fixed stack: Next.js (App Router), React, TypeScript strict, Tailwind CSS; Node.js and Express; PostgreSQL; only the libraries approved in the specification.
- Express is a standalone server, not Next.js API routes.
- Everything runs on localhost with no paid or hosted services.
- All API paths start with `/api`; JSON only, except multipart image upload.

## 6. Functional requirements

Each requirement lists acceptance criteria that can be checked in the running application. Error codes refer to `docs/api-error-codes.md`.

### FR-1 Registration, sign-in and sign-out

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-1.1 | A visitor can register as a customer with first name, last name, e-mail, phone, password and an optional driving licence number. | A valid form creates a CUSTOMER account and signs the user in. An e-mail already in use returns 409 `EMAIL_TAKEN`. The role cannot be supplied by the client. |
| FR-1.2 | Passwords must be at least 8 characters with a letter and a number. | A weaker password is rejected with 422 and a field message. Stored passwords are bcrypt hashes (cost 12), never plain text. |
| FR-1.3 | A user can sign in with e-mail and password. | Correct credentials set an httpOnly, SameSite=Lax session cookie. Wrong e-mail or password returns 401 `INVALID_CREDENTIALS` with the same message in both cases. A disabled account returns 403 `ACCOUNT_DISABLED`. |
| FR-1.4 | Repeated failed sign-ins are slowed down. | After 5 failures for an e-mail, further attempts are refused with 429 and a `Retry-After` header; the delay doubles up to 15 minutes. |
| FR-1.5 | A signed-in user can sign out. | The cookie is cleared and subsequent protected calls return 401. |
| FR-1.6 | Staff use the same authentication through a separate administration sign-in page. | A customer account cannot open `/admin` pages or call staff endpoints (403 `FORBIDDEN`). Staff accounts cannot be self-registered. |
| FR-1.7 | Protected pages redirect visitors to sign-in and return them afterwards. | Opening `/my-bookings` without a session leads to `/login?next=/my-bookings`; after sign-in the user lands on the original page. Only same-site targets are honoured. |

### FR-2 Customer profile

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-2.1 | A signed-in customer can view their profile. | The profile page shows name, e-mail, phone and driving licence. |
| FR-2.2 | A customer can update name, phone and driving licence. | Valid changes are saved and shown immediately; invalid values are rejected with field messages. E-mail and role cannot be changed here. |
| FR-2.3 | A customer can change their password. | The current password must be correct; the new one must satisfy FR-1.2. |
| FR-2.4 | A user can only reach their own profile. | The profile endpoints take no user identifier; there is no way to address another user. |

### FR-3 Vehicle and dealership management (staff)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-3.1 | Staff can create a vehicle with manufacturer, model, year, type, fuel type, transmission, engine, power, seats, colour, optional top speed, acceleration and starting price, features, description and an availability note. | A valid form creates the vehicle; invalid fields return 422 with messages; the vehicle appears in the staff list. |
| FR-3.2 | Staff can view and edit vehicles. | The staff list can be searched and filtered, including deactivated vehicles; edits are saved. |
| FR-3.3 | Staff can upload (up to 8 per request), edit the alt text and order of, choose a primary image for, and delete vehicle images. | Only JPEG, PNG or WebP images up to 5 MB are accepted (otherwise 422 `UPLOAD_INVALID`); exactly one image is primary. |
| FR-3.4 | Staff can set which dealerships offer a vehicle (availability information). | The vehicle detail page lists those dealerships only. |
| FR-3.5 | Staff can create, view and edit dealerships (name, address, city, phone, e-mail, opening hours, description). | The same name in the same city cannot be created twice (409). |
| FR-3.6 | Staff can deactivate and reactivate vehicles and dealerships. | The record is kept and hidden from customers. Deactivation is refused with 409 `HAS_ACTIVE_BOOKINGS` while future active bookings exist. |

### FR-4 Browsing and filtering vehicles

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-4.1 | Visitors can browse active vehicles in a paginated catalogue. | Deactivated vehicles never appear. |
| FR-4.2 | Visitors can filter by manufacturer, model, vehicle type and fuel type and search by text. | Filters can be combined; the URL reflects the filters so results can be shared; the number of results is shown. |
| FR-4.3 | Visitors can open a vehicle's detail page. | It shows images, specifications, features and the dealerships offering the vehicle, with a button to book. |
| FR-4.4 | An empty result is explained. | A "no vehicles match" message with a way to clear filters is shown. |

### FR-5 Time slots

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-5.1 | Staff can create a slot for a vehicle at a dealership with start and end times. | The end must be after the start (422); the vehicle must be offered at that dealership; the start must not be in the past. |
| FR-5.2 | Slots of the same vehicle never overlap. | Creating or editing an overlapping slot returns 409 `SLOT_OVERLAP` and the message names the conflicting time, not internal identifiers. The database enforces this independently of the application. |
| FR-5.3 | Staff can edit and deactivate slots. | A slot with a future active booking cannot be deactivated (409 `HAS_ACTIVE_BOOKINGS`). |
| FR-5.4 | Staff can create many slots in one step. | The bulk form takes a date range (at most 92 days), weekdays, a daily window, a slot length (15 to 240 minutes) and a break; a preview shows what will be created and which entries are skipped as overlaps. |
| FR-5.5 | Customers can see available slots for a vehicle, by dealership and date. | Only active, future, unbooked slots are listed; times appear in the customer's local time. |

### FR-6 Booking requests

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-6.1 | A signed-in customer can request a test drive by choosing a vehicle, dealership, date and available slot, with optional notes. | The booking is created with status PENDING and a confirmation is shown with its details. |
| FR-6.2 | A booked slot cannot be booked again. | Two simultaneous requests for one slot: exactly one succeeds, the other gets 409 `SLOT_UNAVAILABLE`. |
| FR-6.3 | A slot that has started or passed cannot be booked. | 422 `SLOT_IN_PAST`. |
| FR-6.4 | A customer cannot hold two active bookings whose times overlap. | 409 `BOOKING_CONFLICT`. |
| FR-6.5 | A customer can hold at most 3 active bookings (`MAX_ACTIVE_BOOKINGS`). | The fourth request returns 409 `ACTIVE_BOOKING_LIMIT`. |
| FR-6.6 | Only customers can book. | Staff receive 403; visitors are redirected to sign in and returned to the booking afterwards. |
| FR-6.7 | The booking page helps recover from a lost race. | If the chosen slot was taken meanwhile, the customer sees an explanation and the refreshed list of slots. |

### FR-7 Booking workflow (staff)

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-7.1 | Staff can approve a PENDING booking. | Status becomes APPROVED. |
| FR-7.2 | Staff can reject a PENDING booking with a reason. | A missing reason returns 422; status becomes REJECTED and the slot is released. |
| FR-7.3 | Staff can reschedule an active booking to another available slot of the same vehicle. | Status becomes RESCHEDULED; history records the old and the new slot; the old slot is released and the new one occupied atomically. |
| FR-7.4 | Staff can cancel an active booking at any time with a reason. | Status becomes CANCELLED and the slot is released. |
| FR-7.5 | Staff can mark an APPROVED or RESCHEDULED booking COMPLETED once its slot start has passed. | Earlier completion returns 409 `INVALID_STATUS_TRANSITION`. |
| FR-7.6 | Only transitions allowed by A2 are possible. | Any other transition, including from a final status, returns 409 `INVALID_STATUS_TRANSITION`. |
| FR-7.7 | Every status change is recorded. | A history row stores who, from, to, note and time; the booking detail shows the timeline. |

### FR-8 Customer booking history and cancellation

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-8.1 | A customer can view their bookings by view: pending, upcoming, completed, cancelled, previous and all. | Views follow A9; counts are shown; cancelled includes rejected, labelled as such. |
| FR-8.2 | A customer can open one booking and see its details and timeline. | Another customer's booking returns 404. |
| FR-8.3 | A customer can cancel their own PENDING, APPROVED or RESCHEDULED booking at least 24 hours before the slot (`CANCELLATION_WINDOW_HOURS`). | Later cancellation returns 409 `CANCELLATION_WINDOW_PASSED`; the screen explains the rule instead of showing the cancel control when it cannot apply. |
| FR-8.4 | A cancelled booking frees its slot immediately. | The slot appears as available again. |

### FR-9 Administrative dashboard and notifications

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-9.1 | Staff can list and filter all bookings by status, dealership, vehicle, customer text and date range. | Results are paginated and sortable; filters appear in the URL. |
| FR-9.2 | The dashboard summarises bookings. | It shows eight summary cards (each linking to the matching filtered list), a trend chart over a chosen number of days and the most booked vehicles. |
| FR-9.3 | Staff can view a booking and act on it from one screen. | Only the actions valid for the current status are enabled; the others are disabled with the reason. |
| FR-9.4 | Customers are notified of every status change. | An in-app notification is created in the same transaction as the change; an e-mail is then attempted. An e-mail failure never fails or rolls back the booking action. |
| FR-9.5 | Customers can read notifications and mark them as read. | A list with unread count; mark one or all as read. A customer sees only their own. |
| FR-9.6 | Staff can look up customers and deactivate or reactivate their accounts. | A searchable list (filter active or deactivated) and a detail page with the customer's bookings; a deactivated customer cannot sign in (`ACCOUNT_DISABLED`) and keeps their history. |

### FR-10 Data storage, validation and responses

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-10.1 | All application data is stored in one PostgreSQL database through the API. | There is no other data store; the schema is defined by versioned migrations. |
| FR-10.2 | Every input is validated before processing. | Bodies, query strings and path parameters are checked by strict schemas; unknown fields are rejected with 422 and per-field messages. The web forms validate with the same rules before sending. |
| FR-10.3 | Every response uses one envelope and appropriate status codes. | `{success, data}` or `{success:false, error:{code,message,details}}`; codes 200, 201, 204, 400, 401, 403, 404, 409, 422, 429 and 500 are used as defined in the specification; 500 never reveals internals. |
| FR-10.4 | Integrity is protected by the database as well as by code. | Partial unique index (one active booking per slot), exclusion constraint (no overlapping slots per vehicle), check constraint (end after start) and foreign keys. |
| FR-10.5 | The API is documented. | `api/openapi.yaml` describes all operations; Swagger UI is served in development; a Postman collection is provided. |

## 7. Non-functional requirements

### 7.1 Security

| ID | Requirement |
| --- | --- |
| NFR-S1 | Passwords are hashed with bcrypt (cost 12); sign-in does not reveal whether an e-mail exists. |
| NFR-S2 | The session is a JWT in an httpOnly, SameSite=Lax cookie, Secure in production, expiring after 24 hours. |
| NFR-S3 | Every protected route checks authentication and role; users cannot read or change other users' data. |
| NFR-S4 | Inputs are validated by strict schemas; queries use parameter binding; the web app avoids raw HTML injection. |
| NFR-S5 | The API uses helmet, CORS limited to the web origin with credentials, a cross-site request guard, request size limits and rate limits; the web app sends a nonce-based Content-Security-Policy. |
| NFR-S6 | Uploads are validated by type, signature and size and stored under server-generated names. |
| NFR-S7 | Secrets are never committed; production refuses a weak or placeholder signing secret. |
| NFR-S8 | Logs contain no passwords, cookies, query strings or request bodies; staff writes and status changes are audited. |

### 7.2 Performance

| ID | Requirement |
| --- | --- |
| NFR-P1 | Lists are paginated (default 10, maximum 50 per page) and indexed for the common filters (migration `dashboard_indexes`). |
| NFR-P2 | Catalogue and slot queries avoid per-row queries (relations are loaded in batches). |
| NFR-P3 | Pages use server rendering and image sizing to keep the largest content paint low; measured results are in `docs/ux-accessibility.md`. |

### 7.3 Usability and accessibility

| ID | Requirement |
| --- | --- |
| NFR-U1 | A responsive interface that works from 320 px wide phones to desktops. |
| NFR-U2 | Keyboard operation, visible focus, labelled form fields, accessible names and sufficient contrast (target: WCAG 2.1 AA); details and checks in `docs/ux-accessibility.md`. |
| NFR-U3 | Clear loading, empty and error states; server validation errors appear next to the field concerned. |
| NFR-U4 | Dates and times are shown in the user's local time with date-fns. |

### 7.4 Reliability

| ID | Requirement |
| --- | --- |
| NFR-R1 | Booking changes run in database transactions with row locks; concurrent requests cannot double-book a slot. |
| NFR-R2 | A failed e-mail never rolls back a booking action. |
| NFR-R3 | Deactivation is a soft delete, so history is never lost. |
| NFR-R4 | A health endpoint reports service and database state. |

### 7.5 Maintainability

| ID | Requirement |
| --- | --- |
| NFR-M1 | Strict TypeScript, ESLint and Prettier clean, no dead code. |
| NFR-M2 | Layering route, validator, controller, service, Prisma; no business logic in controllers or routes. |
| NFR-M3 | Automated unit, integration, concurrency, component and end-to-end tests; evidence in `docs/test-report.md`. |
| NFR-M4 | Documentation kept with the code: OpenAPI, generated API reference, traceability matrix. |

## 8. External interfaces

| Interface | Description |
| --- | --- |
| User interface | Two web portals in a browser: customer pages (`/`, `/vehicles`, `/book`, `/my-bookings`, `/account`, `/notifications`) and administration pages under `/admin`. |
| REST API | JSON over HTTP under `/api`, cookie authentication, one response envelope; multipart only for vehicle image upload. See `docs/api-reference.md`. |
| Database | PostgreSQL through Prisma; extension `btree_gist` is required. |
| E-mail | SMTP through Nodemailer when `SMTP_*` variables are set; otherwise messages are logged. |
| File storage | Vehicle images stored under `api/uploads` and served at `/uploads`. |

## 9. Business rules

| Rule | Statement |
| --- | --- |
| A1 | Roles are CUSTOMER and STAFF. Customers self-register. Staff accounts come from the seed script or are created by an existing staff member. All staff can manage all dealerships, vehicles, slots, bookings and customers. |
| A2 | Statuses: PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED, RESCHEDULED. Active statuses (occupying a slot): PENDING, APPROVED, RESCHEDULED. Transitions: PENDING to APPROVED, REJECTED, CANCELLED or RESCHEDULED; APPROVED to RESCHEDULED, CANCELLED or COMPLETED; RESCHEDULED to RESCHEDULED, CANCELLED or COMPLETED; REJECTED, CANCELLED and COMPLETED are final. Reject and staff-cancel require a reason. COMPLETED only after the slot start. |
| A3 | A customer may cancel their own active booking only if the slot starts at least 24 hours from now (`CANCELLATION_WINDOW_HOURS`); otherwise `CANCELLATION_WINDOW_PASSED`. Staff may cancel any active booking at any time with a reason. |
| A4 | A slot belongs to one vehicle at one dealership, has `start_at`, `end_at` (end after start) and `is_active`. Slots of one vehicle never overlap (enforced in the database). A slot is available when active, in the future and without an active booking. Past slots cannot be booked. |
| A5 | At most one active booking per slot (partial unique index plus row lock in a transaction); a customer cannot hold two active bookings with overlapping times; at most 3 active bookings per customer (`MAX_ACTIVE_BOOKINGS`). Of two simultaneous requests for one slot exactly one succeeds and the other receives 409 `SLOT_UNAVAILABLE`. |
| A6 | Deactivation is a soft delete. Deactivating a vehicle, dealership or slot with future active bookings is blocked with 409 `HAS_ACTIVE_BOOKINGS`. Deactivated items are hidden from customers but visible to staff and in history. |
| A7 | Reschedule: staff move a booking to another available slot of the same vehicle (same or different dealership if the vehicle is offered there); status becomes RESCHEDULED; history records old and new slot; the customer is notified. |
| A8 | Every status change writes a `booking_status_history` row (who, from, to, note, time) and creates a notification (in-app row plus e-mail attempt). E-mail failure never rolls back or fails the action. |
| A9 | Customer views: pending (PENDING); upcoming (APPROVED or RESCHEDULED with a future slot); completed (COMPLETED); cancelled (CANCELLED and REJECTED, labelled); previous (any booking whose slot start is in the past); all. |
| A10 | Security: bcrypt cost 12; password minimum 8 characters with a letter and a number; JWT in an httpOnly, SameSite=Lax cookie (Secure in production); helmet; CORS limited to the web origin with credentials; rate limiting on auth endpoints; zod validation everywhere; role checks on every protected route; no cross-user access; no secrets in git. |
| A11 | The browser calls `/api/*` on the web origin and Next.js proxies to Express so cookies stay same-origin. Uploaded images are served by Express under `/uploads` and also proxied. |

Design decisions that refine these rules (for example the exact slot-preview endpoint and bulk slot generation) are listed as D1 to D18 in `docs/assumptions.md`.
