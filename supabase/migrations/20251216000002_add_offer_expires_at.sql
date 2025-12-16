-- Phase 3.5: Add 2-hour waitlist claim window support
-- This migration adds offer_expires_at to track when a waitlist promotion offer expires

-- Add offer_expires_at column to event_rsvps
ALTER TABLE event_rsvps
ADD COLUMN offer_expires_at TIMESTAMPTZ NULL;

-- Add comment explaining the field
COMMENT ON COLUMN event_rsvps.offer_expires_at IS
  'When a waitlist user is offered a spot, this is set to now() + 2 hours. User must confirm before this time or offer expires and moves to next person.';

-- Create partial index for efficient expired offer queries
-- Only indexes rows where offer_expires_at is not null (i.e., pending offers)
CREATE INDEX idx_event_rsvps_offer_expires
ON event_rsvps(offer_expires_at)
WHERE offer_expires_at IS NOT NULL;

-- Also add index on event_id + status for the common "find expired offers for this event" query
CREATE INDEX idx_event_rsvps_event_status_expires
ON event_rsvps(event_id, status, offer_expires_at)
WHERE offer_expires_at IS NOT NULL;
