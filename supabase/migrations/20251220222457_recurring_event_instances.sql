-- Recurring Event Instances Migration
--
-- Strategy: Option A - Generate individual event instances
-- When a recurring event is created, we generate the next N occurrences as separate rows
-- Each instance has a parent_event_id linking back to the template event

-- Add parent_event_id to track recurring event relationships
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Add recurrence fields to template events
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT; -- 'weekly', 'biweekly', 'monthly'
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_end_date DATE; -- When to stop generating instances

-- Index for finding instances of a parent event
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id) WHERE parent_event_id IS NOT NULL;

-- Index for finding recurring template events
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring) WHERE is_recurring = true;

-- Function to generate recurring event instances
-- Call this when creating or updating a recurring event
CREATE OR REPLACE FUNCTION generate_recurring_event_instances(
  p_parent_event_id UUID,
  p_weeks_ahead INTEGER DEFAULT 8
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent events%ROWTYPE;
  v_current_date DATE;
  v_end_date DATE;
  v_day_offset INTEGER;
  v_instances_created INTEGER := 0;
  v_new_event_id UUID;
BEGIN
  -- Get the parent event
  SELECT * INTO v_parent FROM events WHERE id = p_parent_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent event not found';
  END IF;

  IF NOT v_parent.is_recurring THEN
    RAISE EXCEPTION 'Event is not marked as recurring';
  END IF;

  -- Calculate day offset for the day_of_week
  -- PostgreSQL: 0=Sunday, 1=Monday, ..., 6=Saturday
  v_day_offset := CASE v_parent.day_of_week
    WHEN 'Sunday' THEN 0
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
    WHEN 'Saturday' THEN 6
    ELSE 1 -- Default to Monday
  END;

  -- Find the next occurrence of this day
  v_current_date := CURRENT_DATE;
  WHILE EXTRACT(DOW FROM v_current_date) != v_day_offset LOOP
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  -- Set end date (either recurrence_end_date or weeks_ahead from now)
  v_end_date := COALESCE(v_parent.recurrence_end_date, CURRENT_DATE + (p_weeks_ahead * 7));

  -- Generate instances
  WHILE v_current_date <= v_end_date LOOP
    -- Check if instance already exists for this date
    IF NOT EXISTS (
      SELECT 1 FROM events
      WHERE parent_event_id = p_parent_event_id
      AND event_date = v_current_date
    ) THEN
      -- Create new instance
      INSERT INTO events (
        title,
        slug,
        description,
        venue_id,
        venue_name,
        event_type,
        event_date,
        start_time,
        end_time,
        day_of_week,
        image_url,
        capacity,
        host_id,
        is_published,
        status,
        parent_event_id,
        is_recurring,
        has_timeslots,
        total_slots,
        slot_duration_minutes,
        allow_guest_slots
      )
      VALUES (
        v_parent.title,
        v_parent.slug || '-' || to_char(v_current_date, 'YYYY-MM-DD'),
        v_parent.description,
        v_parent.venue_id,
        v_parent.venue_name,
        v_parent.event_type,
        v_current_date,
        v_parent.start_time,
        v_parent.end_time,
        v_parent.day_of_week,
        v_parent.image_url,
        v_parent.capacity,
        v_parent.host_id,
        v_parent.is_published,
        'active',
        p_parent_event_id,
        false, -- instances are not recurring themselves
        v_parent.has_timeslots,
        v_parent.total_slots,
        v_parent.slot_duration_minutes,
        v_parent.allow_guest_slots
      )
      RETURNING id INTO v_new_event_id;

      -- If parent has timeslots, generate them for the new instance
      IF v_parent.has_timeslots AND v_parent.total_slots > 0 THEN
        PERFORM generate_event_timeslots(v_new_event_id);
      END IF;

      v_instances_created := v_instances_created + 1;
    END IF;

    -- Move to next occurrence based on pattern
    CASE v_parent.recurrence_pattern
      WHEN 'weekly' THEN
        v_current_date := v_current_date + INTERVAL '7 days';
      WHEN 'biweekly' THEN
        v_current_date := v_current_date + INTERVAL '14 days';
      WHEN 'monthly' THEN
        v_current_date := v_current_date + INTERVAL '1 month';
      ELSE
        v_current_date := v_current_date + INTERVAL '7 days'; -- Default weekly
    END CASE;
  END LOOP;

  RETURN v_instances_created;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_recurring_event_instances(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION generate_recurring_event_instances IS
'Generates future instances of a recurring event. Call after creating/updating a recurring event template.';
