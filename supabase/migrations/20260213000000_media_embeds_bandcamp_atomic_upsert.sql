-- MEDIA-EMBED fix: expand provider CHECK to include 'bandcamp'
-- and add atomic upsert RPC to prevent destructive delete-then-fail.

-- 1. Expand provider CHECK constraint to include 'bandcamp'
ALTER TABLE public.media_embeds
  DROP CONSTRAINT IF EXISTS media_embeds_provider_check;

ALTER TABLE public.media_embeds
  ADD CONSTRAINT media_embeds_provider_check
  CHECK (provider IN ('youtube', 'spotify', 'bandcamp', 'external'));

-- 2. Atomic upsert RPC: delete + insert in a single transaction.
--    If any insert fails the delete is rolled back automatically because
--    the entire PL/pgSQL function body runs inside one transaction.
--    Uses SECURITY INVOKER so caller's RLS policies apply.
CREATE OR REPLACE FUNCTION public.upsert_media_embeds(
  p_target_type text,
  p_target_id uuid,
  p_date_key text DEFAULT NULL,
  p_rows jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Delete existing rows for this scope
  IF p_target_type = 'event_override' AND p_date_key IS NOT NULL THEN
    DELETE FROM public.media_embeds
    WHERE target_type = p_target_type
      AND target_id = p_target_id
      AND date_key = p_date_key;
  ELSE
    DELETE FROM public.media_embeds
    WHERE target_type = p_target_type
      AND target_id = p_target_id
      AND date_key IS NULL;
  END IF;

  -- If no rows to insert, return empty array
  IF jsonb_array_length(p_rows) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Insert new rows and return them
  WITH inserted AS (
    INSERT INTO public.media_embeds (
      target_type, target_id, date_key, position, url, provider, kind, created_by
    )
    SELECT
      p_target_type,
      p_target_id,
      p_date_key,
      (row_value->>'position')::int,
      row_value->>'url',
      row_value->>'provider',
      row_value->>'kind',
      (row_value->>'created_by')::uuid
    FROM jsonb_array_elements(p_rows) AS row_value
    RETURNING id, target_type, target_id, date_key, position, url, provider, kind, created_by, created_at
  )
  SELECT jsonb_agg(row_to_json(inserted.*)) INTO v_result FROM inserted;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. Grant execute to authenticated users only.
--    Authorization enforced by RLS (SECURITY INVOKER) and server-side checks.
--    Explicit revoke from anon required because Supabase default grants may
--    re-apply after CREATE FUNCTION despite REVOKE ALL FROM PUBLIC.
REVOKE ALL ON FUNCTION public.upsert_media_embeds(text, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_media_embeds(text, uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_media_embeds(text, uuid, text, jsonb) TO authenticated;
