# MASTER CONTEXT: Luxury Car Test-Drive Booking and Management System

You are a senior full-stack engineer building a complete university final-year project from zero to a finished, demo-ready state. Read this whole message. It is the permanent specification. Every later phase message refers back to it.

## 1. PROJECT
Name: Luxury Car Test-Drive Booking and Management System.
Domain: Full-Stack Web Development.
Problem: Test-drive requests handled by phone, visits, emails or informal communication cause scheduling conflicts, delays, incomplete customer information, fragmented records and poor tracking.
Solution: A centralized web app with two interfaces:
  (a) Customer Portal: browse and view vehicles, select a dealership, choose available date and time slot, submit a test-drive request, monitor booking status and history.
  (b) Dealership Administration Portal: authorized staff manage vehicles, dealerships, schedules (time slots), customers and test-drive bookings, including approving, rejecting, rescheduling, cancelling and completing appointments.
The system must include: secure authentication and authorization, validation, conflict-free scheduling, RESTful APIs, and a relational database.

## 2. FUNCTIONAL REQUIREMENTS (do not drop or weaken any)
FR-1  Customers can register and securely log in and out. Authorized dealership staff access the administration portal through authenticated accounts.
FR-2  Authenticated customers can view and update their personal profile information.
FR-3  Authorized staff can add, view, update and deactivate vehicle records and dealership records, including vehicle specifications, features, images and availability information.
FR-4  Customers can browse, search and filter available luxury vehicles by manufacturer, model, vehicle type and fuel type, and view detailed vehicle information.
FR-5  Authorized staff can create, update and deactivate test-drive time slots for specific vehicles and dealerships. Customers can view available slots.
FR-6  Authenticated customers can select an available vehicle, dealership, date and time slot and submit a test-drive booking request. The system prevents duplicate or conflicting bookings.
FR-7  Authorized staff can approve, reject, reschedule, cancel or complete test-drive bookings. The booking status updates accordingly.
FR-8  Customers can view their pending, upcoming, completed, cancelled and previous appointments, and cancel eligible appointments according to defined cancellation rules.
FR-9  Authorized staff can view and filter booking records through an administrative dashboard. Customers are notified of booking status changes.
FR-10 Application data is stored and retrieved through a centralized relational database. User inputs are validated before processing. Requests return appropriate responses for valid and invalid operations.

## 3. TECH STACK (fixed, do not replace)
Frontend: Next.js (App Router), React, TypeScript (strict), Tailwind CSS.
Backend: Node.js + Express.js, TypeScript. Standalone Express server (NOT Next.js API routes).
Database: PostgreSQL.
Dev environment: VS Code, everything runs on localhost. No hosting, no cloud deployment, no paid services.
Allowed supporting libraries (only these unless you ask me first):
  api: prisma + @prisma/client, zod, bcryptjs, jsonwebtoken, cookie-parser, cors, helmet, express-rate-limit, morgan, multer, nodemailer, dotenv, swagger-ui-express + yaml (or swagger-jsdoc), tsx, vitest or jest, supertest, eslint, prettier, date-fns.
  web: react-hook-form, @hookform/resolvers, zod, @tanstack/react-query, date-fns, clsx, lucide-react, recharts (admin chart only), eslint, prettier, vitest + @testing-library/react (optional), playwright (e2e).
Out of scope (do NOT build): online payments, maps, live chat, mobile app, social login, AI features, cloud deployment, Docker production setup.

## 4. ARCHITECTURE AND CONVENTIONS
Repo layout (monorepo, npm workspaces or two folders with root scripts):
  luxury-testdrive/
    api/   (Express + Prisma)   src/{config,routes,controllers,services,middleware,validators,utils,types} prisma/ tests/
    web/   (Next.js)            src/{app,components,lib,hooks,types}
    docs/  (documentation, diagrams, traceability)
    AGENTS.md  README.md  .gitignore  .env.example files
Layering in api: route -> validator (zod) -> controller (thin) -> service (business rules, DB transactions) -> prisma. No business logic in controllers or routes.
All API paths start with /api. JSON only (except image upload: multipart).
Response envelope for every endpoint:
  success: { "success": true, "data": ..., "message": "optional" }
  failure: { "success": false, "error": { "code": "MACHINE_CODE", "message": "human readable", "details": [ {field, message} ] } }
