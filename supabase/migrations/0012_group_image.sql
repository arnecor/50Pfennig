-- =============================================================================
-- 0012_group_image.sql
-- Adds group picture support: image_url column + updated RLS + storage policies
-- =============================================================================

-- 1. Add nullable image_url column to groups
--    NULL        = default icon (Users)
--    'icon:X'    = predefined icon key (e.g. 'icon:camping', 'icon:plane', 'icon:vacation')
--    full URL    = custom uploaded image
ALTER TABLE public.groups
  ADD COLUMN image_url text DEFAULT NULL;

-- 2. Broaden update RLS: any group member may update the group (name, image)
--    Previously restricted to creator only.
DROP POLICY IF EXISTS "groups: creator can update" ON public.groups;

CREATE POLICY "groups: members can update"
  ON public.groups FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.group_members WHERE group_id = id
    )
  );

-- 3. Storage RLS policies for group images in the existing `avatars` bucket
--    Path convention: groups/{groupId}/image
--    Any group member may upload/update/delete their group's image.

DROP POLICY IF EXISTS "avatars: group member can upload group image" ON storage.objects;
CREATE POLICY "avatars: group member can upload group image"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'groups'
    AND auth.uid() IN (
      SELECT user_id FROM public.group_members
      WHERE group_id = ((storage.foldername(name))[2])::uuid
    )
  );

DROP POLICY IF EXISTS "avatars: group member can update group image" ON storage.objects;
CREATE POLICY "avatars: group member can update group image"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'groups'
    AND auth.uid() IN (
      SELECT user_id FROM public.group_members
      WHERE group_id = ((storage.foldername(name))[2])::uuid
    )
  );

DROP POLICY IF EXISTS "avatars: group member can delete group image" ON storage.objects;
CREATE POLICY "avatars: group member can delete group image"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'groups'
    AND auth.uid() IN (
      SELECT user_id FROM public.group_members
      WHERE group_id = ((storage.foldername(name))[2])::uuid
    )
  );
