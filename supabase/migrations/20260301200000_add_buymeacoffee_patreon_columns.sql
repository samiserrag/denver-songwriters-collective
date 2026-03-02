-- Add Buy Me a Coffee and Patreon URL columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buymeacoffee_url text,
  ADD COLUMN IF NOT EXISTS patreon_url text;
