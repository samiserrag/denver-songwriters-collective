-- Add attachments column to feedback_submissions
-- Stores array of storage URLs for uploaded screenshots
ALTER TABLE public.feedback_submissions
ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

-- Create private storage bucket for feedback attachments
-- Only accessible via signed URLs (admin only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false, -- Private bucket
  5242880, -- 5MB max per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback-attachments bucket

-- Anyone can upload (feedback submissions are public)
-- Path pattern: feedback/{feedback_id}/{uuid}.{ext}
CREATE POLICY "Anyone can upload feedback attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'feedback-attachments'
  AND (storage.foldername(name))[1] = 'feedback'
);

-- Only admins can view/download feedback attachments
CREATE POLICY "Admins can view feedback attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete feedback attachments
CREATE POLICY "Admins can delete feedback attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Comment for documentation
COMMENT ON COLUMN public.feedback_submissions.attachments IS 'Array of storage URLs for uploaded screenshots (max 2, PNG/JPG only, 5MB each)';
