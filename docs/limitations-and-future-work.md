# Limitations and future work

An honest account of what the system does not do, why, and what would come next. Items marked "scope" are deliberate exclusions from the project specification; the others are real limits of the current implementation.

## 1. Limitations

### 1.1 Scope exclusions (by specification)

| Limitation | Notes |
| --- | --- |
| No online payments, deposits or invoices | Test drives are free appointments. |
| No maps or directions, no live chat, no mobile application | Dealership address and opening hours are shown as text; contact is by phone or e-mail. |
| No social login, no AI features | Accounts use e-mail and password. |
| Localhost only; no hosting or cloud deployment | The project is run and demonstrated locally. The Docker file in the repository only starts a development database. |

### 1.2 Business-rule assumptions awaiting supervisor confirmation

| Assumption | Effect |
| --- | --- |
| All staff can manage all dealerships, vehicles, slots, bookings and customers (A1) | There is no per-dealership or administrator/employee distinction. |
| Cancellation window of 24 hours and at most 3 active bookings (A3, A5) | Configurable through `CANCELLATION_WINDOW_HOURS` and `MAX_ACTIVE_BOOKINGS`, but the same for every customer and dealership. |
| A booking occupies exactly one slot of one vehicle | Group visits or several vehicles in one visit need several bookings. |

### 1.3 Implementation limits

| Area | Limitation | Consequence |
| --- | --- | --- |
| Accounts | No password reset by e-mail and no e-mail address verification | A customer who forgets the password needs a staff member to help; fake e-mail addresses can register. |
| Accounts | Staff accounts have no forced password change after creation | The creator must tell the colleague to change the temporary password. |
| Sessions | One 24-hour JWT, no refresh token and no way to revoke a single session | Signing out clears the cookie; a stolen token would stay valid until it expires, except that deactivating the account blocks it immediately. |
| Brute-force protection | Lockout counters and rate limits are held in the API process memory | They reset on restart and would not be shared between several API instances. |
| E-mail | Optional SMTP; no retry queue, no bounce handling, templates in English only | A failed message is logged and not resent. It was verified with the application's own tests and a logging transport, not against a real mail provider. |
| Notifications | In-app list and e-mail only; no push or SMS; no reminders before an appointment | Customers must open the portal or read e-mail. |
| Scheduling | Slots are created manually or in bulk; no recurring rules, no holiday calendar, no buffer rules between vehicles | Staff must plan slot patterns themselves. |
| Time zones | A time zone is chosen per request (browser time zone), not stored per dealership | Dealerships in different time zones would need a per-dealership zone. |
| Search | Catalogue search uses case-insensitive text matching, not full-text ranking | Fine for a catalogue of dozens to hundreds of vehicles. |
| Images | Stored on local disk under `api/uploads`; no thumbnails or CDN | Not suitable for several servers without shared storage. |
| Reporting | One dashboard with summary cards, a trend and top vehicles; no export (CSV/PDF) | Detailed reporting needs direct database queries. |
| Internationalisation | English text only; prices are shown in GBP | No translations. |
| Audit | Audit lines go to the API log; the database keeps status history only | Staff edits to vehicles and slots are logged but not queryable in the application. |
| Dependencies | Security advisories whose fixes require major upgrades (for example Next.js, Zod, Vitest) | Assessed in `docs/security.md`; none is exploitable in the localhost scope, but they must be revisited before any real deployment. |
| Testing | End-to-end tests run in Chromium only; no automated visual or load tests | Cross-browser behaviour was not automated. |
| Accessibility | Checked with automated audits and keyboard testing, not with a full screen-reader session by users | See `docs/ux-accessibility.md` for what was and was not verified. |

## 2. Future work

Ordered by value for a real dealership group; effort is a rough estimate for one developer.

| Priority | Improvement | Why | Effort |
| --- | --- | --- | --- |
| 1 | Password reset and e-mail verification | Closes the biggest account-management gap | 2 to 3 days |
| 2 | Per-dealership staff permissions and an administrator role | Staff would only see their own dealership; administrators manage accounts | 3 to 5 days |
| 3 | Appointment reminders (e-mail and SMS) and a calendar feed | Fewer no-shows | 2 to 4 days |
| 4 | Shared store (for example Redis) for rate limiting and lockout; session revocation list | Correct behaviour with several API instances | 2 days |
| 5 | Production deployment: HTTPS, production container images, CI pipeline running `npm run test:all`, environment-specific configuration, backups | Takes the system beyond localhost | 3 to 5 days |
| 6 | Dependency upgrades to current major versions | Removes the audit advisories | 2 to 4 days plus regression testing |
| 7 | Waiting list: a customer can ask to be told when a taken slot is released | Better slot utilisation | 2 to 3 days |
| 8 | Recurring slot templates and dealership holiday calendars | Less manual slot planning | 3 to 4 days |
| 9 | Reporting exports (CSV/PDF), conversion funnel (requested, approved, completed) and no-show tracking | Management insight | 3 days |
| 10 | Customer feedback after a completed test drive | Quality measurement and follow-up for sales | 2 days |
| 11 | Maps and directions, payments for deposits on special vehicles, multilingual interface | Listed as out of scope for this project; natural extensions | 1 to 2 weeks each |
| 12 | Cross-browser end-to-end runs, load tests of the booking endpoint, a full assistive-technology review | Stronger quality evidence | 3 to 5 days |

## 3. What would change the design

- **Many dealerships in several countries:** per-dealership time zone, per-dealership permissions and a sharded or partitioned slot table; the exclusion constraint and partial unique index would still hold.
- **Very high booking traffic:** keep the row-lock approach (it is correct) but add read replicas for the catalogue and cache the catalogue and slot lists; the booking write path stays on the primary database.
- **A native mobile app:** the Express API already separates business rules from the web application, so a mobile client could use it directly, with token-based sessions instead of cookies.
