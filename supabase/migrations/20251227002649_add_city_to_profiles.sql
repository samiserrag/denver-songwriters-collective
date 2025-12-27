-- Add city field to profiles for location-based member discovery
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
