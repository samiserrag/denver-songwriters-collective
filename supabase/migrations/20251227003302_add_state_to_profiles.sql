-- Add state field to profiles for location-based member discovery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
