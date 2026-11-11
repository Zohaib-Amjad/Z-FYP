# API reference

Generated from `api/openapi.yaml` by `npm run docs:api --workspace=api`; do not edit by hand. 63 operations, version 1.0.0.

**Interactive documentation:** with the API running in development, open <http://localhost:4000/api/docs> (Swagger UI). It is not served in production.

**Base URLs:** `http://localhost:4000` (the API directly) and `http://localhost:3000` (through the web application, which is what the browser uses so that cookies stay same-origin).

REST API for the Luxury Car Test-Drive Booking and Management System.

**Conventions**
- Every response uses an envelope: `{ "success": true, "data": ..., "message": "optional" }` on success and
  `{ "success": false, "error": { "code": "MACHINE_CODE", "message": "...", "details": [{ "field": "...", "message": "..." }] } }` on failure.
- Authentication is a JWT in an httpOnly, SameSite=Lax cookie named `td_session`, set by `POST /api/auth/login`
  or `POST /api/auth/register`. Two roles exist: `CUSTOMER` and `STAFF`.
- Request bodies, query strings and path parameters are validated; unknown fields are rejected with `422`.
- All identifiers are UUIDs and all timestamps are ISO 8601 in UTC.
- Lists are paginated with `page` (from 1) and `pageSize` (1 to 50, default 10).
- Multi-value filters accept a comma-separated list (`status=PENDING,APPROVED`) or repeated parameters.
- Error codes and their HTTP statuses are listed in `docs/api-error-codes.md`.

**Try it:** sign in with `POST /api/auth/login` (demo accounts are printed by `npm run db:seed`), then call any
other endpoint from this page; the browser sends the session cookie automatically.

## Contents

