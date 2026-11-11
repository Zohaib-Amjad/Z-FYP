# Entity-Relationship Diagram (ERD)

This document visualizes the relational database architecture for the **Luxury Car Test-Drive Booking and Management System** implemented in PostgreSQL via Prisma ORM.

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string password_hash
        Role role
        string first_name
        string last_name
        string phone
        string driving_license_number
        boolean is_active
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    dealerships {
        uuid id PK
        string name
        string address
        string city
        string phone
        string email
        string opening_hours
        string description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    vehicles {
        uuid id PK
        string manufacturer
        string model
        int year
        VehicleType vehicle_type
        FuelType fuel_type
        Transmission transmission
        string engine
        int power_hp
        int top_speed_kmh
        decimal acceleration_0_to_100
        int seats
        string color
        decimal price_from
        string description
        string[] features
        string availability_note
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    vehicle_images {
        uuid id PK
        uuid vehicle_id FK
        string url
        string alt_text
        boolean is_primary
        int sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    dealership_vehicles {
        uuid dealership_id PK,FK
        uuid vehicle_id PK,FK
        boolean is_available
        timestamptz created_at
        timestamptz updated_at
    }

    time_slots {
        uuid id PK
        uuid dealership_id FK
        uuid vehicle_id FK
        timestamptz start_at
        timestamptz end_at
        boolean is_active
        uuid created_by_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    bookings {
        uuid id PK
        uuid customer_id FK
        uuid slot_id FK
        BookingStatus status
        string customer_note
        string staff_note
        string rejection_reason
        string cancellation_reason
        Role cancelled_by
        timestamptz approved_at
        timestamptz completed_at
        timestamptz created_at
        timestamptz updated_at
    }

    booking_status_history {
        uuid id PK
        uuid booking_id FK
        BookingStatus from_status
        BookingStatus to_status
        string action
        string note
        uuid old_slot_id
        uuid new_slot_id
        uuid changed_by_id FK
        timestamptz created_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        uuid booking_id FK
        NotificationType type
        string title
        string message
        boolean is_read
        timestamptz created_at
    }

    dealerships ||--o{ dealership_vehicles : "stocks"
    vehicles ||--o{ dealership_vehicles : "offered at"
    vehicles ||--o{ vehicle_images : "showcases"

    dealership_vehicles ||--o{ time_slots : "schedules"
    dealerships ||--o{ time_slots : "hosts"
    vehicles ||--o{ time_slots : "assigned to"
    users ||--o{ time_slots : "created by (staff)"

    time_slots ||--o{ bookings : "reserved in"
    users ||--o{ bookings : "booked by (customer)"

    bookings ||--o{ booking_status_history : "audited by"
    users ||--o{ booking_status_history : "status changed by"

    users ||--o{ notifications : "receives"
    bookings ||--o{ notifications : "relates to"
```

## Database Constraints & Integrity Rules

1. **Slot Time Order Check**:
   `CONSTRAINT time_slots_end_after_start CHECK (end_at > start_at)`
2. **Vehicle Non-Overlapping Slot Integrity**:
   `CONSTRAINT time_slots_no_overlap EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (is_active)`
   *Powered by PostgreSQL `btree_gist` extension.*
3. **One Active Booking Per Slot**:
   `CREATE UNIQUE INDEX one_active_booking_per_slot ON bookings (slot_id) WHERE status IN ('PENDING', 'APPROVED', 'RESCHEDULED');`
4. **Referential Integrity**:
   - `dealership_vehicles` and `vehicle_images` cascade on delete of `dealerships` / `vehicles`.
   - `booking_status_history` cascades on delete of `bookings`.
   - `notifications` cascades on delete of `users`, and sets `booking_id` null if booking is removed.

