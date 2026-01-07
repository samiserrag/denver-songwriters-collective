-- =====================================================
-- Phase 4.48c: Add FK from event_rsvps to profiles
-- Enables PostgREST to join RSVPs with profile data
-- =====================================================

-- Add a second FK for user_id pointing to profiles
-- This allows PostgREST to recognize the join relationship
-- NOTE: profiles.id === auth.users.id by design (same UUID)

ALTER TABLE public.event_rsvps
ADD CONSTRAINT event_rsvps_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- This does NOT remove the existing auth.users FK
-- Both FKs coexist: one for auth cascade, one for PostgREST joining
