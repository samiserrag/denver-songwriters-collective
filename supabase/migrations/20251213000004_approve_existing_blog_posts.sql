-- Migration: Approve Existing Blog Posts
-- Date: December 13, 2024
-- Purpose: Set is_approved = true for existing published blog posts
-- This fixes the 404 issue where posts show on homepage but not detail page

-- ============================================================================
-- 1. APPROVE ALL PUBLISHED BLOG POSTS
-- The blog detail page requires BOTH is_published AND is_approved
-- Homepage was only checking is_published, causing inconsistent behavior
-- ============================================================================
UPDATE blog_posts
SET is_approved = true,
    updated_at = NOW()
WHERE is_published = true
  AND (is_approved = false OR is_approved IS NULL);

-- ============================================================================
-- 2. VERIFY THE FIX
-- Show all blog posts with their approval status
-- ============================================================================
SELECT
    id,
    slug,
    title,
    is_published,
    is_approved,
    published_at
FROM blog_posts
ORDER BY published_at DESC NULLS LAST;
