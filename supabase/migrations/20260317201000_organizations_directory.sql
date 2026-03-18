-- Organizations directory for "Friends of the Collective"
-- Phase 1: Admin-managed CRUD with photo fields and visibility control.

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  city TEXT,
  organization_type TEXT,
  short_blurb TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('private', 'unlisted', 'public')),
  logo_image_url TEXT,
  cover_image_url TEXT,
  gallery_image_urls TEXT[] NOT NULL DEFAULT '{}',
  fun_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_visibility_active
  ON public.organizations (visibility, is_active, featured, sort_order);

CREATE INDEX IF NOT EXISTS idx_organizations_name
  ON public.organizations (name);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Public can only read active/public rows.
DROP POLICY IF EXISTS organizations_select_public ON public.organizations;
CREATE POLICY organizations_select_public
ON public.organizations
FOR SELECT
USING (is_active = true AND visibility = 'public');

-- Admin read/write.
DROP POLICY IF EXISTS organizations_select_admin ON public.organizations;
CREATE POLICY organizations_select_admin
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS organizations_insert_admin ON public.organizations;
CREATE POLICY organizations_insert_admin
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
CREATE POLICY organizations_update_admin
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS organizations_delete_admin ON public.organizations;
CREATE POLICY organizations_delete_admin
ON public.organizations
FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organizations_updated_at();

