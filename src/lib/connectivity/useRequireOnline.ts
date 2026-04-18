/**
 * lib/connectivity/useRequireOnline.ts
 *
 * Helper for Tier-2 actions (per the Offline Mode concept) — actions that
 * genuinely cannot be performed offline, such as settlements, invite-link
 * generation, and group archival.
 *
 * Returns a boolean plus a localised hint string that feature code can
 * feed into disabled-state + inline-caption rendering. No behavioural
 * side effects.
 *
 * Gated by the OFFLINE_MODE feature flag — when the flag is off we pretend
 * we're online so nothing gets blocked during dark launch.
 *
 * Usage:
 *   const { disabled: offlineDisabled, hint } = useRequireOnline();
 *   <Button disabled={isPending || offlineDisabled}>…</Button>
 *   {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
 */

import { useTranslation } from 'react-i18next';
import { isOfflineModeEnabled } from '../featureFlags';
import { useConnectionStatus } from './useConnectionStatus';

export function useRequireOnline(): { disabled: boolean; hint: string | null } {
  const { t } = useTranslation();
  const { isOffline } = useConnectionStatus();
  const enforce = isOfflineModeEnabled() && isOffline;
  return {
    disabled: enforce,
    hint: enforce ? t('common.requires_internet') : null,
  };
}