| Group | Operations |
| --- | ---: |
| [Health](#health) | 1 |
| [Auth](#auth) | 4 |
| [Profile](#profile) | 3 |
| [Catalog](#catalog) | 3 |
| [Dealerships](#dealerships) | 2 |
| [Slots](#slots) | 1 |
| [Bookings](#bookings) | 6 |
| [Notifications](#notifications) | 4 |
| [Admin - Bookings](#admin-bookings) | 7 |
| [Admin - Dashboard](#admin-dashboard) | 3 |
| [Admin - Vehicles](#admin-vehicles) | 11 |
| [Admin - Dealerships](#admin-dealerships) | 6 |
| [Admin - Slots](#admin-slots) | 7 |
| [Admin - Customers](#admin-customers) | 3 |
| [Admin - Staff](#admin-staff) | 2 |

## Health

### GET `/api/health`

Service and database health

Access: **Public (no sign-in)**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The service and its database are up. |
| 503 | The database is unavailable. |

Example success response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "up"
  }
}
```

## Auth

### POST `/api/auth/register`

Register a customer account and sign in

Access: **Public (no sign-in)**

Always creates a `CUSTOMER`. A `role` in the body is ignored. Rate limited per IP and email.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `firstName` | yes | string |  |
| `lastName` | yes | string |  |
| `email` | yes | string, email |  |
| `password` | yes | string | At least one letter and one number. |
| `confirmPassword` | yes | string |  |
| `phone` | yes | string |  |
| `drivingLicenseNumber` | no | string |  |

Example:

```json
{
  "firstName": "Charlotte",
  "lastName": "Ainsworth",
  "email": "charlotte.ainsworth@example.com",
  "password": "Velvet2026",
  "confirmPassword": "Velvet2026",
  "phone": "+44 7700 900777",
  "drivingLicenseNumber": "AINSW901015C99XY"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | The account was created. |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |
| 429 | Too many requests (`RATE_LIMITED`). |

### POST `/api/auth/login`

Sign in (customers and staff)

Access: **Public (no sign-in)**

Sets the session cookie. Unknown email and wrong password give the same `INVALID_CREDENTIALS` answer.
A deactivated account gets `ACCOUNT_DISABLED`. Rate limited per IP and email.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `email` | yes | string, email |  |
| `password` | yes | string |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The user (never includes the password hash). |
| 401 | Wrong email or password (`INVALID_CREDENTIALS`); the answer is identical for unknown emails. |
| 403 | The account has been deactivated (`ACCOUNT_DISABLED`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |
| 429 | Too many requests (`RATE_LIMITED`). |

Example success response:

```json
{
  "success": true,
  "data": {
    "id": "0bbe7e55-75e7-4355-b1e3-af30b7b9ee11",
    "email": "amelia.hart@prestige.test",
    "role": "CUSTOMER",
    "firstName": "Amelia",
    "lastName": "Hart",
    "phone": "+44 7700 900111",
    "drivingLicenseNumber": "HART9503126A99XY",
    "isActive": true,
    "lastLoginAt": "2030-03-01T09:30:00.000Z",
    "createdAt": "2030-01-10T08:00:00.000Z"
  }
}
```

### POST `/api/auth/logout`

Sign out

Access: **Public (no sign-in)**

Clears the session cookie. Works even when nobody is signed in.

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Done. `data` is null. |

Example success response:

```json
{
  "success": true,
  "message": "Signed out successfully",
  "data": null
}
```

### GET `/api/auth/me`

The signed-in user

Access: **Any signed-in user**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The user (never includes the password hash). |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The account has been deactivated (`ACCOUNT_DISABLED`). |

Example success response:

```json
{
  "success": true,
  "data": {
    "id": "0bbe7e55-75e7-4355-b1e3-af30b7b9ee11",
    "email": "amelia.hart@prestige.test",
    "role": "CUSTOMER",
    "firstName": "Amelia",
    "lastName": "Hart",
    "phone": "+44 7700 900111",
    "drivingLicenseNumber": "HART9503126A99XY",
    "isActive": true,
    "lastLoginAt": "2030-03-01T09:30:00.000Z",
    "createdAt": "2030-01-10T08:00:00.000Z"
  }
}
```

## Profile

### GET `/api/profile`

Own profile (customers and staff)

Access: **Any signed-in user**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The user (never includes the password hash). |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |

Example success response:

```json
{
  "success": true,
  "data": {
    "id": "0bbe7e55-75e7-4355-b1e3-af30b7b9ee11",
    "email": "amelia.hart@prestige.test",
    "role": "CUSTOMER",
    "firstName": "Amelia",
    "lastName": "Hart",
    "phone": "+44 7700 900111",
    "drivingLicenseNumber": "HART9503126A99XY",
    "isActive": true,
    "lastLoginAt": "2030-03-01T09:30:00.000Z",
    "createdAt": "2030-01-10T08:00:00.000Z"
  }
}
```

### PATCH `/api/profile`

Update own profile

Access: **Any signed-in user**

Email cannot be changed (it is the login identity). Unknown fields, including `email`, are rejected.
`drivingLicenseNumber` can be cleared with `null`.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `firstName` | no | string |  |
| `lastName` | no | string |  |
| `phone` | no | string |  |
| `drivingLicenseNumber` | no | string |  |

Example:

```json
{
  "firstName": "Amelia",
  "lastName": "Hart-Lowe",
  "phone": "+44 7700 900999"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The user (never includes the password hash). |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

Example success response:

```json
{
  "success": true,
  "data": {
    "id": "0bbe7e55-75e7-4355-b1e3-af30b7b9ee11",
    "email": "amelia.hart@prestige.test",
    "role": "CUSTOMER",
    "firstName": "Amelia",
    "lastName": "Hart",
    "phone": "+44 7700 900111",
    "drivingLicenseNumber": "HART9503126A99XY",
    "isActive": true,
    "lastLoginAt": "2030-03-01T09:30:00.000Z",
    "createdAt": "2030-01-10T08:00:00.000Z"
  }
}
```

### PATCH `/api/profile/password`

Change own password

Access: **Any signed-in user**

A wrong current password returns `400 INVALID_CURRENT_PASSWORD`. Rate limited per user.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `currentPassword` | yes | string |  |
| `newPassword` | yes | string |  |
| `confirmPassword` | yes | string |  |

Example:

```json
{
  "currentPassword": "Velvet2026",
  "newPassword": "Brand-new-2026",
  "confirmPassword": "Brand-new-2026"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Done. `data` is null. |
| 400 | The current password is incorrect (`INVALID_CURRENT_PASSWORD`). |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |
| 429 | Too many requests (`RATE_LIMITED`). |

Example success response:

```json
{
  "success": true,
  "message": "Signed out successfully",
  "data": null
}
```

## Catalog

### GET `/api/vehicles`

Browse, search and filter vehicles

Access: **Public (no sign-in)**

Public. Only active vehicles are returned. Unknown parameters and values are rejected.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `q` | query | no | string | Free text over make, model, description and features. Every word must match. |
| `manufacturer` | query | no | string | One or more manufacturers (comma-separated or repeated). |
| `model` | query | no | string | One or more models. |
| `vehicleType` | query | no | string | One or more vehicle types. |
| `fuelType` | query | no | string | One or more fuel types. |
| `transmission` | query | no | string | One or more transmissions. |
| `dealershipId` | query | no | string, uuid |  |
| `city` | query | no | string |  |
| `minYear` | query | no | integer |  |
| `maxYear` | query | no | integer |  |
| `minPrice` | query | no | number |  |
| `maxPrice` | query | no | number |  |
| `availableOnly` | query | no | boolean | Only vehicles with at least one bookable future slot. |
| `sort` | query | no | string (one of newest, priceAsc, priceDesc, manufacturerAsc, powerDesc) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of vehicles. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

Example success response:

```json
{
  "success": true,
  "data": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1,
    "items": [
      {
        "id": "7e1f4a93-2b6c-4d8e-a5f0-9c3b1d7e2a46",
        "manufacturer": "Porsche",
        "model": "911 Carrera T",
        "year": 2025,
        "vehicleType": "COUPE",
        "fuelType": "PETROL",
        "transmission": "MANUAL",
        "priceFrom": 112000,
        "primaryImage": {
          "id": "4d2a8c61-9b3e-4f7a-8c15-6e0b2d9a3f47",
          "url": "/uploads/vehicles/7e1f4a93/0f2c.png",
          "altText": "Porsche 911 Carrera T",
          "isPrimary": true,
          "sortOrder": 1
        },
        "dealerships": [
          {
            "id": "3c8e1a52-7d4b-4f6a-b2c9-5e0a8d1f7b34",
            "name": "Prestige Mayfair",
            "city": "London"
          }
        ],
        "nextAvailableSlotAt": "2030-03-12T10:00:00.000Z"
      }
    ]
  }
}
```

### GET `/api/vehicles/filters`

Filter options currently present in the data

Access: **Public (no sign-in)**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Filter options present in the data. |

### GET `/api/vehicles/{id}`

Vehicle details

Access: **Public (no sign-in)**

An inactive or unknown vehicle returns 404.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Full vehicle details. |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Dealerships

### GET `/api/dealerships`

Active dealerships

Access: **Public (no sign-in)**

Public. At most 100 are returned.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `vehicleId` | query | no | string, uuid | Only dealerships currently offering this vehicle. |
| `city` | query | no | string |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Active dealerships (at most 100). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/dealerships/{id}`

Dealership details

Access: **Public (no sign-in)**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | One active dealership. |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Slots

### GET `/api/vehicles/{vehicleId}/slots`

Available test-drive slots for a vehicle

Access: **Public (no sign-in)**

Only genuinely bookable slots (active, in the future, unbooked, at an active dealership offering the vehicle).
Default range is the next 14 days, at most 60. Slots are grouped by calendar date in `timeZone`.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `vehicleId` | path | yes | string, uuid |  |
| `dealershipId` | query | no | string, uuid |  |
| `from` | query | no | string, date-time | ISO 8601 with offset. Defaults to now. |
| `to` | query | no | string, date-time | ISO 8601 with offset. Defaults to 14 days after `from`. |
| `timeZone` | query | no | string | IANA time zone used to group slots by date. |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Available slots grouped by date. |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

Example success response:

```json
{
  "success": true,
  "data": {
    "vehicleId": "7e1f4a93-2b6c-4d8e-a5f0-9c3b1d7e2a46",
    "timeZone": "Europe/London",
    "range": {
      "from": "2030-03-10T09:00:00.000Z",
      "to": "2030-03-24T09:00:00.000Z"
    },
    "dates": [
      "2030-03-12"
    ],
    "slotsByDate": {
      "2030-03-12": [
        {
          "id": "6b2c9d4e-0f8a-4a52-9a67-1d3b5c7e9f01",
          "startAt": "2030-03-12T10:00:00.000Z",
          "endAt": "2030-03-12T11:00:00.000Z",
          "dealership": {
            "id": "3c8e1a52-7d4b-4f6a-b2c9-5e0a8d1f7b34",
            "name": "Prestige Mayfair",
            "city": "London"
          }
        }
      ]
    }
  }
}
```

## Bookings

### POST `/api/bookings`

Request a test drive (customers only)

Access: **Customer only**

Runs in one transaction with row locks: of many simultaneous requests for one slot exactly one succeeds and
the others receive `SLOT_UNAVAILABLE`. Also enforces no overlapping bookings (`BOOKING_CONFLICT`) and at most
three active bookings (`ACTIVE_BOOKING_LIMIT`).

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `slotId` | yes | string, uuid |  |
| `customerNote` | no | string |  |

Example:

```json
{
  "slotId": "6b2c9d4e-0f8a-4a52-9a67-1d3b5c7e9f01",
  "customerNote": "Interested in the manual gearbox."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | The booking was created in status PENDING. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/bookings/mine`

Own bookings by view (customers only)

Access: **Customer only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `view` | query | no | string (one of pending, upcoming, completed, cancelled, previous, all) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of the customer's bookings. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/bookings/mine/counts`

Number of bookings in every view

Access: **Customer only**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Booking counts for the tab badges. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |

Example success response:

```json
{
  "success": true,
  "data": {
    "pending": 1,
    "upcoming": 2,
    "completed": 3,
    "cancelled": 1,
    "previous": 4,
    "all": 7
  }
}
```

### GET `/api/bookings/slots/{id}`

Slot summary for the booking confirmation page (customers only)

Access: **Customer only**

Returns the vehicle, dealership and times of a slot, whether it can still be booked (`isAvailable`)
and the cancellation window in hours. Slots of deactivated vehicles or dealerships are reported as not found.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Slot summary for booking confirmation. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

Example success response:

```json
{
  "success": true,
  "data": {
    "id": "6b2c9d4e-0f8a-4a52-9a67-1d3b5c7e9f01",
    "startAt": "2030-03-12T10:00:00.000Z",
    "endAt": "2030-03-12T11:00:00.000Z",
    "isAvailable": true,
    "cancellationWindowHours": 24,
    "dealership": {
      "id": "3b2eeacc-b2df-4b3d-a64c-4177a9369608",
      "name": "Prestige Mayfair",
      "address": "14 Berkeley Square, Mayfair",
      "city": "London",
      "phone": "+44 20 7946 1000",
      "openingHours": "Mon-Fri 09:00-18:00"
    },
    "vehicle": {
      "id": "7e1f4a93-2b6c-4d8e-a5f0-9c3b1d7e2a46",
      "manufacturer": "Porsche",
      "model": "911 Carrera T",
      "year": 2025,
      "primaryImage": null
    }
  }
}
```

### GET `/api/bookings/{id}`

Own booking with its status timeline

Access: **Customer only**

Another customer's booking returns the same 404 as an unknown one.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking with its status timeline. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/bookings/{id}/cancel`

Cancel own booking

Access: **Customer only**

Allowed for pending, approved or rescheduled bookings whose slot starts at least `CANCELLATION_WINDOW_HOURS`
(24) from now. Otherwise `CANCELLATION_WINDOW_PASSED` or `INVALID_STATUS_TRANSITION`. The booking's
`canCancel` field is computed by the same rule.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `reason` | no | string |  |

Example:

```json
{
  "reason": "My plans have changed."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking with its status timeline. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Notifications

### GET `/api/notifications`

Own notifications, newest first

Access: **Any signed-in user**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `unreadOnly` | query | no | boolean |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of notifications. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/notifications/unread-count`

Number of unread notifications

Access: **Any signed-in user**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Unread notification count. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |

Example success response:

```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

### PATCH `/api/notifications/read-all`

Mark every own notification as read

Access: **Any signed-in user**

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | How many notifications were marked as read. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |

### PATCH `/api/notifications/{id}/read`

Mark one notification as read (idempotent)

Access: **Any signed-in user**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The notification, marked as read. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Bookings

### GET `/api/admin/bookings`

Filter and search all bookings (staff)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `status` | query | no | string | One or more statuses (comma-separated or repeated). |
| `dealershipId` | query | no | string, uuid |  |
| `vehicleId` | query | no | string, uuid |  |
| `customerId` | query | no | string, uuid |  |
| `q` | query | no | string | Customer name, email or phone, or vehicle make or model. |
| `dateFrom` | query | no | string, date-time | Slot start, inclusive. ISO 8601 with offset. |
| `dateTo` | query | no | string, date-time | Slot start, inclusive. ISO 8601 with offset. |
| `createdFrom` | query | no | string, date-time |  |
| `createdTo` | query | no | string, date-time |  |
| `upcomingOnly` | query | no | boolean |  |
| `sort` | query | no | string (one of slotStartAsc, slotStartDesc, createdDesc) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of bookings. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/bookings/{id}`

Full booking with customer profile and history (staff)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Full booking detail. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/bookings/{id}/approve`

Approve a pending booking

Access: **Staff only**

PENDING to APPROVED. Writes history, notifies the customer, then attempts an email.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `staffNote` | no | string |  |

Example:

```json
{
  "staffNote": "Please bring your driving licence."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking after the action. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The booking's current status does not allow this action (`INVALID_STATUS_TRANSITION`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/bookings/{id}/reject`

Reject a pending booking

Access: **Staff only**

PENDING to REJECTED. The slot becomes bookable again.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `rejectionReason` | yes | string |  |

Example:

```json
{
  "rejectionReason": "The vehicle is reserved for a press event on this date."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking after the action. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The booking's current status does not allow this action (`INVALID_STATUS_TRANSITION`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/bookings/{id}/reschedule`

Move a booking to another slot of the same vehicle

Access: **Staff only**

From PENDING, APPROVED or RESCHEDULED. The new slot must be free and in the future; the customer's other
bookings may not overlap it. History records the old and new slot.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `newSlotId` | yes | string, uuid |  |
| `note` | no | string |  |

Example:

```json
{
  "newSlotId": "9f3d1b7a-4c2e-4e8b-8a55-0c6d2e4f6a18",
  "note": "Vehicle service."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking after the action. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/bookings/{id}/cancel`

Cancel an active booking (any time)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `cancellationReason` | yes | string |  |

Example:

```json
{
  "cancellationReason": "The vehicle has been sold."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking after the action. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The booking's current status does not allow this action (`INVALID_STATUS_TRANSITION`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/bookings/{id}/complete`

Complete a booking whose slot has started

Access: **Staff only**

From APPROVED or RESCHEDULED, only once the slot start is in the past.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json`

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `staffNote` | no | string |  |

Example:

```json
{
  "staffNote": "Customer enjoyed the drive."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The booking after the action. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The booking's current status does not allow this action (`INVALID_STATUS_TRANSITION`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Dashboard

### GET `/api/admin/dashboard/summary`

Dashboard counts and the bookings that need attention

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `timeZone` | query | no | string | IANA time zone used for "today", "this month" and the trend's days. |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Dashboard numbers. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/dashboard/bookings-trend`

Bookings created per day, zero-filled

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `days` | query | no | integer |  |
| `timeZone` | query | no | string | IANA time zone used for "today", "this month" and the trend's days. |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | One point per day, oldest first. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/dashboard/top-vehicles`

Most requested vehicles

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `days` | query | no | integer |  |
| `limit` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Most requested vehicles. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Vehicles

### GET `/api/admin/vehicles`

All vehicles including inactive (staff)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `q` | query | no | string |  |
| `manufacturer` | query | no | string |  |
| `vehicleType` | query | no | VehicleType |  |
| `fuelType` | query | no | FuelType |  |
| `isActive` | query | no | boolean |  |
| `dealershipId` | query | no | string, uuid |  |
| `sortBy` | query | no | string (one of createdAt, manufacturer, model, year, powerHp, priceFrom) |  |
| `sortOrder` | query | no | string (one of asc, desc) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of vehicles. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### POST `/api/admin/vehicles`

Create a vehicle

Access: **Staff only**

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `manufacturer` | yes | string |  |
| `model` | yes | string |  |
| `year` | yes | integer | Up to next year. |
| `vehicleType` | yes | VehicleType |  |
| `fuelType` | yes | FuelType |  |
| `transmission` | yes | Transmission |  |
| `engine` | yes | string |  |
| `powerHp` | yes | integer |  |
| `topSpeedKmh` | no | integer |  |
| `acceleration0to100` | no | number |  |
| `seats` | yes | integer |  |
| `color` | yes | string |  |
| `priceFrom` | no | number |  |
| `description` | yes | string |  |
| `features` | no | array |  |
| `availabilityNote` | no | string |  |

Example:

```json
{
  "manufacturer": "Aston Martin",
  "model": "Vantage",
  "year": 2025,
  "vehicleType": "SPORTS",
  "fuelType": "PETROL",
  "transmission": "AUTOMATIC",
  "engine": "4.0L twin-turbo V8",
  "powerHp": 656,
  "topSpeedKmh": 325,
  "acceleration0to100": 3.5,
  "seats": 2,
  "color": "Lunar White",
  "priceFrom": 165000,
  "description": "A razor-sharp British sports car with a muscular V8.",
  "features": [
    "Launch control",
    "Bowers & Wilkins audio"
  ],
  "availabilityNote": "Available by appointment"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | The vehicle was created (active). |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/vehicles/{id}`

Full vehicle record with images and dealerships

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The vehicle with images and dealerships. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/vehicles/{id}`

Update a vehicle (partial)

Access: **Staff only**

Optional fields can be cleared with `null`.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `manufacturer` | no | string |  |
| `model` | no | string |  |
| `year` | no | integer |  |
| `vehicleType` | no | VehicleType |  |
| `fuelType` | no | FuelType |  |
| `transmission` | no | Transmission |  |
| `engine` | no | string |  |
| `powerHp` | no | integer |  |
| `topSpeedKmh` | no | integer |  |
| `acceleration0to100` | no | number |  |
| `seats` | no | integer |  |
| `color` | no | string |  |
| `priceFrom` | no | number |  |
| `description` | no | string |  |
| `features` | no | array |  |
| `availabilityNote` | no | string |  |

Example:

```json
{
  "color": "Racing Yellow",
  "priceFrom": 150000,
  "features": [
    "Sport Chrono",
    "Rear-axle steering"
  ]
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The vehicle. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/vehicles/{id}/deactivate`

Deactivate a vehicle

Access: **Staff only**

Blocked with `409 HAS_ACTIVE_BOOKINGS` (and the count) while future active bookings exist.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The vehicle. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | Future active bookings (or, for a vehicle's dealerships, active slots) block the change (`HAS_ACTIVE_BOOKINGS` or `CONFLICT`). `details` carries the count. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/vehicles/{id}/activate`

Reactivate a vehicle

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The vehicle. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/vehicles/{id}/dealerships`

Dealerships offering the vehicle

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The dealerships offering the vehicle. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PUT `/api/admin/vehicles/{id}/dealerships`

Replace the dealerships offering the vehicle

Access: **Staff only**

Applied in one transaction or not at all. Withdrawing a dealership (omitting it or marking it unavailable) is
refused while it has future active bookings (`HAS_ACTIVE_BOOKINGS`) or active upcoming slots (`CONFLICT`).
A dealership that already has slot history is kept as unavailable instead of being deleted.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `dealerships` | yes | array |  |

Example:

```json
{
  "dealerships": [
    {
      "dealershipId": "3c8e1a52-7d4b-4f6a-b2c9-5e0a8d1f7b34",
      "isAvailable": true
    },
    {
      "dealershipId": "5a7d2c91-1e3f-4b8a-9c6d-2f4e8a0b1c53",
      "isAvailable": false
    }
  ]
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The dealerships offering the vehicle. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | Future active bookings (or, for a vehicle's dealerships, active slots) block the change (`HAS_ACTIVE_BOOKINGS` or `CONFLICT`). `details` carries the count. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### POST `/api/admin/vehicles/{id}/images`

Upload vehicle images

Access: **Staff only**

Multipart form data. Field `images`, up to 8 files per request, at most 5 MB each, JPEG, PNG or WebP
(checked by declared type and by the file's first bytes). A vehicle can hold 12 images; the first becomes
the primary image. Files are served from `/uploads/vehicles/{vehicleId}/`. Failures use `UPLOAD_INVALID`.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `multipart/form-data` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `images` | yes | array |  |
| `altText` | no | string | Alt text for the uploaded images (defaults to the vehicle name). |

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | All images of the vehicle in display order. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | A file is the wrong type, too large, or over the limits (`UPLOAD_INVALID`). |

### PATCH `/api/admin/vehicles/{id}/images/{imageId}`

Update an image's alt text, order or primary flag

Access: **Staff only**

Exactly one image per vehicle is primary. The primary flag cannot be unset directly; set another image as primary instead.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |
| `imageId` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `altText` | no | string |  |
| `sortOrder` | no | integer |  |
| `isPrimary` | no | boolean |  |

Example:

```json
{
  "altText": "Rear three-quarter view",
  "isPrimary": true
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | All images of the vehicle in display order. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### DELETE `/api/admin/vehicles/{id}/images/{imageId}`

Delete an image (row and file)

Access: **Staff only**

Deleting the primary image promotes the next one.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |
| `imageId` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | All images of the vehicle in display order. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Dealerships

### GET `/api/admin/dealerships`

All dealerships including inactive (staff)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `q` | query | no | string |  |
| `isActive` | query | no | boolean |  |
| `sortBy` | query | no | string (one of name, city, createdAt) |  |
| `sortOrder` | query | no | string (one of asc, desc) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of dealerships. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### POST `/api/admin/dealerships`

Create a dealership

Access: **Staff only**

Name must be unique within the city (case-insensitive); otherwise `409 CONFLICT`.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | yes | string |  |
| `address` | yes | string |  |
| `city` | yes | string |  |
| `phone` | yes | string |  |
| `email` | yes | string, email |  |
| `openingHours` | yes | string |  |
| `description` | no | string |  |

Example:

```json
{
  "name": "Prestige Edinburgh",
  "address": "9 Charlotte Square",
  "city": "Edinburgh",
  "phone": "+44 131 496 3000",
  "email": "edinburgh@prestige.test",
  "openingHours": "Mon-Fri 09:00-17:30, Sat 09:00-13:00",
  "description": "A refined Georgian-townhouse showroom."
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | The dealership was created (active). |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/dealerships/{id}`

Dealership with its upcoming active booking count

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The dealership with its upcoming active booking count. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/dealerships/{id}`

Update a dealership (partial)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `name` | no | string |  |
| `address` | no | string |  |
| `city` | no | string |  |
| `phone` | no | string |  |
| `email` | no | string, email |  |
| `openingHours` | no | string |  |
| `description` | no | string |  |

Example:

```json
{
  "phone": "+44 20 7946 1999",
  "openingHours": "Mon-Sat 10:00-19:00"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The dealership. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/dealerships/{id}/deactivate`

Deactivate a dealership

Access: **Staff only**

Blocked with `409 HAS_ACTIVE_BOOKINGS` (and the count) while future active bookings exist at it.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The dealership. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | Future active bookings (or, for a vehicle's dealerships, active slots) block the change (`HAS_ACTIVE_BOOKINGS` or `CONFLICT`). `details` carries the count. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/dealerships/{id}/activate`

Reactivate a dealership

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The dealership. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Slots

### GET `/api/admin/slots`

List slots with their active booking (staff)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `dealershipId` | query | no | string, uuid |  |
| `vehicleId` | query | no | string, uuid |  |
| `from` | query | no | string, date-time |  |
| `to` | query | no | string, date-time |  |
| `isActive` | query | no | boolean |  |
| `hasBooking` | query | no | boolean | Whether the slot has an active booking. |
| `sortOrder` | query | no | string (one of asc, desc) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of slots. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### POST `/api/admin/slots`

Create one slot

Access: **Staff only**

Must start in the future and last 15 to 240 minutes; the vehicle must be offered at the dealership.
A clash with another active slot of the same vehicle returns `409 SLOT_OVERLAP` naming the clashing slot.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `dealershipId` | yes | string, uuid |  |
| `vehicleId` | yes | string, uuid |  |
| `startAt` | yes | string, date-time | ISO 8601 with offset. |
| `endAt` | yes | string, date-time |  |

Example:

```json
{
  "dealershipId": "3c8e1a52-7d4b-4f6a-b2c9-5e0a8d1f7b34",
  "vehicleId": "7e1f4a93-2b6c-4d8e-a5f0-9c3b1d7e2a46",
  "startAt": "2030-03-12T10:00:00+00:00",
  "endAt": "2030-03-12T11:00:00+00:00"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | The slot was created. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 409 | The slot overlaps another active slot of the same vehicle (`SLOT_OVERLAP`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### POST `/api/admin/slots/bulk`

Generate many slots (with dry run)

Access: **Staff only**

Calendar dates, 24-hour times and weekdays are interpreted in `timeZone` (daylight saving handled).
`?dryRun=true` previews without writing. Candidates that overlap existing slots or lie in the past are
skipped and reported; the rest are created in one transaction.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `dryRun` | query | no | boolean |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `dealershipId` | yes | string, uuid |  |
| `vehicleId` | yes | string, uuid |  |
| `dateFrom` | yes | string, date | YYYY-MM-DD. |
| `dateTo` | yes | string, date |  |
| `daysOfWeek` | yes | array |  |
| `dailyStartTime` | yes | string |  |
| `dailyEndTime` | yes | string |  |
| `durationMinutes` | yes | integer |  |
| `breakMinutes` | no | integer |  |
| `timeZone` | no | string |  |

Example:

```json
{
  "dealershipId": "3c8e1a52-7d4b-4f6a-b2c9-5e0a8d1f7b34",
  "vehicleId": "7e1f4a93-2b6c-4d8e-a5f0-9c3b1d7e2a46",
  "dateFrom": "2030-03-11",
  "dateTo": "2030-03-17",
  "daysOfWeek": [
    "MON",
    "WED",
    "FRI"
  ],
  "dailyStartTime": "09:00",
  "dailyEndTime": "12:00",
  "durationMinutes": 60,
  "breakMinutes": 30,
  "timeZone": "Europe/London"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | What was created (`201`) or would be created (`200`, dry run), and what was skipped. |
| 201 | What was created (`201`) or would be created (`200`, dry run), and what was skipped. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/slots/{id}`

One slot

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The slot. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/slots/{id}`

Change a slot's times

Access: **Staff only**

Blocked with `409 HAS_ACTIVE_BOOKINGS` when the slot has an active booking (reschedule the booking instead)
and with `409 SLOT_IN_PAST` once the slot has started.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `startAt` | no | string, date-time |  |
| `endAt` | no | string, date-time |  |

Example:

```json
{
  "startAt": "2030-03-12T14:00:00+00:00",
  "endAt": "2030-03-12T15:00:00+00:00"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The slot. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The slot is booked (`HAS_ACTIVE_BOOKINGS`), has started (`SLOT_IN_PAST`) or the new time overlaps another slot (`SLOT_OVERLAP`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/slots/{id}/deactivate`

Deactivate a slot

Access: **Staff only**

Blocked with `409 HAS_ACTIVE_BOOKINGS` while the slot has an active booking.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The slot. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | Future active bookings (or, for a vehicle's dealerships, active slots) block the change (`HAS_ACTIVE_BOOKINGS` or `CONFLICT`). `details` carries the count. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/slots/{id}/activate`

Reactivate a slot

Access: **Staff only**

Re-checks overlaps; a clash returns `409 SLOT_OVERLAP`.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The slot. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 409 | The slot overlaps another active slot of the same vehicle (`SLOT_OVERLAP`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Customers

### GET `/api/admin/customers`

Search customers (staff)

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `q` | query | no | string | Name, email or phone. Every word must match. |
| `isActive` | query | no | boolean |  |
| `sortBy` | query | no | string (one of createdAt, lastName, email, bookingCount) |  |
| `sortOrder` | query | no | string (one of asc, desc) |  |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of customers with booking statistics. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### GET `/api/admin/customers/{id}`

Customer profile with a bookings summary

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | Customer profile and bookings summary. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### PATCH `/api/admin/customers/{id}/status`

Activate or deactivate a customer

Access: **Staff only**

Deactivating cancels the customer's future active bookings (reason "Account deactivated", cancelled by
staff), each with history, an in-app notification and an email attempt, all in one transaction.
Customers are never deleted.

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `id` | path | yes | string, uuid |  |

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `isActive` | yes | boolean |  |

Example:

```json
{
  "isActive": false
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | The customer and how many future bookings were cancelled. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 404 | The resource does not exist, or belongs to someone else (`NOT_FOUND`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

## Admin - Staff

### GET `/api/staff`

List staff accounts

Access: **Staff only**

**Parameters**

| Name | In | Required | Type | Description |
| --- | --- | --- | --- | --- |
| `page` | query | no | integer |  |
| `pageSize` | query | no | integer |  |

**Responses**

| Status | Meaning |
| --- | --- |
| 200 | A page of staff accounts. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |

### POST `/api/staff`

Create another staff account

Access: **Staff only**

Staff accounts cannot self-register. The password is a temporary one.

**Request body**

Content type: `application/json` (required)

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `firstName` | yes | string |  |
| `lastName` | yes | string |  |
| `email` | yes | string, email |  |
| `password` | yes | string |  |
| `phone` | yes | string |  |

Example:

```json
{
  "firstName": "Marcus",
  "lastName": "Ashworth",
  "email": "marcus.ashworth@prestige.test",
  "password": "Temporary2026",
  "phone": "+44 20 7946 0102"
}
```

**Responses**

| Status | Meaning |
| --- | --- |
| 201 | The account was created. |
| 401 | Not signed in, or the session is invalid or expired (`UNAUTHENTICATED`). |
| 403 | The signed-in role may not use this endpoint (`FORBIDDEN`). |
| 409 | The request conflicts with the current state. The code says how: `EMAIL_TAKEN`, `CONFLICT`, `SLOT_UNAVAILABLE`, `BOOKING_CONFLICT`, `ACTIVE_BOOKING_LIMIT`, `CANCELLATION_WINDOW_PASSED`, `INVALID_STATUS_TRANSITION`, `SLOT_OVERLAP`, `HAS_ACTIVE_BOOKINGS` or `SLOT_IN_PAST`. |
| 422 | The request failed validation (`VALIDATION_ERROR`), with one detail per problem field. |
