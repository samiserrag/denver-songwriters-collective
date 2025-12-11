-- Enable RLS on venues table
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read venues
CREATE POLICY "venues_select_all"
ON public.venues
FOR SELECT
USING (true);

-- Only admins can insert venues
CREATE POLICY "venues_insert_admin"
ON public.venues
FOR INSERT
WITH CHECK (public.is_admin());

-- Only admins can update venues
CREATE POLICY "venues_update_admin"
ON public.venues
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Only admins can delete venues
CREATE POLICY "venues_delete_admin"
ON public.venues
FOR DELETE
USING (public.is_admin());
