-- Add Musician Therapy Studio to Friends of the Collective directory

INSERT INTO public.organizations (
  slug,
  name,
  website_url,
  city,
  organization_type,
  short_blurb,
  why_it_matters,
  tags,
  featured,
  is_active,
  visibility,
  sort_order
)
VALUES (
  'musician-therapy-studio',
  'Musician Therapy Studio',
  'https://musiciantherapy.com',
  'Colorado (Statewide Telehealth)',
  'Licensed Mental Health Practice',
  'Musician Therapy Studio is a Colorado-based therapy practice specializing in mental health support for musicians and music-industry professionals, with a primary focus on performers and songwriters.',
  'Songwriters and performers can access a Colorado-licensed therapist who understands music-specific stressors and offers statewide telehealth support for adults.',
  ARRAY['Mental Health','Therapy','Telehealth','Performers','Songwriters']::TEXT[],
  false,
  true,
  'public',
  120
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  city = EXCLUDED.city,
  organization_type = EXCLUDED.organization_type,
  short_blurb = EXCLUDED.short_blurb,
  why_it_matters = EXCLUDED.why_it_matters,
  tags = EXCLUDED.tags,
  featured = EXCLUDED.featured,
  is_active = EXCLUDED.is_active,
  visibility = EXCLUDED.visibility,
  sort_order = EXCLUDED.sort_order;
