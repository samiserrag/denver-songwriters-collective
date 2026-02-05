-- Add FK so PostgREST can embed profiles from host_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'host_requests_user_id_profiles_fkey'
      AND conrelid = 'public.host_requests'::regclass
  ) THEN
    ALTER TABLE public.host_requests
      ADD CONSTRAINT host_requests_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
