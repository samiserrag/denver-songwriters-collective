-- Persistent, atomic rate limiter backing store for /api/events/interpret.
-- Uses a SECURITY DEFINER RPC so authenticated API routes can consume quota
-- without requiring direct table privileges.

CREATE TABLE IF NOT EXISTS public.events_interpret_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count >= 1),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_events_interpret_rate_limits_window_start
  ON public.events_interpret_rate_limits (window_start);

CREATE INDEX IF NOT EXISTS idx_events_interpret_rate_limits_updated_at
  ON public.events_interpret_rate_limits (updated_at);

ALTER TABLE public.events_interpret_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_events_interpret_rate_limit(
  p_window_seconds integer DEFAULT 900,
  p_max_requests integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz;
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', NULL
    );
  END IF;

  p_window_seconds := GREATEST(p_window_seconds, 60);
  p_max_requests := GREATEST(p_max_requests, 1);

  v_now := timezone('utc', now());
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  INSERT INTO public.events_interpret_rate_limits (user_id, window_start, request_count, created_at, updated_at)
  VALUES (v_user_id, v_window_start, 1, v_now, v_now)
  ON CONFLICT (user_id, window_start)
  DO UPDATE
    SET request_count = public.events_interpret_rate_limits.request_count + 1,
        updated_at = v_now
  RETURNING request_count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', v_count <= p_max_requests,
    'remaining', GREATEST(p_max_requests - v_count, 0),
    'reset_at', to_char(v_reset_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
END;
$$;

REVOKE ALL ON TABLE public.events_interpret_rate_limits FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events_interpret_rate_limits TO service_role;

REVOKE EXECUTE ON FUNCTION public.consume_events_interpret_rate_limit(integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.consume_events_interpret_rate_limit(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_events_interpret_rate_limit(integer, integer) TO service_role;

COMMENT ON TABLE public.events_interpret_rate_limits IS
'Sliding-window counters for conversational event interpreter rate limiting.';
COMMENT ON FUNCTION public.consume_events_interpret_rate_limit(integer, integer) IS
'Atomically consumes one interpret request for auth.uid() and returns allowed/remaining/reset_at.';
