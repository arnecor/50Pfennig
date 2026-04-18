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
 * Additionally: when any queued mutation has permanently failed we render
 * a second line linking to the Pending Changes screen — that's how the
 * user learns a stuck write needs attention. That second line stays
 * visible even when online, otherwise an always-connected user would have
 * no path to the screen where the failing item lives.
 *
 * Gated by the OFFLINE_MODE feature flag — rendering nothing when the
 * flag is off preserves today's behaviour during dark launch.
 */

import { useConnectionStatus } from '@lib/connectivity/useConnectionStatus';
import { isOfflineModeEnabled } from '@lib/featureFlags';
import { isPermanentlyFailed, useOfflineQueue } from '@lib/storage/offlineQueue';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, isHardOffline } = useConnectionStatus();
  const hasFailures = useOfflineQueue((s) => s.items.some(isPermanentlyFailed));

  if (!isOfflineModeEnabled()) return null;
  if (isOnline && !hasFailures) return null;

  return (
    <div className="flex flex-col">
      {!isOnline ? (
        <output
          aria-live="polite"
          className="flex items-center justify-center gap-2 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 dark:bg-zinc-900"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t(isHardOffline ? 'offline.banner_hard' : 'offline.banner_soft')}</span>
        </output>
      ) : null}
      {hasFailures ? (
        <Link
          to="/account/pending-changes"
          className="flex items-center justify-center gap-2 bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('offline.pending_changes_link')}</span>
        </Link>
      ) : null}
    </div>
  );
}
