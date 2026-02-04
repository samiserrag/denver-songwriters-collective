-- Migration: Add reporter_id column to change_reports
--
-- CI CONTEXT:
-- Fresh-migration replay fails applying 20251216000001_v030_verification_system.sql
-- with SQLSTATE 42703 (column "reporter_id" does not exist).
-- That migration creates RLS policy referencing reporter_id, but the table was
-- created by 20251215000002 without that column.
--
-- EVIDENCE:
-- - 20251215000002 creates change_reports with reporter_email (no reporter_id)
-- - 20251216000001 tries to CREATE TABLE IF NOT EXISTS with reporter_id (skipped)
-- - 20251216000001 then creates policy referencing reporter_id (fails)
--
-- This migration must run BEFORE 20251216000001_v030_verification_system.sql

ALTER TABLE public.change_reports
ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES profiles(id);

COMMENT ON COLUMN public.change_reports.reporter_id IS 'User ID of the reporter, if authenticated';
