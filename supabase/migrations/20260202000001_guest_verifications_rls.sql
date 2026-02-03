-- Migration: 20260202000001_guest_verifications_rls.sql
-- Purpose: Add explicit deny policies to guest_verifications table
-- This table contains emails and verification tokens - should only be accessed via service_role
--
-- Risk addressed: HIGH - Missing INSERT/UPDATE/DELETE policies on sensitive table
-- See: docs/security/supabase-rls-audit.md

-- Explicit deny-all for INSERT (service role handles this via bypass)
CREATE POLICY "Deny direct inserts" ON guest_verifications
FOR INSERT TO authenticated, anon
WITH CHECK (false);

-- Explicit deny-all for UPDATE
CREATE POLICY "Deny direct updates" ON guest_verifications
FOR UPDATE TO authenticated, anon
USING (false);

-- Explicit deny-all for DELETE
CREATE POLICY "Deny direct deletes" ON guest_verifications
FOR DELETE TO authenticated, anon
USING (false);

-- Note: Existing policy "Admins can view all verifications" (SELECT) remains unchanged
-- Service role operations bypass RLS entirely, so server-side code is unaffected
