-- Migration: Revoke dangerous table privileges from anon and authenticated
--
-- TRUNCATE, TRIGGER, and REFERENCES are dangerous privileges that should never
-- be granted to anon or authenticated roles in a Supabase project:
--
-- - TRUNCATE: Allows deleting ALL rows from a table instantly (bypasses RLS)
-- - TRIGGER: Allows creating triggers that run as table owner (privilege escalation)
-- - REFERENCES: Allows creating foreign keys to the table (can leak data existence)
--
-- These privileges are typically granted by default when using "GRANT ALL" or
-- by Supabase's default table creation. This migration removes them.

-- Revoke from all public tables and views
DO $$
DECLARE
    tbl RECORD;
BEGIN
    -- Revoke from base tables
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon', tbl.table_name);
        EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM authenticated', tbl.table_name);
    END LOOP;

    -- Also revoke from views (these are phantom grants but let's be thorough)
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'VIEW'
    LOOP
        EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM anon', tbl.table_name);
        EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM authenticated', tbl.table_name);
    END LOOP;
END $$;

-- Also revoke from any future tables created in public schema
-- This prevents drift when new tables are created
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;
