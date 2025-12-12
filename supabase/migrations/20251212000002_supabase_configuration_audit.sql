-- ============================================================================
-- SUPABASE CONFIGURATION AUDIT QUERIES
-- Run these queries in Supabase SQL Editor to verify security configuration
-- ============================================================================
-- This file contains diagnostic queries ONLY - no schema changes
-- Copy each section to the SQL Editor and run to verify configuration
-- ============================================================================

-- ============================================================================
-- PHASE 1: SECURITY CORE (DATABASE)
-- ============================================================================

-- ============================================================================
-- 1.1: CHECK RLS STATUS ON ALL TABLES
-- Expected: ALL tables should have RLS enabled (relrowsecurity = true)
-- ============================================================================
SELECT
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN '[PASS] RLS Enabled' ELSE '[FAIL] RLS DISABLED' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY
    CASE WHEN rowsecurity THEN 1 ELSE 0 END,  -- Failed first
    tablename;

-- ============================================================================
-- 1.2: LIST ALL RLS POLICIES BY TABLE
-- Verify each table has appropriate policies for SELECT/INSERT/UPDATE/DELETE
-- ============================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 1.3: TABLES WITHOUT ANY RLS POLICIES (CRITICAL)
-- These tables have RLS enabled but no policies = NO ACCESS
-- ============================================================================
SELECT
    t.tablename,
    '[ACTION REQUIRED] RLS enabled but NO POLICIES defined' AS issue
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0;

-- ============================================================================
-- 1.4: CHECK FOR OVERLY PERMISSIVE SELECT POLICIES
-- Policies that allow ANY user to read ALL data
-- ============================================================================
SELECT
    tablename,
    policyname,
    '[REVIEW] Public read access' AS warning,
    qual AS condition
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND (qual = 'true' OR qual IS NULL OR qual = '(true)')
ORDER BY tablename;

-- ============================================================================
-- 1.5: CHECK FOR ADMIN POLICIES USING is_admin()
-- Verify admin-only tables use the secure is_admin() function
-- ============================================================================
SELECT
    tablename,
    policyname,
    cmd,
    CASE
        WHEN qual ILIKE '%is_admin()%' THEN '[PASS] Uses is_admin()'
        WHEN qual ILIKE '%role%=%admin%' THEN '[REVIEW] Direct role check'
        WHEN qual ILIKE '%app_meta%' THEN '[REVIEW] Uses app_metadata'
        ELSE '[INFO] Other condition'
    END AS admin_check_method,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%admin%' OR policyname ILIKE '%admin%')
ORDER BY tablename;

-- ============================================================================
-- 1.6: VERIFY is_admin() FUNCTION EXISTS AND IS SECURE
-- ============================================================================
SELECT
    proname AS function_name,
    prosecdef AS security_definer,
    provolatile AS volatility,
    pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- PHASE 2: API & FUNCTION HARDENING
-- ============================================================================

-- ============================================================================
-- 2.1: LIST ALL RPC FUNCTIONS (Check for SECURITY INVOKER vs DEFINER)
-- SECURITY INVOKER = runs with caller's permissions (safer for user actions)
-- SECURITY DEFINER = runs with owner's permissions (use carefully)
-- ============================================================================
SELECT
    proname AS function_name,
    CASE WHEN prosecdef THEN '[REVIEW] SECURITY DEFINER' ELSE '[PASS] SECURITY INVOKER' END AS security_mode,
    CASE provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END AS volatility,
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prokind = 'f'  -- functions only, not aggregates
ORDER BY proname;

-- ============================================================================
-- 2.2: CHECK FOR FUNCTIONS THAT REFERENCE auth.users DIRECTLY
-- Direct queries to auth.users in RLS can cause issues
-- ============================================================================
SELECT
    proname AS function_name,
    pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND pg_get_functiondef(oid) ILIKE '%auth.users%'
ORDER BY proname;

-- ============================================================================
-- 2.3: LIST ALL TRIGGERS (potential security implications)
-- ============================================================================
SELECT
    trigger_name,
    event_object_table AS table_name,
    event_manipulation AS trigger_event,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- PHASE 3: PERFORMANCE & INTEGRITY
-- ============================================================================

-- ============================================================================
-- 3.1: CHECK ALL TABLES HAVE PRIMARY KEYS
-- ============================================================================
SELECT
    t.table_name,
    CASE
        WHEN tc.constraint_name IS NOT NULL THEN '[PASS] Has PK: ' || kc.column_name
        ELSE '[FAIL] NO PRIMARY KEY'
    END AS pk_status
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc
    ON t.table_name = tc.table_name
    AND t.table_schema = tc.table_schema
    AND tc.constraint_type = 'PRIMARY KEY'
