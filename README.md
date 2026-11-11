# Luxury Car Test-Drive Booking and Management System

Prestige Test Drive is a full-stack web application that replaces phone calls, walk-ins and e-mail threads for luxury-car test drives with one centralised, conflict-free booking system. It has two interfaces over one PostgreSQL database:

- **Customer Portal** – browse and filter vehicles, pick a dealership, date and time slot, request a test drive, follow the status of every booking and receive notifications.
- **Dealership Administration Portal** – authorised staff manage vehicles, dealerships, time slots, customers and bookings (approve, reject, reschedule, cancel, complete) from a dashboard.

Everything runs on localhost; there is no hosting, payment, map or third-party service.

## Features by portal

### Customer Portal

| Area | What a customer can do |
| --- | --- |
| Account | Register, sign in and out, view and update the profile (name, phone, driving licence) |
| Catalogue | Search and filter vehicles by manufacturer, model, type and fuel; open a detail page with specifications, features, images and dealership availability |
| Booking | Choose a vehicle, dealership, date and an available slot; the system rejects past, taken or overlapping slots and enforces the active-booking limit |
| My bookings | See pending, upcoming, completed, cancelled and previous appointments; cancel an eligible booking (24 hours' notice); add the appointment to a calendar file |
| Notifications | In-app notifications (with an unread count) for every status change, plus an e-mail attempt |

### Administration Portal

| Area | What staff can do |
| --- | --- |
| Dashboard | Booking counts, status breakdown, upcoming appointments and a chart for a chosen period |
| Bookings | Filter and search all bookings; approve, reject (with reason), reschedule, cancel (with reason) and complete; every change is recorded in a history |
| Vehicles | Create, edit, deactivate and reactivate vehicles; upload and order images; set which dealerships offer the vehicle |
| Dealerships | Create, edit, deactivate and reactivate dealerships |
| Slots | Create, edit and deactivate single slots, or create many at once (bulk); overlapping slots for one vehicle are refused |
| Customers | Search customers and see their profile and booking history |
| Staff | List staff and create staff accounts (staff never self-register) |

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind CSS, React Query, react-hook-form with zod |
| Backend | Node.js, Express 4, TypeScript (strict), Prisma 5, zod |
| Database | PostgreSQL 14 or newer (extension `btree_gist`) |
| Security | bcrypt, JWT in an httpOnly cookie, helmet, CORS, rate limiting, CSP |
| Tests | Vitest and Supertest (API), Vitest and Testing Library (web), Playwright (end to end) |

## Prerequisites

- Node.js 20 or newer and npm 10 or newer
- PostgreSQL 14 or newer, **or** Docker Desktop (the repository ships a `docker-compose.yml` for development only)
- The database user must be allowed to run `CREATE EXTENSION btree_gist` (the standard `postgres` superuser is; the extension ships with PostgreSQL's contrib package)

## Local setup, step by step

1. **Install dependencies** (from the repository root; this installs both workspaces):

   ```bash
   npm install
   ```

2. **Create the database.** Either start the bundled container:

   ```bash
   docker compose up -d
   ```

   or create it in an existing PostgreSQL installation:

   ```sql
   CREATE DATABASE testdrive;
   CREATE DATABASE testdrive_test;
   ```

   `testdrive_test` is used only by the automated tests and is wiped on every run. If you use Docker, create it once with `docker exec luxury-testdrive-postgres psql -U postgres -c "CREATE DATABASE testdrive_test;"`.

3. **Create the environment files:**

   ```bash
   cp api/.env.example api/.env
   cp web/.env.example web/.env
   ```

   On Windows PowerShell use `Copy-Item api/.env.example api/.env` and `Copy-Item web/.env.example web/.env`. Edit `DATABASE_URL` and `DATABASE_URL_TEST` in `api/.env` if your PostgreSQL user, password or port differ.

4. **Apply the migrations:**

   ```bash
   npm run db:migrate
   ```

5. **Load the demo data** (3 dealerships, 12 vehicles, about a thousand time slots, 8 accounts and sample bookings):

   ```bash
   npm run db:seed
   ```

6. **Start both servers:**

   ```bash
   npm run dev
   ```

   | Address | What it is |
   | --- | --- |
   | <http://localhost:3000> | The web application (customer portal) |
   | <http://localhost:3000/admin> | The administration portal |
   | <http://localhost:4000/api/health> | API health check |
   | <http://localhost:4000/api/docs> | Swagger UI (development only) |

The browser only talks to port 3000; Next.js forwards `/api/*` and `/uploads/*` to the Express server, so the session cookie stays same-origin.

## Demo accounts

All seeded accounts use the password `Prestige#2026`. These are development fixtures; change or remove them before any real deployment.

| Role | E-mail |
| --- | --- |
| Staff | `staff1@prestige.test`, `staff2@prestige.test` |
| Customer | `amelia.hart@prestige.test`, `oliver.bennett@prestige.test`, `sophia.laurent@prestige.test`, `james.okafor@prestige.test`, `isabella.rossi@prestige.test`, `henry.caldwell@prestige.test` |

Staff sign in at `/admin/login`; customers at `/login`.

## Scripts

Run from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and the web app together |
| `npm run dev:api` / `npm run dev:web` | Start one of them |
| `npm run build` | Production build of both workspaces |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript for both workspaces |
| `npm run db:migrate` | Apply Prisma migrations (development) |
| `npm run db:seed` | Load the demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed the development database (destroys its data) |
| `npm run demo:reset` | Same as `db:reset`, and also deletes images uploaded during earlier demos, so every demonstration starts from identical data |
| `npm test` | API and web unit/integration tests |
| `npm run test:e2e` | Playwright end-to-end tests (builds the web app and uses its own database) |
| `npm run test:all` | Everything above |
| `npm run test:concurrency` | Only the simultaneous-booking tests |
| `npm run test:coverage` | API tests with a coverage report |
| `npm run test:report:docs` | Re-generate `docs/test-report.md` from real test runs |
| `npm run docs:api --workspace=api` | Re-generate `docs/api-reference.md` from `api/openapi.yaml` |
| `npm run docs:postman --workspace=api` | Re-generate the Postman collection and environments in `docs/` |

## Folder structure

```text
luxury-testdrive/
  api/                    Express + Prisma server
    prisma/               schema.prisma, migrations, seed.ts
    src/
      config/             environment, Prisma client, JWT secret rules
      routes/             URL to validator to controller wiring
      validators/         zod schemas for body, query and params
      controllers/        thin HTTP adapters
      services/           business rules and transactions
      middleware/         auth, validation, CSRF guard, rate limits, errors, logging
      utils/              response envelope, errors, locks, tokens, helpers
      types/              shared TypeScript types
    tests/                Vitest and Supertest suites
    scripts/              Postman and API-reference generators, e2e server
    openapi.yaml          OpenAPI 3 description of every endpoint
  web/                    Next.js application
    src/app/              pages: (site) customer portal, admin portal
    src/components/       UI kit, layouts, feature components
    src/hooks/            shared hooks (forms, filters, booking actions)
    src/lib/              API client, schemas, formatting, access rules
    tests/                component and unit tests
    e2e/                  Playwright specifications
  docs/                   documentation (see below)
  scripts/                repository-level scripts (test report)
  AGENTS.md               the project specification
```

## Testing

```bash
npm test                  # API + web tests
npm run test:e2e          # browser tests (see below)
npm run test:all          # both
npm run test:concurrency  # two clients race for one slot; exactly one wins
```

The API tests run against `DATABASE_URL_TEST` and need PostgreSQL running. The end-to-end tests start their own API (port 4100), web build (port 3100) and a `testdrive_e2e` database, so they never touch the development data. If Playwright asks for browsers, run `npx playwright install chromium` once. Results of the latest run are in [docs/test-report.md](docs/test-report.md).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/srs-draft.md](docs/srs-draft.md) | Software requirements specification |
| [docs/use-cases.md](docs/use-cases.md) | Actors, use-case diagram and fully dressed use cases |
| [docs/design.md](docs/design.md) | Architecture, data dictionary, sequence, activity and state diagrams |
| [docs/er-diagram.md](docs/er-diagram.md) | Entity-relationship diagram |
| [docs/api-reference.md](docs/api-reference.md) | Every endpoint, generated from `api/openapi.yaml` |
| [docs/api-error-codes.md](docs/api-error-codes.md) | Error codes and statuses |
| [docs/requirements-traceability.md](docs/requirements-traceability.md) | FR to endpoint to page to test |
| [docs/test-report.md](docs/test-report.md), [docs/bug-log.md](docs/bug-log.md) | Test evidence and defects found |
| [docs/security.md](docs/security.md) | Security review |
| [docs/requirement-verification.md](docs/requirement-verification.md) | Every FR and business rule mapped to code and a test |
| [docs/demo-script.md](docs/demo-script.md) | Ten-minute demonstration with exact clicks |
| [docs/user-manual.md](docs/user-manual.md) | Customer and staff guides |
| [docs/viva-prep.md](docs/viva-prep.md) | Viva questions and answers |
| [docs/limitations-and-future-work.md](docs/limitations-and-future-work.md) | Known limits and next steps |
| [docs/assumptions.md](docs/assumptions.md) | Business rules A1 to A11 and design decisions |

## Troubleshooting

| Problem | Cause and fix |
| --- | --- |
| `EADDRINUSE` on port 3000 or 4000 | Another process holds the port. Stop it, or change `PORT` in `api/.env` (and `API_URL`, `WEB_ORIGIN` to match) and the `-p` value in `web/package.json`. On Windows: `netstat -ano \| findstr :4000`, then `taskkill /PID <pid> /F`. |
| `Can't reach database server` / `ECONNREFUSED 5432` | PostgreSQL is not running or `DATABASE_URL` is wrong. Start the service (or `docker compose up -d`) and check user, password, port and database name in `api/.env`. |
| `database "testdrive" does not exist` | Create it (step 2). |
| `permission denied to create extension "btree_gist"` or `extension "btree_gist" is not available` | The migration `scheduling_constraints` needs the `btree_gist` extension for the no-overlap constraint. Connect as a superuser and run `CREATE EXTENSION IF NOT EXISTS btree_gist;` in the database, or install PostgreSQL's contrib package (`postgresql-contrib` on Debian/Ubuntu), then re-run `npm run db:migrate`. |
| Browser shows 502 or "Failed to proxy" | The API is not running. Start it (`npm run dev:api`) and reload. |
| Sign-in loops back to the login page | `WEB_ORIGIN` in `api/.env` must equal the address in the browser (`http://localhost:3000`), and cookies must be allowed. |
| `@prisma/client did not initialize yet` or Prisma errors after pulling changes | `npm install` generates the client automatically; if your npm blocks install scripts, run `npm run prisma:generate --workspace=api`, then `npm run db:migrate`. |
| `npm run build` prints `fetch failed ECONNREFUSED` | The home page and sitemap read the catalogue from the API while they are built. The build still succeeds, but start the API first (and the database) if you want the built pages to contain real content. |
| E-mails do not arrive | Without `SMTP_*` values the API writes e-mails to its console instead; that is intended for local use. |
| E2E tests cannot start | Make sure ports 3100 and 4100 are free and PostgreSQL is running. |
