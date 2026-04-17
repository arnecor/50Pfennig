/**
 * lib/image/useImagePicker.ts
 *
 * Reusable hook that abstracts native (Capacitor Camera) vs web (file input)
 * image acquisition. Returns the raw File/Blob — callers handle resize + upload.
 *
 * Usage:
 *   const { pickImage, fileInputRef, onFileInputChange } = useImagePicker();
 *   // Render a hidden <input ref={fileInputRef} type="file" onChange={onFileInputChange} />
 *   // Call pickImage() when user taps the edit button
 */

import { type ChangeEvent, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type UseImagePickerReturn = {
  /** Open the camera/gallery (native) or file dialog (web). Resolves with a File or null if cancelled. */
  pickImage: () => Promise<File | null>;
  /** Ref to attach to the hidden <input type="file"> element (web fallback). */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** onChange handler to attach to the hidden <input type="file"> element. */
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

export function useImagePicker(): UseImagePickerReturn {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Resolve callback stored so the hidden input's onChange can resolve the promise
  const resolveRef = useRef<((file: File | null) => void) | null>(null);

  const pickImage = useCallback(async (): Promise<File | null> => {
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
          quality: 80,
          promptLabelHeader: t('common.camera_prompt_header'),
          promptLabelCancel: t('common.cancel'),
          promptLabelPhoto: t('common.camera_prompt_photo'),
          promptLabelPicture: t('common.camera_prompt_picture'),
        });
        if (!photo.webPath) return null;
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        return new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
      } catch {
        // User cancelled or permission denied
        return null;
      }
    }

    // Web: trigger hidden file input and wait for selection
    return new Promise<File | null>((resolve) => {
      resolveRef.current = resolve;
      fileInputRef.current?.click();
    });
  }, [t]);

  const onFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Reset so selecting the same file again triggers onChange
    e.target.value = '';
    resolveRef.current?.(file);
    resolveRef.current = null;
  }, []);

  return { pickImage, fileInputRef, onFileInputChange };
}