-- Seed initial organizations as unlisted/private-launch content.
INSERT INTO public.organizations (
  slug, name, website_url, city, organization_type, short_blurb, why_it_matters, tags, featured, is_active, visibility, sort_order
)
VALUES
(
  'rock-for-the-people',
  'Rock For The People',
  'https://www.rockforthepeople.org',
  'Lafayette, CO',
  'Nonprofit',
  'Rock For The People is a Lafayette, Colorado nonprofit that creates performance, recording, rehearsal, marketing, and career development opportunities for musicians from historically underrepresented groups.',
  'Songwriters gain access to free recording and rehearsal scholarships, paid performance slots, marketing support, and a recurring monthly Songwriter Meetup - directly reducing barriers to craft and visibility.',
  ARRAY['Open Mic','Songwriter Meetup','Scholarships','Equity in Music','Community Events']::TEXT[],
  false,
  true,
  'unlisted',
  10
),
(
  'stone-cottage-studios',
  'Stone Cottage Studios',
  'https://www.stonecottagestudios.com',
  'Boulder, CO',
  'Recording Studio & Media',
  'Stone Cottage Studios is a Boulder-based music production and discovery space offering live and livestream concerts, interview-based Artist Sessions, and pro audio and video recording for local and visiting musicians.',
  'Songwriters can share their stories and music through distributed Artist Sessions, gaining fan visibility and media presence across multiple platforms.',
  ARRAY['Recording','Live Sessions','Artist Promotion','Livestream','Boulder']::TEXT[],
  false,
  true,
  'unlisted',
  20
),
(
  'to-the-fives-taproom',
  'To The Fives Taproom & Lounge',
  'https://tothefivestaproom.square.site',
  NULL,
  'Venue',
  'To The Fives Taproom & Lounge is an intimate listening room venue that hosts live local music nearly every weekend alongside weekly genre-specific open stage jams including Acoustic Song, Blues, Funk, and Reggae.',
  'The venue''s recurring open stage jams and ticketed local shows give songwriters consistent, low-barrier opportunities to perform original work in front of a live audience.',
  ARRAY['Open Mic','Live Music Venue','Open Stage Jams','Local Artists','Listening Room']::TEXT[],
  false,
  true,
  'unlisted',
  30
),
(
  'colorado-bluegrass-music-society',
  'Colorado Bluegrass Music Society (CBMS)',
  'https://www.coloradobluegrass.org',
  'Denver, CO',
  'Music Society',
  'The Colorado Bluegrass Music Society maintains a statewide directory of bluegrass jams held across Colorado, from Denver and Boulder to Durango and Breckenridge, spanning all skill levels.',
  'Acoustic songwriter-instrumentalists can find ongoing jam communities throughout the state to develop their craft, connect with other players, and workshop new material.',
  ARRAY['Bluegrass','Jams','Acoustic','Statewide','Community Music']::TEXT[],
  false,
  true,
  'unlisted',
  40
),
(
  'pink-sofa-hour',
  'Pink Sofa Hour / Pink Sofa Production Syndicate',
  'https://www.pinksofahour.com',
  NULL,
  'Nonprofit & Media Production',
  'Pink Sofa Hour began as a live-streamed YouTube music show and has expanded into the Pink Sofa Production Syndicate (PSPS), a nonprofit offering free booking support and promotional resources to local musicians, alongside Couched Media, its in-house multimedia production arm.',
  'Songwriters receive free booking assistance, promotional resources, audio recording access, and educational content - with all commercial revenue from the production side reinvested into artist support.',
  ARRAY['Booking','Promotion','Nonprofit','Recording','Livestream']::TEXT[],
  false,
  true,
  'unlisted',
  50
),
(
  'front-range-songwriters',
  'Front Range Songwriters',
  'https://www.frontrangesongwriters.com',
  'Colorado Springs, CO',
  'Songwriting Collective',
  'Front Range Songwriters is a Colorado Springs-based organization for songwriters and lyricists that meets monthly to explore the creation of music.',
  'A dedicated local gathering place for songwriters and lyricists to meet, workshop ideas, and build community - one of the few organizations in the region focused specifically on the craft of songwriting.',
  ARRAY['Songwriting','Lyricists','Monthly Meetup','Colorado Springs','Craft Development']::TEXT[],
  false,
  true,
  'unlisted',
  60
),
(
  'concretecouch',
  'Concrete Couch',
  'https://www.concretecouch.org',
  'Colorado Springs, CO',
  'Nonprofit',
  'Concrete Couch is a Colorado Springs-based 501(c)3 nonprofit serving the Pikes Peak region since 2003 that builds community through creative projects including public art, performance, classes, and shared skill-building.',
  'Songwriters and performing artists can connect with a broad community creative infrastructure that includes performance opportunities, collaborative events, and a space where music sits alongside other community arts.',
  ARRAY['Community Arts','Performance','Colorado Springs','Nonprofit','Creative Community']::TEXT[],
  false,
  true,
  'unlisted',
  70
),
(
  'black-rose-acoustic-society',
  'The Black Rose Acoustic Society',
  'https://www.blackroseacoustic.org',
  'Colorado Springs, CO',
  'Music Society',
  'The Black Rose Acoustic Society has been bringing handmade acoustic music to the Pikes Peak region since 1994, offering intimate concerts, jams, open mics, showcases, classes, scholarships, and a dedicated songwriting circle.',
  'Songwriters in the Colorado Springs area have a rare, long-established home base with recurring songwriting classes, open mics, showcases, and performance opportunities all under one community roof.',
  ARRAY['Acoustic','Songwriting Circle','Open Mic','Showcase','Colorado Springs']::TEXT[],
  false,
  true,
  'unlisted',
  80
),
(
  'westernwish-productions',
  'WesternWish Productions',
  'https://www.westernwish.com',
  'Denver, CO',
  'Event Production',
  'WesternWish Productions is a Denver-based event production organization that curates intimate showcase series and listening experiences exclusively for independent, original-music artists on the Front Range.',
  'By focusing exclusively on original work and crafting intentional listening environments, WesternWish gives songwriters a dedicated stage and audience that centers the music itself.',
  ARRAY['Original Music','Showcases','Listening Room','Independent Artists','Denver']::TEXT[],
  false,
  true,
  'unlisted',
  90
),
(
  'denverse-magazine',
  'Denverse Magazine',
  'https://www.denversemagazine.com',
  'Denver, CO',
  'Independent Media',
  'Denverse is a quarterly, all-human, AI-free independent print magazine dedicated to Denver arts and culture, featuring local writers, musicians, comedians, and artists, with subscriber events including concerts, readings, and creative workshops.',
  'Songwriters and musicians can gain coverage in a respected local print publication and access subscriber events - concerts, creative workshops, and issue launch parties - that foster direct community connection.',
  ARRAY['Local Media','Arts Coverage','Denver','Print Magazine','Community Events']::TEXT[],
  false,
  true,
  'unlisted',
  100
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

COMMENT ON TABLE public.organizations IS
  'Directory of partner/friend organizations that support songwriters. Admin-managed.';

