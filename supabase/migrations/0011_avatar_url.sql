-- =============================================================================
-- 0011_avatar_url.sql
-- Adds profile picture support: avatar_url column + storage bucket + policies
-- =============================================================================

-- 1. Add nullable avatar_url column to profiles
ALTER TABLE public.profiles
  ADD COLUMN avatar_url text DEFAULT NULL;

-- 2. Create public storage bucket for avatar images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, '{"image/jpeg","image/png","image/webp"}');

-- 3. Storage RLS policies — folder-based isolation per user

DROP POLICY IF EXISTS "avatars: public read" ON storage.objects;
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars: user can upload own" ON storage.objects;
CREATE POLICY "avatars: user can upload own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars: user can update own" ON storage.objects;
CREATE POLICY "avatars: user can update own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars: user can delete own" ON storage.objects;
CREATE POLICY "avatars: user can delete own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
