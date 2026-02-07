-- Fix anon visibility for public timeslot data.
--
-- Background:
-- 20260202000004 revoked EXECUTE on public.is_admin() from anon/public.
-- Timeslot tables still had FOR ALL host/admin policies applying to anon,
-- so anon SELECT could fail with "permission denied for function is_admin".
--
-- Strategy:
-- Scope mutating/management policies to authenticated users only.
-- Keep public read policies unchanged.

-- event_timeslots
ALTER POLICY "Hosts can manage their event timeslots"
  ON public.event_timeslots
  TO authenticated;

ALTER POLICY "Admins can manage all timeslots"
  ON public.event_timeslots
  TO authenticated;

-- timeslot_claims
ALTER POLICY "Authenticated users can create own claims"
  ON public.timeslot_claims
  TO authenticated;

ALTER POLICY "Users can update own claims"
  ON public.timeslot_claims
  TO authenticated;

ALTER POLICY "Users can delete own claims"
  ON public.timeslot_claims
  TO authenticated;

ALTER POLICY "Hosts can manage claims on their events"
  ON public.timeslot_claims
  TO authenticated;

ALTER POLICY "Admins can manage all claims"
  ON public.timeslot_claims
  TO authenticated;

-- event_lineup_state
ALTER POLICY "Hosts can manage lineup state"
  ON public.event_lineup_state
  TO authenticated;

ALTER POLICY "Admins can manage lineup state"
  ON public.event_lineup_state
  TO authenticated;
