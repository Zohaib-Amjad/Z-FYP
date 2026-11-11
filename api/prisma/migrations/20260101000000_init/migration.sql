-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'STAFF');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('SEDAN', 'SUV', 'COUPE', 'CONVERTIBLE', 'HATCHBACK', 'SPORTS', 'GRAND_TOURER', 'MPV');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'MANUAL', 'DUAL_CLUTCH');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "driving_license_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealerships" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "opening_hours" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dealerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "fuel_type" "FuelType" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "engine" TEXT NOT NULL,
    "power_hp" INTEGER NOT NULL,
    "top_speed_kmh" INTEGER,
    "acceleration_0_to_100" DECIMAL(4,2),
    "seats" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "price_from" DECIMAL(12,2),
    "description" TEXT NOT NULL,
    "features" TEXT[],
    "availability_note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_images" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vehicle_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealership_vehicles" (
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dealership_vehicles_pkey" PRIMARY KEY ("dealership_id","vehicle_id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "customer_note" TEXT,
    "staff_note" TEXT,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by" "Role",
    "approved_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "old_slot_id" UUID,
    "new_slot_id" UUID,
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "vehicles_manufacturer_model_idx" ON "vehicles"("manufacturer", "model");

-- CreateIndex
CREATE INDEX "vehicles_vehicle_type_idx" ON "vehicles"("vehicle_type");

-- CreateIndex
CREATE INDEX "vehicles_fuel_type_idx" ON "vehicles"("fuel_type");

-- CreateIndex
CREATE INDEX "vehicles_is_active_idx" ON "vehicles"("is_active");

-- CreateIndex
CREATE INDEX "vehicle_images_vehicle_id_idx" ON "vehicle_images"("vehicle_id");

-- CreateIndex
CREATE INDEX "time_slots_vehicle_id_start_at_idx" ON "time_slots"("vehicle_id", "start_at");

-- CreateIndex
CREATE INDEX "time_slots_dealership_id_start_at_idx" ON "time_slots"("dealership_id", "start_at");

-- CreateIndex
CREATE INDEX "bookings_customer_id_status_idx" ON "bookings"("customer_id", "status");

-- CreateIndex
CREATE INDEX "bookings_status_created_at_idx" ON "bookings"("status", "created_at");

-- CreateIndex
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_idx" ON "booking_status_history"("booking_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- AddForeignKey
ALTER TABLE "vehicle_images" ADD CONSTRAINT "vehicle_images_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealership_vehicles" ADD CONSTRAINT "dealership_vehicles_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "dealerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealership_vehicles" ADD CONSTRAINT "dealership_vehicles_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "dealerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_dealership_id_vehicle_id_fkey" FOREIGN KEY ("dealership_id", "vehicle_id") REFERENCES "dealership_vehicles"("dealership_id", "vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

