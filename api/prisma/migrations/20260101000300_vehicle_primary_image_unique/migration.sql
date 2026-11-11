CREATE UNIQUE INDEX "one_primary_image_per_vehicle"
  ON "vehicle_images" ("vehicle_id")
  WHERE "is_primary";
