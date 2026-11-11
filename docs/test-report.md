# Test report

Generated on 2026-11-11 02:35 UTC by `scripts/test-report.mjs` from the results of the real suites. Regenerate with `npm run test:report:docs` after running the suites.

## Summary

| Suite | Test files | Tests | Passed | Failed |
| --- | ---: | ---: | ---: | ---: |
| API tests (Vitest + Supertest) | 38 | 1513 | 1513 | 0 |
| Web unit and component tests (Vitest + Testing Library) | 22 | 219 | 219 | 0 |
| End-to-end tests (Playwright, Chrome) | 4 | 11 | 11 | 0 |
| **All suites** | | **1743** | **1743** | **0** |

## Coverage

| Workspace | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| API (`api/src`) | 98.95% | 98.95% | 99.03% | 95.67% |
| Web (`web/src` lib, hooks and components) | 78.25% | 78.25% | 78.68% | 91.97% |

The API threshold is 80 % of lines for every file. Web pages and layouts that are server components are exercised by the end-to-end tests instead and are not part of the web coverage figure.

## End-to-end test cases

Run against a production build of the web app and the real API with its own freshly seeded database (see `web/playwright.config.ts`).

| ID | FR | Scenario | Expected result | Actual result | Result |
| --- | --- | --- | --- | --- | --- |
| E2E-01 | FR-1, FR-4, FR-5, FR-6, FR-8 | A new customer registers, browses, filters by manufacturer, vehicle type and fuel type, opens a vehicle, picks showroom, date and time, confirms the booking. | The booking is submitted with status Pending approval and appears under Pending in My bookings. | As expected (10.0 s). | Pass |
| E2E-02 | FR-7, FR-9 | Staff open the dashboard, find a pending booking and approve it. | The customer sees the booking under Upcoming as Approved and has an unread notification. | As expected (11.2 s). | Pass |
| E2E-03 | FR-7, FR-9 | Staff reject a request: first without a reason, then with one. | The empty reason is refused; the customer sees the booking under Cancelled, labelled Rejected, with the reason. | As expected (7.5 s). | Pass |
| E2E-04 | FR-7, FR-9 | Staff reschedule a booking to another slot of the same vehicle. | The customer sees status Rescheduled, the new time and the history entry showing the move. | As expected (8.0 s). | Pass |
| E2E-05 | FR-8 | A customer cancels one booking outside the 24 hour window and tries to cancel another inside it. | Outside: cancelled with the reason recorded. Inside: no cancel button, the policy is explained and the server answers CANCELLATION_WINDOW_PASSED. | As expected (5.7 s). | Pass |
| E2E-06 | FR-6 | Two customers in separate browser contexts confirm a booking for the same slot at the same moment. | Exactly one booking succeeds; the other customer sees the friendly "time has just been taken" message. | As expected (7.0 s). | Pass |
| E2E-07 | FR-7, FR-8 | Staff complete a past approved booking. | The customer sees it under Completed and Previous; completing it again is refused (INVALID_STATUS_TRANSITION). | As expected (7.9 s). | Pass |
| E2E-08 | FR-1, FR-7 | Access control: a visitor opens private pages, a customer opens /admin, staff try to book. | Visitors are redirected to sign in; customers get the 403 page and 403 from staff APIs; staff cannot book (403) and see an explanation. | As expected (6.6 s). | Pass |
| E2E-09 | FR-3, FR-5 | Staff create a vehicle with a photograph, assign a showroom and generate slots with the bulk generator. | The customer finds the vehicle in the catalogue and sees open dates for the chosen showroom. | As expected (17.5 s). | Pass |
| E2E-10 | FR-3 | Staff deactivate a vehicle that has a future booking, cancel the booking, then deactivate again. | First attempt is blocked with the booking count and a link; the second works and the vehicle disappears from the catalogue. | As expected (8.7 s). | Pass |
| E2E-11 | FR-1 | A customer signs in with a wrong password, then correctly, then signs out. | A generic error first; then the customer is signed in; signing out shows a confirmation and the signed-out header. | As expected (6.6 s). | Pass |

