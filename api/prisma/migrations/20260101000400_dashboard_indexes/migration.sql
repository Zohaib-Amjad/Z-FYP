-- CreateIndex
CREATE INDEX "time_slots_start_at_idx" ON "time_slots"("start_at");

-- CreateIndex
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");

-- CreateIndex
CREATE INDEX "booking_status_history_to_status_created_at_idx" ON "booking_status_history"("to_status", "created_at");
