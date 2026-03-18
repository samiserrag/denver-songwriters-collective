-- Add Swallow Hill Music to Friends of the Collective seed data

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
  'swallow-hill-music',
  'Swallow Hill Music',
  'https://swallowhillmusic.org/about-us/',
  'Denver, CO',
  'Nonprofit Music School & Venue',
  'Swallow Hill Music is a Denver nonprofit music school and concert community focused on folk, roots, and acoustic music education and performance.',
  'Songwriters can access classes, workshops, and listening-room style performances that support craft growth, community connection, and live opportunities.',
  ARRAY['Songwriting Classes','Folk','Acoustic','Concerts','Music Education']::TEXT[],
  false,
  true,
  'unlisted',
  110
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
