# Demo script (10 minutes)

A rehearsed walkthrough of Prestige Test Drive with exact clicks and talking points. Time the first rehearsal and adjust the talking points, not the clicks.

## Before you start (2 minutes, not counted)

1. Start PostgreSQL, then reset the demo data and start the app:

   ```bash
   npm run demo:reset
   npm run dev
   ```

2. Wait until <http://localhost:3000> shows the home page and <http://localhost:4000/api/health> answers `{"success":true,...}`.
3. Open **two different browser profiles** (or one normal window and one private window) side by side. Call them **Browser A** and **Browser B**. A third tab with <http://localhost:4000/api/docs> (Swagger UI) stays ready.
4. Open a terminal in the repository root, ready for `npm run test:concurrency`.
5. Accounts, all with password `Prestige#2026`:

| Who | E-mail | Used in |
| --- | --- | --- |
| Customer 1 | `amelia.hart@prestige.test` | Browser A |
| Customer 2 | `oliver.bennett@prestige.test` | Browser B |
| Staff | `staff1@prestige.test` | Browser A or a third window |
| New customer | any e-mail you make up, for example `demo.guest@example.com` | Part 1 |

Run `npm run demo:reset` again before every rehearsal and before the real demonstration so that all numbers start the same.

## Part 1. Customer story: register, search, book (2:00)

**Say:** "Dealerships used to take test drives by phone, so double bookings were common. This portal gives customers one place to choose a car and a time, and the system guarantees a slot cannot be taken twice."

1. Browser A, home page: point out the vehicle highlights and the **Vehicles** link.
2. Click **Register**. Enter a first and last name, `demo.guest@example.com`, a phone number and the password `Prestige#2026`. Click **Create account**. **Say:** "Passwords are hashed with bcrypt, and the session is an httpOnly cookie, so scripts in the page cannot read it."
3. Click **Vehicles**. In the filters choose a **vehicle type** and a **fuel type**; type a manufacturer in the search box. **Say:** "Filters are in the address bar, so a result list can be shared or bookmarked."
4. Open a vehicle. Show the photographs, specifications, features and the showrooms that offer it.
5. In **Book a test drive**: **Select a showroom**, pick a date, pick a time slot, click **Continue to confirmation**.
6. On **Confirm your test drive** add a short note, tick the licence confirmation (enter a licence number if asked), click **Confirm booking request**.
7. Show **Your test drive is requested** with the booking reference and **Pending approval**. Click **Add to calendar** to show the downloaded appointment.
8. Click **My bookings**: the booking is under **Pending**; tabs show counts.

## Part 2. Staff story: approve, reschedule, complete (2:00)

**Say:** "Staff work from one dashboard instead of phone notes and e-mail threads."

1. Browser A: sign out (account menu, **Sign out**). Open <http://localhost:3000/admin>, which leads to the administration sign-in. Sign in as `staff1@prestige.test`.
2. Dashboard: point at the eight summary cards (the first is **Awaiting your decision**) and the trend chart.
3. Click **Awaiting your decision** (or **Bookings**, then filter status **Pending**). Open the booking you just made.
4. Click **Approve**, confirm. **Say:** "Every change is saved in the booking history and notifies the customer, and an e-mail failure can never undo it." Show the status badge and the **History** timeline.
5. Open another pending booking (a seeded one). Click **Reschedule**, choose another available slot of the same vehicle, confirm. Show the history entry with the old and the new time.
6. Open the seeded booking that is **Approved** with a time in the past (use the list with sort **Appointment: soonest first**). Click **Complete**, confirm. **Say:** "Completion is only allowed after the start time; try it on a future booking and the button is disabled with the reason."

## Part 3. Conflict demo with two browsers (1:30)

**Say:** "The hard problem is two customers choosing the same slot at the same moment."

1. Browser A: sign in as Customer 1 (`amelia.hart@prestige.test`). Browser B: sign in as Customer 2 (`oliver.bennett@prestige.test`).
2. In both, open the **same vehicle**, choose the **same showroom, date and slot**, and go to **Confirm your test drive**. Leave both pages open.
3. Click **Confirm booking request** in Browser A, then immediately in Browser B.
4. Browser A shows the confirmation. Browser B shows **That time has just been taken** with **Choose another time**.
5. **Say:** "Three layers protect this: a row lock inside a database transaction, a partial unique index that allows only one active booking per slot, and the API translating the conflict into a clear 409 answer. The same rule also stops a customer overlapping two of their own bookings or holding more than three."

## Part 4. Notifications (1:00)

1. Browser A (Customer 1): the bell in the top bar shows an unread count. Click **Notifications**. Show the entries for the booking you approved, rescheduled or completed earlier. Click **Mark all as read**; the count clears.
2. **Say:** "Each notification is created in the same transaction as the status change, so it exists exactly when the change does. E-mail is attempted after the commit; without SMTP settings the API log shows the message instead."

## Part 5. Cancellation rule (1:00)

**Say:** "Customers can cancel up to 24 hours before the appointment; staff can cancel any time with a reason."

1. Staff window: **Slots**, **Add slot**, choose a vehicle and showroom, start **in about three hours**, save. (Enter times in local time.)
2. Customer 1: book that slot (Part 1 steps 5 to 7). Staff approve it.
3. Customer 1: **My bookings**, open that booking. **Say:** "Inside 24 hours the cancel button is replaced by the rule." Show the message.
4. Open a booking more than 24 hours away (a seeded upcoming one). Click **Cancel appointment**, confirm in **Cancel this test drive?**. The booking moves to **Cancelled** and its slot is free again.

## Part 6. Security and validation (1:00)

1. Browser B (Customer 2): type `http://localhost:3000/admin` in the address bar. Show the access-denied page. **Say:** "Role checks happen in the web middleware and again in the API, which is the one that counts."
2. Sign out. In **Register**, enter a password without a number and an invalid e-mail: show the field messages. **Say:** "The same zod rules run in the browser and on the server, so bypassing the form gains nothing."
3. On **Sign in**, enter a wrong password six times for one e-mail: after five failures the message asks you to wait. **Say:** "Failed sign-ins lock the account for an increasing delay, and unknown e-mails look exactly like wrong passwords."
4. Optional, if time allows: open the browser developer tools, Network tab, and show that the session cookie is marked **HttpOnly** and that responses carry a Content-Security-Policy.

## Part 7. Swagger and the concurrency test (1:30)

1. Swagger tab, <http://localhost:4000/api/docs>: expand **Bookings**, show `POST /api/bookings` with its request body, example and the 409 and 422 responses. **Say:** "Every endpoint is described in `api/openapi.yaml`; the same file generates `docs/api-reference.md` and the Postman collection, and a test fails if they drift."
2. Terminal:

   ```bash
   npm run test:concurrency
   ```

3. Show the output: the tests that fire simultaneous booking requests for one slot pass, and each asserts exactly one success and the rest `SLOT_UNAVAILABLE`.
4. Closing line: "The full suite has 1,743 automated tests (API, components and end-to-end), all passing, and the traceability table in `docs/requirement-verification.md` maps every requirement and business rule to code and a test."

## If something goes wrong

| Problem | Quick fix |
| --- | --- |
| A page shows a server error | Check the API terminal; restart with `npm run dev`. |
| The demo state is messy | `npm run demo:reset`, then reload both browsers. |
| Part 3 does not conflict | Both browsers must use the same slot; if Browser B shows a different error, the slot may already be booked from an earlier rehearsal, so reset. |
| Sign-in is locked | Wait a minute or restart the API (the counters live in memory). |
| E-mail is not configured | Expected: the message is written to the API log. |
