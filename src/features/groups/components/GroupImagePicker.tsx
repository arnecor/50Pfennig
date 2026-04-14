/**
 * features/groups/components/GroupImagePicker.tsx
 *
 * Bottom-sheet overlay for choosing a group's visual identity.
 * Offers:
 *   - A grid of predefined icons
 *   - An "Upload photo" option
 *   - A "Reset to default" option
 *
 * Props:
 *   onPickIcon    – called with the icon key (e.g. 'camping') when user picks an icon
 *   onPickFile    – called with the selected File when user wants a custom image
 *   onReset       – called when user picks "Reset to default"
 *   onClose       – called when the overlay is dismissed
 */

import { GroupAvatar } from '@components/shared/GroupAvatar';
import { buildIconImageUrl } from '@domain/groupImage';
import { useImagePicker } from '@lib/image/useImagePicker';
import { cn } from '@lib/utils';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PREDEFINED_ICONS = [
  { key: 'default', labelKey: 'groups.icon_group' },
  { key: 'camping', labelKey: 'groups.icon_camping' },
  { key: 'plane', labelKey: 'groups.icon_plane' },
  { key: 'vacation', labelKey: 'groups.icon_vacation' },
] as const;

interface GroupImagePickerProps {
  onPickIcon: (iconKey: string) => void;
  onPickFile: (file: File) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function GroupImagePicker({
  onPickIcon,
  onPickFile,
  onReset,
  onClose,
}: GroupImagePickerProps) {
  const { t } = useTranslation();
  const { pickImage, fileInputRef, onFileInputChange } = useImagePicker();

  const handleUpload = async () => {
    const file = await pickImage();
    if (file) {
      onPickFile(file);
    }
    onClose();
  };

  return (
    <>
      {/* Hidden file input — web fallback for image picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={onFileInputChange}
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background pb-safe-bottom shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-sm font-semibold text-foreground">{t('groups.edit_picture')}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Predefined icon grid */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('groups.choose_icon')}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {PREDEFINED_ICONS.map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onPickIcon(key);
                    onClose();
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors',
                    'hover:bg-muted active:bg-muted/80',
                  )}
                >
                  <GroupAvatar imageUrl={buildIconImageUrl(key)} groupName={key} size="md" />
                  <span className="text-xs text-muted-foreground leading-tight text-center">
                    {t(labelKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload photo */}
          <button
            type="button"
            onClick={() => void handleUpload()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted active:bg-muted/80"
          >
            {t('groups.upload_photo')}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full py-2 text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
          >
            {t('groups.reset_to_default')}
          </button>
        </div>
      </div>
    </>
  );
}
