/**
 * features/groups/hooks/useUploadGroupImage.ts
 *
 * TanStack Query mutation hook for uploading a custom image for a group.
 *
 * Responsibility split:
 *   - Hook: resize the raw file to 256×256 JPEG (UI-level concern)
 *   - Repository: storage upload + URL construction + DB update (persistence concern)
 */

import type { GroupId } from '@domain/types';
import { resizeImage } from '@lib/image/resizeImage';
import { groupRepository } from '@repositories';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUploadGroupImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, file }: { groupId: GroupId; file: Blob }) => {
      const resized = await resizeImage(file);
      return groupRepository.uploadImage(groupId, resized);
    },
    onSuccess: (_group, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
  });
};
