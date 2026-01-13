-- Fix generate_event_timeslots to include date_key
-- Phase ABC: The ABC6 migration made date_key NOT NULL on event_timeslots,
-- but the generate_event_timeslots function wasn't updated to set it.
-- This migration fixes the function to derive date_key from event.event_date.

CREATE OR REPLACE FUNCTION public.generate_event_timeslots(p_event_id uuid)
RETURNS SETOF public.event_timeslots
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_event RECORD;
  v_slot_index integer;
  v_offset integer;
  v_date_key text;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.total_slots IS NULL OR v_event.total_slots <= 0 THEN
    RAISE EXCEPTION 'Event must have total_slots configured';
  END IF;

  -- Derive date_key from event_date (required for ABC6 constraint)
  -- For events without event_date, use a fallback based on day_of_week and recurrence
  IF v_event.event_date IS NOT NULL THEN
    v_date_key := v_event.event_date::text;
  ELSE
    -- For recurring events without event_date, we cannot determine date_key
    -- The caller should provide the date_key via a different mechanism
    RAISE EXCEPTION 'Event must have event_date set for timeslot generation. event_id: %', p_event_id;
  END IF;

  -- Delete existing timeslots for this event + date_key (for regeneration)
  -- This will CASCADE delete claims, so only call before any claims exist
  DELETE FROM public.event_timeslots WHERE event_id = p_event_id AND date_key = v_date_key;

  -- Generate timeslots
  FOR v_slot_index IN 0..(v_event.total_slots - 1) LOOP
    -- Calculate offset if event has start_time
    IF v_event.start_time IS NOT NULL THEN
      v_offset := v_slot_index * COALESCE(v_event.slot_duration_minutes, 15);
    ELSE
      v_offset := NULL;
    END IF;

    INSERT INTO public.event_timeslots (
      event_id,
      slot_index,
      start_offset_minutes,
      duration_minutes,
      date_key
    ) VALUES (
      p_event_id,
      v_slot_index,
      v_offset,
      COALESCE(v_event.slot_duration_minutes, 15),
      v_date_key
    );
  END LOOP;

  RETURN QUERY SELECT * FROM public.event_timeslots WHERE event_id = p_event_id AND date_key = v_date_key ORDER BY slot_index;
END;
$function$;

COMMENT ON FUNCTION public.generate_event_timeslots(uuid) IS 'Generate timeslots for an event based on total_slots. Sets date_key from event.event_date (ABC6 requirement).';
