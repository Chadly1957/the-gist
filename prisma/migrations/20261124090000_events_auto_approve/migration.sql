-- Events auto-approve (2026-11-24, Chad's call): public event submissions
-- no longer land as "pending" for admin review. The submit route now
-- creates events approved, and this changes the column default so no
-- creation path can ever produce a pending event by omission. Additive
-- only: changes a default, touches no existing rows — the 5 stale pending
-- events already in the DB stay pending for Chad to review/delete.
ALTER TABLE "Event" ALTER COLUMN "status" SET DEFAULT 'approved';
