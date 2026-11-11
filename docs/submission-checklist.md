# Submission checklist

Tick each item before handing in the project. Commands run from the repository root.

## 1. Run it from scratch

- [ ] PostgreSQL is running and `testdrive` and `testdrive_test` exist (see the README, step 2)
- [ ] `npm install`
- [ ] `api/.env` and `web/.env` created from the `.env.example` files
- [ ] `npm run db:migrate` finishes without errors (needs the `btree_gist` extension)
- [ ] `npm run db:seed` prints 2 staff, 6 customers, 3 dealerships, 12 vehicles
- [ ] `npm run dev`, then <http://localhost:3000> shows the home page with vehicles
- [ ] <http://localhost:4000/api/health> answers `status: ok, database: up`
- [ ] <http://localhost:4000/api/docs> shows Swagger UI

## 2. Quality gates

- [ ] `npm run lint` is clean
- [ ] `npm run typecheck` is clean
- [ ] `npm run build` succeeds
- [ ] `npm run test:all` is green (API, web components, Playwright)
- [ ] `npm run test:report:docs` was run after the last test run, and `docs/test-report.md` shows 0 failing

## 3. Demonstration

- [ ] `npm run demo:reset` and one timed rehearsal of `docs/demo-script.md`
- [ ] Two browser profiles ready for the conflict demo
- [ ] Sign-in works for `staff1@prestige.test` and `amelia.hart@prestige.test` (password `Prestige#2026`)

## 4. Repository hygiene

- [ ] `git status` shows no `.env`, `uploads`, `node_modules`, `.next`, coverage or `test-results` files to be committed
- [ ] No secrets in the code (the only password in the repository is the documented demo password)
- [ ] `api/.env.example` still contains a placeholder `JWT_SECRET`
- [ ] Everything committed and pushed or zipped without `node_modules`

## 5. Documents to attach or copy into the university templates

- [ ] `docs/srs-draft.md`
- [ ] `docs/use-cases.md`
- [ ] `docs/design.md` (with `docs/er-diagram.md`)
- [ ] `docs/api-reference.md` and `docs/postman-collection.json`
- [ ] `docs/requirements-traceability.md` and `docs/requirement-verification.md`
- [ ] `docs/test-report.md` and `docs/bug-log.md`
- [ ] `docs/security.md`
- [ ] `docs/user-manual.md` with the 26 screenshots captured
- [ ] `docs/limitations-and-future-work.md`
- [ ] `docs/viva-prep.md` read at least once

## 6. Supervisor confirmation

- [ ] Business rules A1 to A11 in `docs/assumptions.md` confirmed with the supervisor (24-hour cancellation, statuses, staff accounts, localhost demonstration, e-mail plus in-app notifications)

## 7. Known limitations to state honestly

- No password reset or e-mail verification
- All staff can manage all dealerships
- Login lockout and rate limits are held in memory
- E-mail was tested with the application's own tests and a logging transport, not with a real mail provider
- Localhost only; a few dependency advisories need major upgrades (assessed in `docs/security.md`)

Details: `docs/limitations-and-future-work.md`.
