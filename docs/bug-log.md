# Bug log

Defects found while building and testing the frontend (phases 16 to 24), what each was, where it lived and how it was fixed. Backend defects found in phases 2 to 15 are recorded in `docs/assumptions.md` (decisions D1 to D17) and the commit history.

| # | Found in | What went wrong | Where | Fix |
| --- | --- | --- | --- | --- |
| 1 | Phase 16 (unit test) | Role rules ignored a query string: `/book?slotId=...` was not recognised as a customer-only page, so staff would not have been refused by the layout. | `web/src/lib/routeAccess.ts` (`matchesPrefix`) | Paths are compared without their query string or hash; test `routeAccess.test.ts`. |
| 2 | Phase 17 (browser check) | Submitting the sign-in form before the page finished loading did a native GET and put the email and password in the URL. | `LoginForm`, `RegisterForm`, `ProfileForm`, `ChangePasswordForm` | Every form declares `method="post"`, so an early submit can never place credentials in a query string. |
| 3 | Phase 17 (API test run in phase 19) | Rewording the FR-2 status in the traceability file made the API's traceability test fail ("API done" text missing). | `docs/requirements-traceability.md` | Status wording restored to keep the "API done" marker; the full API suite is now run after any doc edit that touches that file. |
| 4 | Phase 18 (review) | Typing quickly in the debounced search could be overwritten by the earlier committed value coming back from the URL. | `web/src/components/catalog/DebouncedInput.tsx` | The input remembers the last value it committed and only adopts a URL value that differs from it. |
| 5 | Phase 19 (browser check) | `/book` was guarded only inside the layout, so a signed-out visitor received a streamed page instead of a real redirect. | `web/src/lib/routeAccess.ts` | `/book` added to the protected prefixes; middleware now redirects with `next=`. |
| 6 | Phase 19 (spec gap) | No endpoint could describe a slot by id, so `/book?slotId=...` could not show the vehicle, showroom or cancellation window. | `api/src/services/slotPreview.service.ts` | Added `GET /api/bookings/slots/:id` (customers only) with tests, OpenAPI and Postman updates (decision D18). |
| 7 | Phase 22 (browser check) | The server's slot-overlap message exposed slot ids and UTC timestamps to staff. | `SlotForm`, `EditSlotDialog`, `BulkWizard` | Plain-language wording for `SLOT_OVERLAP` and `SLOT_IN_PAST` (`describeSlotProblem`, tested). |
| 8 | Phase 23 (audit) | The admin dashboard overflowed horizontally on phones: a screen-reader-only chart table was wider than the screen. | `TrendChart.tsx` | The table is wrapped in a screen-reader-only container. |
| 9 | Phase 23 (audit) | Many controls were under 44 px; the logo link and vehicle cards had accessible names that did not contain their visible text; the catalogue skipped a heading level; pages that showed only an empty or error state had no heading; the favicon returned 404. | Header, footer, breadcrumbs, filters, `VehicleCard`, `EmptyState`, `ErrorState`, `app/icon.svg` | Sizes raised to 44 px, one stretched link per card, `h2` card titles on the catalogue, `headingLevel` on state components, favicon added. Lighthouse accessibility and best practices are 100 on all three pages checked. |
| 10 | Phase 23 (Lighthouse) | The hero fade-in delayed the largest contentful paint. | `web/src/app/(site)/page.tsx` | Animation removed from the hero text. |

## Phase 24 (end-to-end and component tests)

The eleven end-to-end scenarios and 38 component tests found **no new defects in the application**. The failures seen while writing them were in the tests themselves and were corrected there:

- form labels carry a required-field asterisk, so exact label lookups missed them (helper `labelled` added);
- a text lookup matched two elements in the history timeline (made exact);
- a locator for the showroom list was too broad (narrowed to the list items).

The race test (E2E-06) passed on every run: of two customers confirming the same slot at the same moment, exactly one succeeded and the other saw the friendly message.
