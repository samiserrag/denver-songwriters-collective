-- Seed spotlight host and studio profiles
-- Run this via Supabase SQL Editor

-- Insert a spotlight Open Mic Host
INSERT INTO public.profiles (id, full_name, bio, role, is_featured, featured_rank, onboarding_complete)
VALUES (
  gen_random_uuid(),
  'Marcus "Mic Check" Williams',
  'Hosting open mics in Denver for over 8 years. Passionate about creating welcoming spaces for new and experienced songwriters alike. Catch me at The Walnut Room every Thursday!',
  'host',
  true,
  1,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Insert another spotlight host
INSERT INTO public.profiles (id, full_name, bio, role, is_featured, featured_rank, onboarding_complete)
VALUES (
  gen_random_uuid(),
  'Sarah Chen',
  'Singer-songwriter turned open mic curator. I believe every voice deserves a stage. Running the Sunday Sessions at Ophelia''s since 2019.',
  'host',
  true,
  2,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Insert a spotlight Studio
INSERT INTO public.profiles (id, full_name, bio, role, is_featured, featured_rank, onboarding_complete)
VALUES (
  gen_random_uuid(),
  'Mile High Sound Studio',
  'Professional recording studio in the heart of Denver. Specializing in acoustic, folk, and singer-songwriter productions. Affordable rates for independent artists.',
  'studio',
  true,
  1,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Insert another spotlight studio
INSERT INTO public.profiles (id, full_name, bio, role, is_featured, featured_rank, onboarding_complete)
VALUES (
  gen_random_uuid(),
  'Red Rocks Recording Co.',
  'Boutique studio with vintage gear and mountain views. We help songwriters capture their authentic sound. Demo packages starting at $150.',
  'studio',
  true,
  2,
  true
)
ON CONFLICT (id) DO NOTHING;
