# UX polish and accessibility report (Phase 23)

## How the pages were checked

Every page was loaded at 360, 768 and 1280 px wide (as a signed-out visitor, a customer and a staff member) and measured for: horizontal overflow, interactive elements smaller than 44 px, images without alt text, form controls without a label, links and buttons without a name, duplicate ids, exactly one `h1` and one `main`. Lighthouse 12 was then run against a production build (`npm run build` and `npm run start`).

## Lighthouse (mobile profile, production build)

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| `/` | 95 | 100 | 100 | 100 |
| `/vehicles` | 73 to 92 | 100 | 100 | 100 |
| `/vehicles/[id]` | 76 to 96 | 100 | 100 | 100 |

Before the fixes: accessibility 100, 98 and 100, best practices 96 on all three. The fixes were the missing favicon (a 404 in the console), accessible names that did not contain the visible text (logo and vehicle cards), and a skipped heading level on the catalogue.

Performance varies run to run on a busy development machine (total blocking time moved between 40 and 890 ms for the same page), so it is reported as a range. It is not the target of this phase, but the largest contributor is the client-side JavaScript of the providers and the catalogue, which loads its results after the page is shown.

## Changes by screen

- **Every page:** touch targets are at least 44 px on phones and tablets (buttons, icon buttons, menu triggers, nav and footer links, breadcrumbs, filter chips, pagination, the password toggle, gallery arrows). A page that is only an empty or error state now carries its own `h1`.
- **Header and footer:** logo link name is its visible text; sign-in and create-account buttons are full height; "Staff login" and footer links are 44 px.
- **Landing:** the hero no longer fades in (the fade delayed the largest paint); an empty collection shows a message instead of a blank grid.
- **Catalogue and vehicle page:** vehicle cards use one stretched link on the title (a clear accessible name); card titles are `h2` under the page `h1`; the first three card images load eagerly; the vehicle page has a skeleton loading state.
- **Customer pages:** loading skeleton for the signed-in area.
- **Admin:** dashboard no longer overflows on phones (a hidden chart table was widening the page); each dashboard panel has its own error state with a retry; slot filters wrap on small screens; admin loading skeleton.
- **Forms:** show/hide password button, tag removal and image alt-text fields meet the 44 px target.

## Four states

Every list or page has loading (skeleton), empty (explanation and action), error (retry) and success states. The remaining gaps found by the audit were the landing collection (empty) and the three dashboard panels (error), both fixed.

## Accessibility checklist

Landmarks (`header`, `nav`, `main`, `footer`), skip link, labelled controls, `aria-live` for toasts, result counts and form errors, native `dialog` for modals and drawers (focus trap, Escape), keyboard-operable tabs, gallery and menus, text labels on every status badge, reduced-motion honoured. The date picker is a grid of buttons reachable by Tab; arrow-key movement between days is not implemented.

## SEO

Titles and descriptions per public page, Open Graph data per vehicle, `robots.txt` (admin, API, account, bookings and notifications disallowed), `sitemap.xml` (home, catalogue and every active vehicle), and `noindex` on signed-in and admin pages.

## Known limits

- Fonts are fetched from Google at build time, so a build needs internet access (a retry succeeded after one transient failure).
- Seeded SVG images are served with a short cache lifetime by the API; real uploads have unique file names and could use a longer one.
- Pages are rendered per request because the header shows the signed-in user, so the browser back/forward cache does not apply.
