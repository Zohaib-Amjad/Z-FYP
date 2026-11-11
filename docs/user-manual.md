# User manual

Prestige Test Drive has two parts: the **Customer Portal** for booking test drives and the **Administration Portal** for dealership staff. This manual explains both step by step. Screenshot placeholders are marked **[Screenshot Sn]**; the full list of what to capture is in section 4.

Start the application first (see the README): the portal opens at <http://localhost:3000> and the administration portal at <http://localhost:3000/admin>. Demo accounts (password `Prestige#2026`): staff `staff1@prestige.test`; customer `amelia.hart@prestige.test`.

## 1. Customer guide

### 1.1 Create an account

1. Choose **Register** (or **Create account**) in the top bar.
2. Enter your first and last name, e-mail address, phone number and a password of at least 8 characters containing a letter and a number.
3. Choose **Create account**. You are signed in and taken to the home page.

If the e-mail is already registered, the form says so; use **Sign in** instead. **[Screenshot S1: registration form]**

### 1.2 Sign in and out

1. Choose **Sign in**, enter your e-mail and password and confirm.
2. If you tried to open a protected page first (for example My bookings), you return to it after signing in.
3. To sign out, open the account menu in the top bar and choose **Sign out**.

After five wrong attempts the form asks you to wait before trying again. **[Screenshot S2: sign-in form]**

### 1.3 Browse and filter vehicles

1. Choose **Vehicles** in the top bar.
2. Use the search box and the filters (manufacturer, model, vehicle type, fuel type). Filters can be combined and can be cleared again. The address in your browser reflects the filters, so you can bookmark or share a result.
3. Choose a vehicle card to see its photographs, specifications, features and the dealerships that offer it.

**[Screenshot S3: vehicle catalogue with filters]** **[Screenshot S4: vehicle detail page]**

### 1.4 Book a test drive

1. Open a vehicle page. The booking panel (**Book a test drive**) lets you **Select a showroom** that offers the vehicle, choose a date and pick an available time slot. Times are shown in your local time zone; booked, past and unavailable slots cannot be chosen.
2. Choose **Continue to confirmation** (you are asked to **Sign in to continue** if needed and return afterwards).
3. On **Confirm your test drive**, check the summary. Optionally add a note for the showroom. Confirm that you hold a valid driving licence; if your profile has no licence number yet, enter it here.
4. Choose **Confirm booking request**.
5. The page **Your test drive is requested** shows your booking reference, vehicle, showroom and time. The booking is **Pending approval** until the showroom approves it. You can use **Add to calendar** to download the appointment.

If someone else books the slot while you decide, the page tells you that the time has just been taken and offers **Choose another time**. You can hold at most three active bookings, and two active bookings cannot overlap in time; the page tells you when one of these rules stops a request. **[Screenshot S5: vehicle page booking panel with a slot chosen]** **[Screenshot S6: Confirm your test drive page]** **[Screenshot S6b: request confirmation]**

### 1.5 Follow your bookings

1. Choose **My bookings**.
2. Use the tabs to see **Upcoming**, **Pending**, **Completed**, **Cancelled** (includes declined requests, labelled), **Previous** and **All**. The numbers show how many bookings each tab holds.
3. Choose a booking to see its details and the timeline of every status change, including notes from the showroom (**History**).

| Status | Meaning |
| --- | --- |
| Pending | Waiting for the showroom's decision |
| Approved | Confirmed |
| Rescheduled | The showroom moved it to another time; check the new time |
| Rejected | The showroom declined; the reason is shown |
| Cancelled | Cancelled by you or by the showroom |
| Completed | The test drive took place |

**[Screenshot S7: My bookings with tabs]** **[Screenshot S8: booking detail with timeline]**

### 1.6 Cancel a booking

1. Open the booking and choose **Cancel appointment**.
2. In the dialog **Cancel this test drive?** optionally give a reason and confirm with **Cancel appointment**, or choose **Keep appointment**.

