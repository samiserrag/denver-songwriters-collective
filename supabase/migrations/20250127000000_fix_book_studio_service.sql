-- Fix rpc_book_studio_service: 
-- 1. Change to SECURITY DEFINER so overlap check can see all appointments
-- 2. Fix service validation to use IF NOT FOUND instead of boolean check

CREATE OR REPLACE FUNCTION public.rpc_book_studio_service(service_id uuid, desired_time timestamp with time zone)
 RETURNS studio_appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  service_duration INTEGER;
  result studio_appointments;
BEGIN
  -- Lock service row to prevent double-booking race condition
  PERFORM 1 FROM studio_services WHERE id = service_id FOR UPDATE;

  -- Validate service exists and get duration
  SELECT duration_min
  INTO service_duration
  FROM studio_services
  WHERE id = service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  -- Validate desired time is in the future
  IF desired_time <= NOW() THEN
    RAISE EXCEPTION 'Appointment time must be in the future';
  END IF;

  -- Check for double-booking (overlapping appointments for same service)
  -- SECURITY DEFINER allows seeing all appointments regardless of performer
  IF EXISTS (
    SELECT 1
    FROM studio_appointments sa
    JOIN studio_services ss ON sa.service_id = ss.id
    WHERE sa.service_id = rpc_book_studio_service.service_id
      AND sa.status NOT IN ('cancelled')
      AND (
        (desired_time, desired_time + (service_duration * INTERVAL '1 minute'))
        OVERLAPS
        (sa.appointment_time, sa.appointment_time + (ss.duration_min * INTERVAL '1 minute'))
      )
  ) THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  -- Create the appointment
  INSERT INTO studio_appointments (
    service_id,
    performer_id,
    appointment_time,
    status
  ) VALUES (
    service_id,
    auth.uid(),
    desired_time,
    'pending'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;
