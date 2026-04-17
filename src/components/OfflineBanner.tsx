/**
 * components/OfflineBanner.tsx
 *
 * Persistent slim banner shown at the top of the app shell while the
 * device is offline or on a weak link. Auto-hides on reconnect.
 *
 * Style follows the Offline Mode concept:
 *   - Neutral (not red) because offline is a state, not an error
 *   - ~32px tall, full width, no dismiss button
 *   - Distinct copy for hard offline vs. soft offline (train tunnel)
 *
 * Gated by the OFFLINE_MODE feature flag — rendering nothing when the
 * flag is off preserves today's behaviour during dark launch.
 */

import { useConnectionStatus } from '@lib/connectivity/useConnectionStatus';
import { isOfflineModeEnabled } from '@lib/featureFlags';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, isHardOffline } = useConnectionStatus();

  if (!isOfflineModeEnabled()) return null;
  if (isOnline) return null;

  const textKey = isHardOffline ? 'offline.banner_hard' : 'offline.banner_soft';

  return (
    <output
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 dark:bg-zinc-900"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t(textKey)}</span>
    </output>
  );
}
