-- Events get map pins: nullable coordinates, geocoded at approval time
-- (Nominatim, OpenStreetMap) and cached permanently. NULL means the event
-- stays list-only; a pin is never guessed from a vague location.
ALTER TABLE "Event" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "longitude" DOUBLE PRECISION;
