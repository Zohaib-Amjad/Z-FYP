CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "time_slots"
  ADD CONSTRAINT "time_slots_end_after_start" CHECK ("end_at" > "start_at");

ALTER TABLE "time_slots"
  ADD CONSTRAINT "time_slots_no_vehicle_overlap"
  EXCLUDE USING gist (
    "vehicle_id" WITH =,
    tstzrange("start_at", "end_at") WITH &&
  ) WHERE ("is_active");

CREATE UNIQUE INDEX "one_active_booking_per_slot"
  ON "bookings" ("slot_id")
  WHERE "status" IN ('PENDING', 'APPROVED', 'RESCHEDULED');
