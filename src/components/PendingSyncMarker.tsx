/**
 * components/PendingSyncMarker.tsx
 *
 * Small clock icon rendered next to an entity (expense, group) whose
 * create/update/delete is still queued in the offline mutation queue.
 *
 * Accepts the entity id — when it matches a queued item, the marker is
 * shown; otherwise the component renders nothing. For entities created
 * offline the id will be a `tmp_` UUID; for edits/deletes of existing
 * entities the id is the server UUID. Either way the queue lookup is
 * by id, so both cases work without special casing.
 *
 * If the queued item has passed MAX_RETRIES (permanently failed) we swap
 * the icon for an amber warning — the user is invited to the Pending
 * Changes screen from the banner, so this marker stays subtle.
 */

import { cn } from '@/lib/utils';
import { isPermanentlyFailed, useOfflineQueue } from '@lib/storage/offlineQueue';
import { AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  id: string;
  className?: string;
};

export default function PendingSyncMarker({ id, className }: Props) {
  const { t } = useTranslation();
  const item = useOfflineQueue((s) => s.items.find((m) => m.id === id));

  if (!item) return null;

  const failed = isPermanentlyFailed(item);
  const Icon = failed ? AlertTriangle : Clock;
  const label = failed ? t('offline.sync_error') : t('offline.pending_sync');

  return (
    <span
      className={cn(
        'inline-flex items-center',
        failed ? 'text-amber-600' : 'text-muted-foreground',
        className,
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