LEFT JOIN information_schema.key_column_usage kc
    ON tc.constraint_name = kc.constraint_name
    AND tc.table_schema = kc.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY
    CASE WHEN tc.constraint_name IS NULL THEN 0 ELSE 1 END,
    t.table_name;

-- ============================================================================
-- 3.2: CHECK FOREIGN KEY CONSTRAINTS
-- ============================================================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 3.3: LIST ALL INDEXES
-- ============================================================================
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 3.4: FIND COLUMNS THAT MIGHT NEED INDEXES
-- Common patterns: *_id columns, created_at, slug, status, email
-- ============================================================================
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = c.table_name
            AND indexdef ILIKE '%' || c.column_name || '%'
        ) THEN '[PASS] Indexed'
        ELSE '[REVIEW] May need index'
    END AS index_status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND (
    c.column_name LIKE '%_id'
    OR c.column_name IN ('created_at', 'updated_at', 'slug', 'status', 'email', 'user_id', 'event_id')
  )
ORDER BY c.table_name, c.column_name;

-- ============================================================================
-- 3.5: CHECK FOR COLUMNS WITH SENSITIVE DATA PATTERNS
-- Columns that might contain sensitive data
-- ============================================================================
SELECT
    table_name,
    column_name,
    data_type,
    '[REVIEW] Potentially sensitive column' AS warning
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name ILIKE '%password%'
    OR column_name ILIKE '%secret%'
    OR column_name ILIKE '%token%'
    OR column_name ILIKE '%key%'
    OR column_name ILIKE '%ssn%'
    OR column_name ILIKE '%credit%'
  )
ORDER BY table_name, column_name;

-- ============================================================================
-- 3.6: DATA TYPE AUDIT - Check for overly permissive types
-- ============================================================================
SELECT
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    CASE
        WHEN data_type = 'text' AND column_name LIKE '%id' THEN '[REVIEW] ID column using TEXT instead of UUID'
        WHEN data_type = 'character varying' AND character_maximum_length IS NULL THEN '[INFO] VARCHAR without length'
        ELSE '[OK]'
    END AS type_review
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, column_name;

-- ============================================================================
-- SUMMARY QUERIES
-- ============================================================================

-- ============================================================================
-- SUMMARY: Tables with RLS disabled (CRITICAL)
-- ============================================================================
SELECT
    '[CRITICAL] Tables with RLS DISABLED:' AS category,
    string_agg(tablename, ', ') AS tables
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- ============================================================================
-- SUMMARY: Table count and RLS status overview
-- ============================================================================
SELECT
    COUNT(*) FILTER (WHERE rowsecurity = true) AS tables_with_rls,
    COUNT(*) FILTER (WHERE rowsecurity = false) AS tables_without_rls,
    COUNT(*) AS total_tables
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================================================
-- EXPECTED TABLES AND THEIR RLS STATUS (Based on migration analysis)
-- ============================================================================
-- profiles          - RLS ENABLED (public read, own write)
-- events            - RLS ENABLED (public read, host/admin write)
-- event_slots       - RLS ENABLED (public read, performer claim, host manage)
-- venues            - RLS ENABLED (public read, admin write)
-- event_rsvps       - RLS ENABLED (own read/write, admin all)
-- approved_hosts    - RLS ENABLED (own read, admin all)
-- host_requests     - RLS ENABLED (own read/create, admin all)
-- event_hosts       - RLS ENABLED (own invitations, accepted public)
-- favorites         - RLS ENABLED (own only)
-- gallery_images    - RLS ENABLED (approved public, own all, admin all)
-- blog_posts        - RLS ENABLED (published public, author drafts, admin all)
-- blog_comments     - RLS ENABLED (approved public, own all, admin all)
-- blog_likes        - RLS ENABLED (public read, own create/delete)
-- admin_notifications - RLS ENABLED (admin only)
-- volunteer_signups - RLS ENABLED (public insert, admin read/update/delete)
-- monthly_highlights - RLS ENABLED (public read, admin write)
-- event_update_suggestions - RLS ENABLED (public insert, authenticated all)
-- open_mic_comments - RLS ENABLED (public read, own write)
-- open_mic_claims   - RLS status unclear (check migration)
-- studio_services   - RLS ENABLED (public read, studio owner write)
-- studio_appointments - RLS ENABLED (performer own, studio manage)
-- spotlights        - RLS ENABLED (public read, admin write)
-- ============================================================================