## API tests (Vitest + Supertest): results by test file

| ID | FR | Test file | Tests | Passed | Failed | Result |
| --- | --- | --- | ---: | ---: | ---: | --- |
| API-01 | FR-9 | `api/tests/adminBookingsList.test.ts` | 45 | 45 | 0 | Pass |
| API-02 | FR-9 | `api/tests/adminCustomers.test.ts` | 27 | 27 | 0 | Pass |
| API-03 | FR-5 | `api/tests/adminSlots.test.ts` | 70 | 70 | 0 | Pass |
| API-04 | FR-3 | `api/tests/adminVehicles.test.ts` | 71 | 71 | 0 | Pass |
| API-05 | Cross-cutting | `api/tests/apiReference.test.ts` | 4 | 4 | 0 | Pass |
| API-06 | FR-1 | `api/tests/auth.middleware.test.ts` | 14 | 14 | 0 | Pass |
| API-07 | FR-1 | `api/tests/auth.test.ts` | 35 | 35 | 0 | Pass |
| API-08 | FR-7 | `api/tests/bookingActions.test.ts` | 118 | 118 | 0 | Pass |
| API-09 | FR-6 | `api/tests/bookingsConcurrency.test.ts` | 13 | 13 | 0 | Pass |
| API-10 | FR-6 | `api/tests/bookingsCreate.test.ts` | 50 | 50 | 0 | Pass |
| API-11 | FR-6, FR-7 | `api/tests/bookingStateMachine.test.ts` | 42 | 42 | 0 | Pass |
| API-12 | FR-4 | `api/tests/catalog.test.ts` | 70 | 70 | 0 | Pass |
| API-13 | FR-9 | `api/tests/dashboard.test.ts` | 36 | 36 | 0 | Pass |
| API-14 | FR-10 | `api/tests/database.test.ts` | 4 | 4 | 0 | Pass |
| API-15 | FR-3 | `api/tests/dealerships.test.ts` | 61 | 61 | 0 | Pass |
| API-16 | FR-10 | `api/tests/errorCodes.test.ts` | 6 | 6 | 0 | Pass |
| API-17 | FR-10 | `api/tests/errorHandling.test.ts` | 11 | 11 | 0 | Pass |
| API-18 | Cross-cutting | `api/tests/health.test.ts` | 14 | 14 | 0 | Pass |
| API-19 | FR-4 | `api/tests/likeEscape.test.ts` | 5 | 5 | 0 | Pass |
| API-20 | FR-6, FR-9 | `api/tests/mailService.test.ts` | 5 | 5 | 0 | Pass |
| API-21 | FR-8 | `api/tests/myBookings.test.ts` | 53 | 53 | 0 | Pass |
| API-22 | FR-9 | `api/tests/notifications.test.ts` | 53 | 53 | 0 | Pass |
| API-23 | FR-9 | `api/tests/notificationTemplates.test.ts` | 19 | 19 | 0 | Pass |
| API-24 | FR-10 | `api/tests/openapi.test.ts` | 141 | 141 | 0 | Pass |
| API-25 | FR-10 | `api/tests/pagination.test.ts` | 3 | 3 | 0 | Pass |
| API-26 | FR-10 | `api/tests/postman.test.ts` | 18 | 18 | 0 | Pass |
| API-27 | FR-2 | `api/tests/profile.test.ts` | 25 | 25 | 0 | Pass |
| API-28 | FR-1 | `api/tests/rateLimiters.test.ts` | 2 | 2 | 0 | Pass |
| API-29 | FR-10 | `api/tests/routeAudit.test.ts` | 271 | 271 | 0 | Pass |
| API-30 | Cross-cutting | `api/tests/security.test.ts` | 40 | 40 | 0 | Pass |
| API-31 | FR-6 | `api/tests/slotPreview.test.ts` | 6 | 6 | 0 | Pass |
| API-32 | FR-5 | `api/tests/slotsAvailability.test.ts` | 26 | 26 | 0 | Pass |
| API-33 | FR-5 | `api/tests/slotsBulk.test.ts` | 44 | 44 | 0 | Pass |
| API-34 | FR-5 | `api/tests/timeZone.test.ts` | 26 | 26 | 0 | Pass |
| API-35 | Cross-cutting | `api/tests/traceability.test.ts` | 24 | 24 | 0 | Pass |
| API-36 | FR-10 | `api/tests/validators.test.ts` | 13 | 13 | 0 | Pass |
| API-37 | FR-3 | `api/tests/vehicleAvailability.test.ts` | 15 | 15 | 0 | Pass |
| API-38 | FR-3 | `api/tests/vehicleImages.test.ts` | 33 | 33 | 0 | Pass |

