/**
 * features/friends/components/QRCodeScanner.tsx
 *
 * Full-screen QR code scanner using @capacitor-mlkit/barcode-scanning.
 * On detecting a valid invite URL, extracts the token and calls acceptInvite.
 *
 * Only available on native platforms (guarded by Capacitor.isNativePlatform()).
 */

import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { Button } from '@components/ui/button';
import { useAcceptInvite } from '@features/friends/hooks/useAcceptInvite';
import { useNavigate } from '@tanstack/react-router';
import { Check, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ScanState = 'scanning' | 'processing' | 'success' | 'error';

function extractTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^[a-f0-9]{32}$/.test(lastPart)) {
      return lastPart;
    }
    return null;
  } catch {
    return null;
  }
}

export default function QRCodeScanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const acceptInvite = useAcceptInvite();

  const [state, setState] = useState<ScanState>('scanning');
  const [errorMessage, setErrorMessage] = useState('');
  const [friendName, setFriendName] = useState('');

  const stopScanning = useCallback(async () => {
    document.documentElement.classList.remove('barcode-scanner-active');
    try {
      await BarcodeScanner.stopScan();
      await BarcodeScanner.removeAllListeners();
    } catch {
      // Ignore — scanner may not be running
    }
  }, []);

  const startScanning = useCallback(async () => {
    // Check/request camera permission
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted') {
      setState('error');
      setErrorMessage(t('friends.scan_permission_denied'));
      return;
    }

    // Add scan listener
    await BarcodeScanner.addListener('barcodeScanned', async (result) => {
      const barcode = result.barcode;
      if (!barcode?.rawValue) return;

      const token = extractTokenFromUrl(barcode.rawValue);
      if (!token) return;

      // Stop scanning immediately to prevent duplicate scans
      await stopScanning();
      setState('processing');

      try {
        await acceptInvite.mutateAsync(token);
        setState('success');
        setFriendName(''); // We don't know the name from the token
      } catch (err) {
        setState('error');
        const message = err instanceof Error ? err.message : '';
        if (message.includes('P0002')) {
          setErrorMessage(t('friends.invite_error_expired'));
        } else if (message.includes('P0003')) {
          setErrorMessage(t('friends.invite_error_self'));
        } else if (message.includes('P0004')) {
          setErrorMessage(t('friends.invite_error_already_friends'));
        } else {
          setErrorMessage(t('friends.invite_error_generic'));
        }
      }
    });

    // Make WebView transparent so the native camera layer shows through
    document.documentElement.classList.add('barcode-scanner-active');

    // Start scanning
    await BarcodeScanner.startScan({
      formats: [BarcodeFormat.QrCode],
      lensFacing: LensFacing.Back,
    });
  }, [acceptInvite, stopScanning, t]);

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, [startScanning, stopScanning]);

  // Success state
  if (state === 'success') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <p className="text-center text-lg font-semibold">
          {friendName
            ? t('friends.friend_added', { name: friendName })
            : t('friends.friend_added_generic')}
        </p>
        <Button onClick={() => navigate({ to: '/friends' })}>{t('friends.go_to_friends')}</Button>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <X className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-center text-sm text-destructive">{errorMessage}</p>
        <Button
          variant="outline"
          onClick={() => {
            setState('scanning');
            startScanning();
          }}
        >
          {t('friends.scan_retry')}
        </Button>
      </div>
    );
  }

  // Processing state
  if (state === 'processing') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Scanning state — the camera view is rendered by the native plugin behind the webview.
  // We show a transparent overlay with instructions.
  return (
    <div className="flex flex-1 flex-col items-center justify-end pb-20">
      <div className="rounded-xl bg-black/60 px-6 py-3">
        <p className="text-center text-sm text-white">{t('friends.scan_hint')}</p>
      </div>
    </div>
  );
}
