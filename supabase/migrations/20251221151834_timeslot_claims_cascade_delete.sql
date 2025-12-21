-- Fix timeslot_claims FK to cascade delete when member is deleted
--
-- Problem: The member_id FK was ON DELETE SET NULL, which violates the
-- member_or_guest CHECK constraint when deleting a member-claimed slot
-- (member_id becomes NULL, but guest_name is also NULL).
--
-- Solution: Change to ON DELETE CASCADE so claims are deleted with the member.
-- Also update updated_by FK to SET NULL (it's metadata, not identity).

-- Step 1: Drop existing FKs
ALTER TABLE timeslot_claims
  DROP CONSTRAINT IF EXISTS timeslot_claims_member_id_fkey;

ALTER TABLE timeslot_claims
  DROP CONSTRAINT IF EXISTS timeslot_claims_updated_by_fkey;

-- Step 2: Recreate member_id FK with ON DELETE CASCADE
ALTER TABLE timeslot_claims
  ADD CONSTRAINT timeslot_claims_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Step 3: Recreate updated_by FK with ON DELETE SET NULL (metadata only)
ALTER TABLE timeslot_claims
  ADD CONSTRAINT timeslot_claims_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id)
  ON DELETE SET NULL;