HTTP codes: 200, 201, 204, 400 (malformed), 401 (not logged in), 403 (wrong role), 404, 409 (conflict), 422 (validation), 429 (rate limit), 500 (never leak stack traces).
Error codes to use: VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, EMAIL_TAKEN, INVALID_CREDENTIALS, ACCOUNT_DISABLED, SLOT_UNAVAILABLE, BOOKING_CONFLICT, SLOT_IN_PAST, CANCELLATION_WINDOW_PASSED, INVALID_STATUS_TRANSITION, HAS_ACTIVE_BOOKINGS, ACTIVE_BOOKING_LIMIT, SLOT_OVERLAP, UPLOAD_INVALID, INTERNAL_ERROR.
IDs are UUIDs. Timestamps are stored as UTC (timestamptz). The UI shows times in the user's local time using date-fns.
Naming: camelCase in code, snake_case table/column names via Prisma @map.
Code quality: TypeScript strict, no `any` unless justified, no dead code, no TODO placeholders, no commented-out code, ESLint + Prettier clean, small functions, meaningful names.

## 5. BUSINESS RULES (assumptions to apply everywhere; the student will confirm with the supervisor)
A1 Roles: CUSTOMER and STAFF. Customers self-register. Staff accounts are NOT self-registered: they come from the seed script or are created by an existing staff member. All staff can manage all dealerships, vehicles, slots, bookings and customers.
A2 Booking statuses: PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED, RESCHEDULED.
   Active statuses (they occupy a slot): PENDING, APPROVED, RESCHEDULED.
   Allowed transitions:
     PENDING     -> APPROVED | REJECTED | CANCELLED | RESCHEDULED
     APPROVED    -> RESCHEDULED | CANCELLED | COMPLETED
     RESCHEDULED -> RESCHEDULED | CANCELLED | COMPLETED
     REJECTED, CANCELLED, COMPLETED are final.
   Reject and staff-cancel require a reason. COMPLETED is allowed only when the slot start time is in the past.
A3 Cancellation rule: a customer may cancel their own PENDING/APPROVED/RESCHEDULED booking only if the slot starts at least CANCELLATION_WINDOW_HOURS (default 24) from now. Otherwise return CANCELLATION_WINDOW_PASSED. Staff may cancel any active booking at any time with a reason.
A4 Slots: a slot belongs to one vehicle at one dealership and has start_at, end_at (end > start), is_active. Slots of the same vehicle must never overlap (enforced in the database). A slot is "available" when it is active, starts in the future, and has no active booking. Customers cannot book past slots.
A5 Conflict-free booking: (i) at most one active booking per slot (database partial unique index, plus a row lock inside a transaction), (ii) a customer cannot hold two active bookings whose slot times overlap, (iii) a customer can have at most MAX_ACTIVE_BOOKINGS (default 3) active bookings. Two simultaneous requests for the same slot: exactly one succeeds, the other gets 409 SLOT_UNAVAILABLE.
A6 Deactivation is a soft delete (is_active=false), never a hard delete. Deactivating a vehicle, dealership or slot that has future active bookings is blocked with 409 HAS_ACTIVE_BOOKINGS (staff must cancel or reschedule those first). Deactivated items are hidden from customers but remain visible to staff and in history.
A7 Reschedule = staff moves a booking to another available slot of the same vehicle (same or different dealership if the vehicle is available there). Status becomes RESCHEDULED, history records old slot and new slot, customer is notified.
A8 Every status change writes a row in booking_status_history (who, from, to, note, time) and creates a notification for the customer (in-app notification row + email attempt). Email failure must never roll back or fail the booking action.
A9 Customer history views: pending (status PENDING), upcoming (APPROVED/RESCHEDULED with slot in the future), completed (COMPLETED), cancelled (CANCELLED and REJECTED, labelled), previous (any booking whose slot start is in the past), all.
A10 Security: passwords hashed with bcrypt (cost 12), min 8 chars with letter and number; JWT in an httpOnly, SameSite=Lax cookie (Secure in production); helmet; CORS limited to the web origin with credentials; rate limiting on auth endpoints; all inputs validated with zod; role checks on every protected route; users cannot read or change other users' data; no secrets in git.
A11 Web and API talk through a Next.js rewrite: browser calls /api/* on the web origin and Next.js proxies to the Express server (so cookies stay same-origin). Uploaded images are served by Express under /uploads and also proxied.

## 6. WORKING RULES FOR YOU (the AI)
1. I will give you the work in numbered phases. Do only the current phase, but do it completely. Do not skip any bullet, do not leave stubs.
2. Before writing code in a phase, inspect the existing repo so you extend instead of duplicating.
3. After each phase: run install, typecheck, lint, build and the tests that exist; fix everything; then reply with (a) files created/changed, (b) commands I should run, (c) what I should manually verify, (d) anything you could not do and why.
4. Keep docs/requirements-traceability.md updated: each FR -> endpoints -> pages -> tests -> status.
5. Never invent requirements, never add out-of-scope features, never use libraries outside the allowed list without asking.
6. If something in a phase conflicts with this document, tell me instead of silently choosing.
7. Use realistic, polished, luxury-brand UI copy. No lorem ipsum, no "test123" in UI.

