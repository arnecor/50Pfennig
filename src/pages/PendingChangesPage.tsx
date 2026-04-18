/**
 * pages/PendingChangesPage.tsx
 *
 * Route: /account/pending-changes
 *
 * Surfaces queued offline mutations that either (a) have hit MAX_RETRIES or
 * (b) came back with a permanent error on replay. The user sees a
 * plain-language reason per item and can Retry (reset counters, try again on
 * next flush) or Discard (remove from queue — optimistic cache is cleared by
 * the surrounding invalidate).
 *
 * See Offline Mode concept — §C Retry & backoff, §5 Error resolution.
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useConnectivityStore } from '@lib/connectivity/connectivityStore';
import { flushOfflineQueue } from '@lib/storage/flushOfflineQueue';
import {
  type MutationType,
  type QueuedMutation,
  isPermanentlyFailed,
  useOfflineQueue,
} from '@lib/storage/offlineQueue';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MUTATION_LABEL_KEY: Record<MutationType, string> = {
  CREATE_EXPENSE: 'offline.mutation_create_expense',
  UPDATE_EXPENSE: 'offline.mutation_update_expense',
  DELETE_EXPENSE: 'offline.mutation_delete_expense',
  CREATE_GROUP: 'offline.mutation_create_group',
};

function PendingChangeRow({ item }: { item: QueuedMutation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const resetRetries = useOfflineQueue((s) => s.resetRetries);
  const complete = useOfflineQueue((s) => s.complete);

  const label = t(MUTATION_LABEL_KEY[item.type]);
  const reason = item.lastError ?? t('offline.reason_unknown');

  const handleRetry = () => {
    resetRetries(item.id);
    // Kick the flush so the user sees immediate movement — if still offline
    // the item just re-queues, which is fine.
    if (useConnectivityStore.getState().status === 'online') {
      void flushOfflineQueue(queryClient);
    }
  };

  const handleDiscard = () => {
    complete(item.id);
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground break-words">{reason}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('offline.retry_count', { count: item.retryCount })}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleRetry} className="flex-1">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          {t('offline.pending_changes_retry')}
        </Button>
        <Button size="sm" variant="outline" onClick={handleDiscard} className="flex-1">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          {t('offline.pending_changes_discard')}
        </Button>
      </div>
    </div>
  );
}

export default function PendingChangesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = useOfflineQueue((s) => s.items);

  const failed = items.filter(isPermanentlyFailed);
  const inFlight = items.filter((m) => !isPermanentlyFailed(m));

  return (
    <div className="min-h-full pb-24 font-sans">
      <PageHeader
        title={t('offline.pending_changes_title')}
        onBack={() => navigate({ to: '/account' })}
      />

      <div className="px-5 pt-4 space-y-6">
        {failed.length === 0 && inFlight.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('offline.pending_changes_empty')}</p>
        ) : null}

        {failed.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('offline.pending_changes_failed_heading')}
            </h2>
            <div className="space-y-2">
              {failed.map((item) => (
                <PendingChangeRow key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {inFlight.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('offline.pending_changes_inflight_heading')}
            </h2>
            <ul className="space-y-2">
              {inFlight.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground"
                >
                  {t(MUTATION_LABEL_KEY[item.type])}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
