-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop constraint if it already exists (to ensure idempotency)
ALTER TABLE "employee_mappings" DROP CONSTRAINT IF EXISTS no_overlapping_mapping;

-- Add GiST exclusion constraint to prevent overlapping employee mappings for the same device
ALTER TABLE "employee_mappings"
ADD CONSTRAINT no_overlapping_mapping
EXCLUDE USING gist (
  device_id WITH =,
  tsrange(valid_from, COALESCE(valid_to, 'infinity'), '[)') WITH &&
);