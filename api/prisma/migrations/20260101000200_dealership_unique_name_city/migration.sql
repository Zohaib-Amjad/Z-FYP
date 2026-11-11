CREATE UNIQUE INDEX "dealerships_name_city_unique"
  ON "dealerships" (lower("name"), lower("city"));
