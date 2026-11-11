# Frontend foundation (Phase 16)

Shared infrastructure for every page in `web/`. Later phases build on these conventions instead of redefining them.

## Design language

- Tokens live in `web/tailwind.config.ts`: `ink` (charcoal), `ivory` (warm off-white), `gold` (restrained accent), `status.*` (booking status colours), `font-display` (Cormorant Garamond) and `font-sans` (Inter) loaded through `next/font`, `rounded-card`, `rounded-control`, `shadow-soft|lift|gold`.
- Gold on light surfaces uses `gold-700` for text (AA contrast); `gold-400` is reserved for fills behind `ink-950` text and for accents on dark surfaces. Dark surfaces carry the `on-dark` class so focus rings switch to a light gold.
- Focus rings are global (`:focus-visible`), `prefers-reduced-motion` disables animation and smooth scrolling, and a skip link jumps to `#main-content`.

## Components (`web/src/components/ui`)

Button (+`ButtonLink`), Input, Select, Textarea, Checkbox, FormField, Card, Badge (+`StatusBadge` for the six booking statuses), Modal and ConfirmDialog (native `<dialog>`: focus trap and Escape for free), Toast (`useToast`), Skeleton, EmptyState, ErrorState, Pagination, Tabs (arrow-key navigation), Spinner, DataTable (table from `md` up, stacked cards below), DatePicker (month grid; only dates that have slots are selectable), PageHeader, Breadcrumbs. Import from `@/components/ui`.

## API access

- `web/src/lib/api.ts`: `api.get|post|put|patch|delete`. Sends cookies, speaks JSON, unwraps the `{success, data}` envelope and throws `ApiError` (`status`, `code`, `message`, `details`). A 401 notifies `AuthProvider` (via `onUnauthenticated`), which clears the session and redirects from protected pages.
- `web/src/lib/serverApi.ts`: `fetchPublic` for server components (public data, 60 s revalidation, returns `null` on failure so pages degrade instead of crashing).
- **Types**: `web/src/types/*.ts` mirror `api/openapi.yaml` and are kept in sync **manually**. When an endpoint shape changes, update the OpenAPI file and the matching file in `web/src/types` in the same change.
- **Query keys**: `web/src/lib/queryKeys.ts`. Every key is `[domain, scope, params]`; invalidate a whole domain with `queryKeys.<domain>.all`.

## Forms

`useApiForm({ schema, defaultValues, onSubmit })` (`web/src/hooks/useApiForm.ts`) wires react-hook-form to a zod schema. When `onSubmit` throws an `ApiError`, 422 `details` are set on the matching fields (`applyServerErrors` in `web/src/lib/forms.ts`); anything that belongs to no field is returned as `formError` for an alert above the form. Field markup always goes through `FormField`, which supplies the `id`, `aria-describedby` and `aria-invalid` wiring.

## Authentication and access rules

| Piece | Where | Behaviour |
| --- | --- | --- |
| Session cookie | `td_session` (httpOnly, set by the API) | Never readable by scripts. |
| Middleware | `web/src/middleware.ts` | Signed-out visitors on `/account`, `/my-bookings`, `/notifications`, `/book` are sent to `/login?next=…`; on `/admin/**` (except `/admin/login`) to `/admin/login?next=…`. Signed-in visitors on `/login` and `/register` are sent home. An expired token (`exp` claim) counts as signed out; the signature is verified by the API only. |
| Role rule | `requireSession()` in `web/src/lib/session.ts`, used by the `(member)` and `admin/(shell)` layouts | STAFF only under `/admin`; customer-only pages (`/account`, `/my-bookings`, `/book`) refuse staff. The wrong role sees the friendly 403 page. A cookie the API no longer accepts redirects to the login page with `session=expired`, which the middleware lets through so there is no redirect loop. |
| Client state | `AuthProvider` / `useAuth()` | `user`, `role`, `login`, `logout`, `refresh` (via `/api/auth/me`), `setUser`. The server resolves the session once in the root layout so the first paint already shows the right header. |

## Layouts and routes

- `app/(site)`: public and customer layout (header with logo, Vehicles link, sign in / create account or user menu with notification bell and unread badge; footer). `app/(site)/(member)`: guarded customer pages (populated from phase 17 on).
- `app/admin/(shell)`: guarded administration layout (sidebar + topbar). `app/admin/login` will sit outside the shell (phase 17).
- `not-found.tsx`, `error.tsx`, `loading.tsx` at the app root.

## Tests

`npm test --workspace=web` runs the pure-logic suites in `web/tests` (API client and error mapping, route access and redirect safety, token expiry, pagination window, calendar grid, formatters, query keys, server-error mapping). Component and end-to-end tests arrive in phase 24.
