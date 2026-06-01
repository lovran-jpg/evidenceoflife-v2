
-- Create storage bucket for moment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('moment-photos', 'moment-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload moment photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'moment-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to view moment photos (public bucket)
CREATE POLICY "Moment photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'moment-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own moment photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'moment-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