You can cancel a pending, approved or rescheduled booking up to 24 hours before it starts. Inside that period the button is replaced by a message that explains the rule; please contact the showroom instead. A cancelled booking frees the slot for others. **[Screenshot S9: cancel confirmation dialog]** **[Screenshot S10: cancellation not possible (message shown instead of the button)]**

### 1.7 Notifications

The bell in the top bar shows how many notifications are unread. Open **Notifications** to read them; each tells you about a change to one of your bookings (requested, approved, rejected, rescheduled, cancelled, completed). Use **Mark all as read** to clear the unread count. If e-mail is configured you also receive an e-mail. **[Screenshot S11: notifications list]**

### 1.8 Your profile

1. Choose **Account** in the account menu.
2. Change your name, phone number or driving licence number and choose **Save changes**.
3. To change your password, enter your current password and a new one in **Change password**.

Your e-mail address is your sign-in name and cannot be changed here. **[Screenshot S12: account page]**

## 2. Staff guide

### 2.1 Sign in

1. Open <http://localhost:3000/admin> (you are taken to the administration sign-in).
2. Enter your staff e-mail and password.
3. The dashboard opens. A customer account cannot enter this area. **[Screenshot S13: administration sign-in]**

### 2.2 Dashboard

The dashboard shows eight summary cards, for example bookings awaiting a decision, today's test drives, the next seven days, completed and cancelled this month and free slots. Each card opens the matching filtered list. Below are a chart of bookings over a chosen number of days and the most booked vehicles. **[Screenshot S14: dashboard]**

### 2.3 Handle bookings

1. Choose **Bookings**. Filter by status, showroom, vehicle, date range or search by customer; sort by newest request, or by appointment time (soonest or latest first).
2. Open a booking to see the customer, vehicle, dealership, slot, notes and the status timeline.
3. Use the action buttons. Actions that are not possible for the current status are disabled and say why.

| Action | When | What you enter | Result |
| --- | --- | --- | --- |
| Approve | Pending | Optional note | Approved; customer notified |
| Reject | Pending | Reason (required) | Rejected; slot released; customer notified with the reason |
| Reschedule | Pending, Approved, Rescheduled | A new available slot of the same vehicle, optional note | Rescheduled; old slot released; history shows old and new time |
| Cancel | Pending, Approved, Rescheduled | Reason (required) | Cancelled; slot released; customer notified |
| Complete | Approved or Rescheduled, after the slot start | Optional note | Completed (final) |

Rejected, cancelled and completed bookings cannot be changed again. If another staff member changes a booking first, you see a message and the current status. **[Screenshot S15: bookings list with filters]** **[Screenshot S16: booking detail with actions]** **[Screenshot S17: reject dialog with reason]** **[Screenshot S18: reschedule dialog with slot choice]**

### 2.4 Manage vehicles

1. Choose **Vehicles**. Search and filter the list; deactivated vehicles are included and marked.
2. **Add vehicle**: fill in manufacturer, model, year, type, fuel, transmission, engine, power, seats, colour, optional figures and price, features and description, then save.
3. Open a vehicle to edit details, **upload images** (JPEG, PNG or WebP, up to 5 MB each), choose the **primary** image, edit alt text and order, or delete an image.
4. Choose the showrooms where the vehicle is offered.
5. **Deactivate** hides a vehicle from customers but keeps its history. It is refused while future active bookings exist; cancel or reschedule them first. **Activate** brings it back.

**[Screenshot S19: vehicle list]** **[Screenshot S20: vehicle form with image upload]** **[Screenshot S21: deactivation blocked by active bookings]**

### 2.5 Manage showrooms (dealerships)

1. Choose **Dealerships**, then **Add showroom** or open one to edit name, address, city, phone, e-mail, opening hours and description.
2. Deactivate or activate as for vehicles (blocked while future active bookings exist). **[Screenshot S22: dealership form]**

### 2.6 Manage time slots

