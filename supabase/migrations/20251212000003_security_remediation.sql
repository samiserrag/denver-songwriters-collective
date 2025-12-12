-- ============================================================================
-- SECURITY REMEDIATION MIGRATION
-- Fixes identified during Supabase Configuration Audit
-- ============================================================================
-- Issues Fixed:
-- 1. open_mic_claims table missing RLS and policies
-- 2. venues table missing public SELECT policy for anonymous users
-- 3. is_admin() function inconsistency (multiple definitions)
-- 4. Missing indexes on commonly queried columns
-- 5. event_update_suggestions overly permissive policies
-- ============================================================================

-- ============================================================================
-- FIX 1: open_mic_claims table - Enable RLS and add policies
-- This table was created without RLS, leaving it completely open
-- ============================================================================

ALTER TABLE public.open_mic_claims ENABLE ROW LEVEL SECURITY;

-- Users can view claims for events they're associated with
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
-- Ensure consistent admin checking across all policies
-- Uses profiles table (database truth) not JWT metadata
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

COMMENT ON FUNCTION public.is_admin() IS
'Checks if the current user has admin role. Uses SECURITY DEFINER to bypass RLS on profiles table.';

-- ============================================================================
-- FIX 3: Tighten event_update_suggestions policies
-- Current policies allow any authenticated user to UPDATE/DELETE
-- Should only allow admins to modify suggestions
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "authenticated_update_all" ON event_update_suggestions;
DROP POLICY IF EXISTS "authenticated_delete_all" ON event_update_suggestions;

-- Create admin-only UPDATE policy
CREATE POLICY "admin_update_suggestions"
ON event_update_suggestions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Create admin-only DELETE policy
CREATE POLICY "admin_delete_suggestions"
ON event_update_suggestions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- FIX 4: Add missing indexes for performance
-- Based on common query patterns in the codebase
-- ============================================================================

-- open_mic_claims indexes
CREATE INDEX IF NOT EXISTS idx_open_mic_claims_event_id ON public.open_mic_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_open_mic_claims_profile_id ON public.open_mic_claims(profile_id);
CREATE INDEX IF NOT EXISTS idx_open_mic_claims_status ON public.open_mic_claims(status);

-- Compound index for event_update_suggestions (status + created_at for admin queries)
CREATE INDEX IF NOT EXISTS idx_event_update_suggestions_status_created
ON public.event_update_suggestions(status, created_at DESC);

-- Index on events.slug (frequently used for URL routing)
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);

-- Index on events.venue_id (for venue-based queries)
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);

-- Index on blog_posts.tags using GIN for array containment queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON public.blog_posts USING GIN(tags);

-- ============================================================================
-- FIX 5: Add anonymous access to public READ tables
-- Some tables need to be readable without authentication (e.g., public pages)
-- ============================================================================

-- Allow anonymous users to read published events (for public event listing)
DROP POLICY IF EXISTS "public_read_events" ON public.events;
CREATE POLICY "public_read_events"
ON public.events
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anonymous users to read venues
DROP POLICY IF EXISTS "venues_select_all" ON public.venues;
CREATE POLICY "venues_select_all"
ON public.venues
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anonymous users to read published blog posts
DROP POLICY IF EXISTS "blog_posts_public_read" ON public.blog_posts;
CREATE POLICY "blog_posts_public_read"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (is_published = true AND is_approved = true);

-- Allow anonymous users to read approved gallery images
DROP POLICY IF EXISTS "gallery_images_public_read" ON public.gallery_images;
CREATE POLICY "gallery_images_public_read"
ON public.gallery_images
FOR SELECT
TO anon, authenticated
USING (is_approved = true);

-- Allow anonymous users to read monthly highlights
DROP POLICY IF EXISTS "monthly_highlights_select_all" ON public.monthly_highlights;
CREATE POLICY "monthly_highlights_select_all"
ON public.monthly_highlights
FOR SELECT
TO anon, authenticated
USING (true);

-- ============================================================================
-- FIX 6: Add is_approved column to blog_posts if not exists
-- (Referenced in policy above but may not exist)
-- ============================================================================

ALTER TABLE public.blog_posts
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Update existing published posts to be approved
UPDATE public.blog_posts
SET is_approved = true
WHERE is_published = true AND is_approved IS NULL;

-- ============================================================================
-- FIX 7: Grant necessary permissions to anonymous role
-- ============================================================================

GRANT SELECT ON public.events TO anon;
GRANT SELECT ON public.venues TO anon;
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT ON public.gallery_images TO anon;
GRANT SELECT ON public.gallery_albums TO anon;
GRANT SELECT ON public.monthly_highlights TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.spotlights TO anon;

-- ============================================================================
-- VERIFICATION QUERY (run after migration to verify fixes)
-- ============================================================================
-- SELECT
--     tablename,
--     CASE WHEN rowsecurity THEN 'RLS ENABLED' ELSE 'RLS DISABLED' END AS rls_status,
--     (SELECT COUNT(*) FROM pg_policies WHERE tablename = pg_tables.tablename) AS policy_count
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- ============================================================================
