# API error codes

Every failed request returns the same envelope, with a machine-readable `code`, a human-readable `message` and, for validation problems, a `details` list:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "Enter a valid email address" }]
  }
}
```

Stack traces, SQL and internal messages are never included. Unexpected errors are logged on the server and returned as `INTERNAL_ERROR`.

The HTTP status is part of the contract: a client can rely on the code and the status together. Codes marked with two statuses are explained in the table.

## Codes

| Code | HTTP status | When it occurs |
|---|---|---|
| `VALIDATION_ERROR` | 422 (also 400, 413 and 415) | A body, query string or path parameter failed validation: a missing or malformed field, an unknown field, an invalid enum value, a malformed id, an inverted date range, a page size above 50. Also used for input that is well-formed but refers to something unusable: an unknown or deactivated dealership or vehicle in a slot request, a vehicle that is not offered at the dealership, a slot shorter than 15 or longer than 240 minutes, rescheduling to the slot the booking already has or to another vehicle's slot, unsetting a vehicle's only primary image. **400** is returned for a body that is not valid JSON; **413** for a body over 100 KB; **415** for a request body that is not JSON (multipart is accepted only for the image upload). |
| `UNAUTHENTICATED` | 401 | No session cookie, or the session is invalid, tampered with or expired, or the account no longer exists. |
| `FORBIDDEN` | 403 | The signed-in role may not use the endpoint: a customer calling a staff endpoint, or staff calling a customer endpoint. |
| `NOT_FOUND` | 404 | The route, the resource or the referenced slot does not exist. It is also what a customer gets for another customer's booking or notification, so the existence of other people's records is never revealed. |
| `CONFLICT` | 409 | A generic conflict with existing data: a dealership name already used in the same city, a database uniqueness or foreign-key conflict, or withdrawing a vehicle from a dealership that still has active upcoming slots. |
| `RATE_LIMITED` | 429 | Too many requests: more than 300 requests per 15 minutes from one IP, more than 10 sign-in or registration attempts per 15 minutes for one IP and email, more than 10 password-change attempts per user, or an account locked after 5 failed sign-ins (the lock doubles from 30 seconds up to 15 minutes and the response carries `Retry-After`). |
| `EMAIL_TAKEN` | 409 | Registering, or creating a staff account, with an email address that already exists (letter case is ignored). |
| `INVALID_CREDENTIALS` | 401 | Signing in with a wrong password or an unknown email. The answer is identical for both, so accounts cannot be discovered. |
| `INVALID_CURRENT_PASSWORD` | 400 | Changing a password with an incorrect current password. |
| `ACCOUNT_DISABLED` | 403 | The account has been deactivated: on sign-in (only after the correct password), on any later request with an existing session, or when trying to book. |
| `SLOT_UNAVAILABLE` | 409 | The slot cannot be booked: it already has an active booking, it is inactive, its vehicle or dealership is deactivated, or the vehicle is no longer offered there. Of several simultaneous requests for one slot, exactly one succeeds and the rest receive this. |
| `BOOKING_CONFLICT` | 409 | The customer already has an active booking whose time overlaps the requested slot (also checked when staff reschedule a booking). |
| `SLOT_IN_PAST` | 422 (also 409) | **422**: a slot to be booked or created starts in the past, or a changed start time is in the past. **409**: an existing slot that has already started cannot have its times changed. |
| `CANCELLATION_WINDOW_PASSED` | 409 | A customer tries to cancel a booking whose slot starts in less than `CANCELLATION_WINDOW_HOURS` (24 hours), or has already started. The message states the window. Staff are not subject to this rule. |
| `INVALID_STATUS_TRANSITION` | 409 | The booking's current status does not allow the action: approving a booking that is not pending, acting on a rejected, cancelled or completed booking, or completing a booking whose test drive has not started. The message names the current and requested status (or says why a customer cannot cancel). |
| `HAS_ACTIVE_BOOKINGS` | 409 | Deactivating a vehicle or dealership that has future pending, approved or rescheduled bookings; changing or deactivating a slot that has an active booking; withdrawing a vehicle from a dealership with such bookings. `details` carries the number of bookings. |
| `ACTIVE_BOOKING_LIMIT` | 409 | The customer already has `MAX_ACTIVE_BOOKINGS` (3) active bookings. |
| `SLOT_OVERLAP` | 409 | A new, changed or reactivated slot overlaps another active slot of the same vehicle. `details` names the clashing slot. The database enforces this as well. |
| `UPLOAD_INVALID` | 422 (also 400) | An image upload failed: no file, a file that is not a JPEG, PNG or WebP (checked by declared type and by the file's first bytes), a file above 5 MB, more than 8 files in a request, more than 12 images on a vehicle, or the wrong form field. **400** is returned when the request is not readable multipart form data. |
| `INTERNAL_ERROR` | 500 (also 503) | An unexpected server error. The response carries a generic message only. **503** is returned by `GET /api/health` when the database cannot be reached. |

## Other statuses

| Status | Meaning |
|---|---|
| 200 | Success (reads, updates, actions, a bulk-slot dry run). |
| 201 | Created (a booking, account, vehicle, dealership, slot, image upload or bulk slot generation). |
| 204 | Not used: every endpoint returns the envelope. |

## Status quick reference

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` (malformed JSON), `INVALID_CURRENT_PASSWORD`, `UPLOAD_INVALID` (unreadable upload) |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` (wrong role, or a state-changing request from an untrusted origin), `ACCOUNT_DISABLED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT`, `EMAIL_TAKEN`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `SLOT_IN_PAST`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `HAS_ACTIVE_BOOKINGS`, `ACTIVE_BOOKING_LIMIT`, `SLOT_OVERLAP` |
| 413 | `VALIDATION_ERROR` (body too large) |
| 415 | `VALIDATION_ERROR` (body is not JSON) |
| 422 | `VALIDATION_ERROR`, `SLOT_IN_PAST`, `UPLOAD_INVALID` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `INTERNAL_ERROR` (health check, database down) |

`CONFLICT`, `RATE_LIMITED` and `INVALID_CURRENT_PASSWORD` are additions to the error codes listed in the project specification; see `docs/assumptions.md` (D5).
