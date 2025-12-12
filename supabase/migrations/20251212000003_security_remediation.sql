-- ============================================================================
-- SECURITY REMEDIATION MIGRATION (IDEMPOTENT VERSION)
-- Fixes identified during Supabase Configuration Audit
-- ============================================================================
-- Safe to run multiple times - uses DROP IF EXISTS before CREATE
-- ============================================================================

-- ============================================================================
-- FIX 1: open_mic_claims table - Enable RLS and add policies
-- ============================================================================

ALTER TABLE public.open_mic_claims ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to make idempotent
DROP POLICY IF EXISTS "open_mic_claims_select_own" ON public.open_mic_claims;
DROP POLICY IF EXISTS "open_mic_claims_insert_own" ON public.open_mic_claims;
DROP POLICY IF EXISTS "open_mic_claims_update_own" ON public.open_mic_claims;
DROP POLICY IF EXISTS "open_mic_claims_delete_own" ON public.open_mic_claims;
DROP POLICY IF EXISTS "open_mic_claims_admin_all" ON public.open_mic_claims;
DROP POLICY IF EXISTS "open_mic_claims_host_view" ON public.open_mic_claims;

-- Users can view their own claims
CREATE POLICY "open_mic_claims_select_own"
ON public.open_mic_claims
FOR SELECT
USING (profile_id = auth.uid());

-- Users can create claims for themselves
CREATE POLICY "open_mic_claims_insert_own"
ON public.open_mic_claims
FOR INSERT
WITH CHECK (profile_id = auth.uid());

-- Users can update their own pending claims
CREATE POLICY "open_mic_claims_update_own"
ON public.open_mic_claims
FOR UPDATE
USING (profile_id = auth.uid() AND status = 'pending')
WITH CHECK (profile_id = auth.uid());

-- Users can delete their own pending claims
CREATE POLICY "open_mic_claims_delete_own"
ON public.open_mic_claims
FOR DELETE
USING (profile_id = auth.uid() AND status = 'pending');

-- Admins can manage all claims
CREATE POLICY "open_mic_claims_admin_all"
ON public.open_mic_claims
FOR ALL
USING (public.is_admin());

-- Event hosts can view claims for their events
CREATE POLICY "open_mic_claims_host_view"
ON public.open_mic_claims
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = open_mic_claims.event_id
    AND events.host_id = auth.uid()
  )
);

-- ============================================================================
-- FIX 2: Standardize is_admin() function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- ============================================================================
-- FIX 3: Tighten event_update_suggestions policies
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_update_all" ON public.event_update_suggestions;
DROP POLICY IF EXISTS "authenticated_delete_all" ON public.event_update_suggestions;
DROP POLICY IF EXISTS "admin_update_suggestions" ON public.event_update_suggestions;
DROP POLICY IF EXISTS "admin_delete_suggestions" ON public.event_update_suggestions;

CREATE POLICY "admin_update_suggestions"
ON public.event_update_suggestions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_delete_suggestions"
ON public.event_update_suggestions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- FIX 4: Add missing indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_open_mic_claims_event_id ON public.open_mic_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_open_mic_claims_profile_id ON public.open_mic_claims(profile_id);
CREATE INDEX IF NOT EXISTS idx_open_mic_claims_status ON public.open_mic_claims(status);
CREATE INDEX IF NOT EXISTS idx_event_update_suggestions_status_created ON public.event_update_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON public.blog_posts USING GIN(tags);

-- ============================================================================
-- FIX 5: Add anonymous access to public READ tables
-- ============================================================================

DROP POLICY IF EXISTS "public_read_events" ON public.events;
CREATE POLICY "public_read_events"
ON public.events
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
CREATE POLICY "venues_select_all"
ON public.venues
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "blog_posts_public_read" ON public.blog_posts;
CREATE POLICY "blog_posts_public_read"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "gallery_images_public_read" ON public.gallery_images;
CREATE POLICY "gallery_images_public_read"
ON public.gallery_images
FOR SELECT
TO anon, authenticated
USING (is_approved = true);

DROP POLICY IF EXISTS "monthly_highlights_select_all" ON public.monthly_highlights;
CREATE POLICY "monthly_highlights_select_all"
ON public.monthly_highlights
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- FIX 6: Grant necessary permissions to anonymous role
-- ============================================================================

GRANT SELECT ON public.events TO anon;
GRANT SELECT ON public.venues TO anon;
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT ON public.gallery_images TO anon;
GRANT SELECT ON public.gallery_albums TO anon;
GRANT SELECT ON public.monthly_highlights TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.spotlights TO anon;