1. Choose **Slots**. Filter by dealership, vehicle, date and status.
2. **Add slot**: choose showroom and vehicle (the vehicle must be offered there), start and end time. Overlaps with another slot of the same vehicle are refused.
3. **Bulk create**: choose showroom and vehicle, a date range (up to 92 days), weekdays, the daily start and end, the slot length and an optional break. Use the preview step to see what will be created and the **Skipped slots** (overlaps), then **Create slots**.
4. Edit or deactivate a slot from the list. Slots with a future active booking cannot be changed or deactivated.

Times are entered and shown in your local time zone. **[Screenshot S23: slot list]** **[Screenshot S24: bulk slot creation with preview]**

### 2.7 Customers and staff

- **Customers**: search the list (name, e-mail or phone; filter active or deactivated) and open a customer to see contact details and **Booking history**. **Deactivate account** stops that customer signing in; **Reactivate account** restores access.
- **Staff**: the **Staff accounts** page lists staff and lets you create a staff account (first and last name, e-mail, phone and a **Temporary password**). Tell the new colleague the password through a secure channel and ask them to change it under **Profile**. Staff accounts cannot register themselves.

**[Screenshot S25: customer detail]** **[Screenshot S26: staff list with create form]**

## 3. Tips and messages

| Message | What to do |
| --- | --- |
| "That time has just been taken" | Choose another slot from the refreshed list |
| "You already have an appointment at this time" | Cancel the other booking or choose another time |
| "You have reached your booking limit" | Cancel or complete a booking before requesting another |
| Cancellation message instead of a button | Contact the showroom; staff can cancel at any time |
| Too many sign-in attempts | Wait a while, then try again |
| Session expired | Sign in again; you return to the page you were on |

## 4. Screenshots to capture

Capture at a desktop width of about 1440 px (S5 and S7 also at phone width, 390 px, if the report discusses responsive design). Use the seeded demo data and the accounts listed at the top.

| ID | Page | State to show | Account |
| --- | --- | --- | --- |
| S1 | `/register` | Empty form, then one with a validation message | Visitor |
| S2 | `/login` | Form with the "invalid e-mail or password" message | Visitor |
| S3 | `/vehicles` | Catalogue with at least two filters applied | Visitor |
| S4 | `/vehicles/[id]` | Detail page with images, specifications and dealerships | Visitor |
| S5 | `/vehicles/[id]` | Booking panel with showroom, date and slot chosen | Customer |
| S6 | `/book?slotId=...` | Confirm your test drive page | Customer |
| S6b | After submitting | Request confirmation with reference, vehicle, showroom and time | Customer |
| S7 | `/my-bookings` | Tabs with counts and several booking cards | Customer |
| S8 | `/my-bookings/[id]` | Detail with status timeline | Customer |
| S9 | `/my-bookings/[id]` | Cancel this test drive? dialog | Customer |
| S10 | `/my-bookings/[id]` | Booking inside 24 hours with the cancellation message instead of the button | Customer |
| S11 | `/notifications` | List with unread and read items | Customer |
| S12 | `/account` | Profile and change-password sections | Customer |
| S13 | `/admin/login` | Sign-in page | Visitor |
| S14 | `/admin` | Dashboard with cards, chart and top vehicles | Staff |
| S15 | `/admin/bookings` | List with filters applied | Staff |
| S16 | `/admin/bookings/[id]` | Pending booking with action buttons | Staff |
| S17 | `/admin/bookings/[id]` | Reject dialog with a reason typed | Staff |
| S18 | `/admin/bookings/[id]` | Reschedule dialog with a new slot selected | Staff |
| S19 | `/admin/vehicles` | Vehicle list including an inactive vehicle | Staff |
| S20 | `/admin/vehicles/[id]` | Edit form with the image manager | Staff |
| S21 | `/admin/vehicles` | Message that deactivation is blocked by active bookings | Staff |
| S22 | `/admin/dealerships/[id]` | Dealership edit form | Staff |
| S23 | `/admin/slots` | Slot list with filters | Staff |
| S24 | `/admin/slots/bulk` | Bulk form with the preview table | Staff |
| S25 | `/admin/customers/[id]` | Customer detail with booking history | Staff |
| S26 | `/admin/staff` | Staff accounts list and create form | Staff |