## Web unit and component tests (Vitest + Testing Library): results by test file

| ID | FR | Test file | Tests | Passed | Failed | Result |
| --- | --- | --- | ---: | ---: | ---: | --- |
| WEB-01 | FR-7, FR-9 | `web/tests/adminBookings.test.ts` | 22 | 22 | 0 | Pass |
| WEB-02 | FR-3 | `web/tests/adminLists.test.ts` | 7 | 7 | 0 | Pass |
| WEB-03 | FR-3, FR-5 | `web/tests/adminSchemas.test.ts` | 17 | 17 | 0 | Pass |
| WEB-04 | FR-5 | `web/tests/adminSlots.test.ts` | 9 | 9 | 0 | Pass |
| WEB-05 | Cross-cutting | `web/tests/api.test.ts` | 9 | 9 | 0 | Pass |
| WEB-06 | FR-6 | `web/tests/booking.test.ts` | 17 | 17 | 0 | Pass |
| WEB-07 | Cross-cutting | `web/tests/calendar.test.ts` | 4 | 4 | 0 | Pass |
| WEB-08 | FR-4 | `web/tests/catalog.test.ts` | 14 | 14 | 0 | Pass |
| WEB-09 | Cross-cutting | `web/tests/components/Badges.test.tsx` | 9 | 9 | 0 | Pass |
| WEB-10 | Cross-cutting | `web/tests/components/DataTable.test.tsx` | 5 | 5 | 0 | Pass |
| WEB-11 | Cross-cutting | `web/tests/components/FormField.test.tsx` | 7 | 7 | 0 | Pass |
| WEB-12 | Cross-cutting | `web/tests/components/MyBookingCard.test.tsx` | 6 | 6 | 0 | Pass |
| WEB-13 | Cross-cutting | `web/tests/components/Pagination.test.tsx` | 5 | 5 | 0 | Pass |
| WEB-14 | Cross-cutting | `web/tests/components/SlotPicker.test.tsx` | 6 | 6 | 0 | Pass |
| WEB-15 | Cross-cutting | `web/tests/csp.test.ts` | 5 | 5 | 0 | Pass |
| WEB-16 | Cross-cutting | `web/tests/format.test.ts` | 8 | 8 | 0 | Pass |
| WEB-17 | FR-1 | `web/tests/forms.test.ts` | 5 | 5 | 0 | Pass |
| WEB-18 | FR-8 | `web/tests/myBookings.test.ts` | 12 | 12 | 0 | Pass |
| WEB-19 | Cross-cutting | `web/tests/pagination.test.ts` | 5 | 5 | 0 | Pass |
| WEB-20 | Cross-cutting | `web/tests/routeAccess.test.ts` | 33 | 33 | 0 | Pass |
| WEB-21 | FR-1, FR-2 | `web/tests/schemas.test.ts` | 11 | 11 | 0 | Pass |
| WEB-22 | Cross-cutting | `web/tests/seo.test.ts` | 3 | 3 | 0 | Pass |

## How to reproduce

```bash
npm run test:all                     # API tests, web tests, then the end-to-end tests
npm run test:report --workspace=api  # API results and coverage
npm run test:report --workspace=web  # web results and coverage
npm run test:e2e                     # end-to-end tests (writes web/e2e/results.json)
npm run test:report:docs             # rewrites this file
```
