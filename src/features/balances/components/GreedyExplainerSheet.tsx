/**
 * features/balances/components/GreedyExplainerSheet.tsx
 *
 * Info bottom-sheet explaining the greedy debt-simplification algorithm.
 * Opened via the HelpCircle icon next to the "So gleicht ihr aus" heading.
 */

import { useBackHandler } from '@lib/capacitor/backHandler';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

type AvatarProps = {
  initial: string;
  bgColor: string;
  textColor: string;
  size?: 'sm' | 'md';
};

function Avatar({ initial, bgColor, textColor, size = 'md' }: AvatarProps) {
  const dim = size === 'sm' ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-[11px]';
  return (
    <span
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full font-semibold`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {initial}
    </span>
  );
}

type TransferRowProps = {
  from: React.ReactNode;
  to: React.ReactNode;
  amount: string;
  note?: string;
};

function TransferRow({ from, to, amount, note }: TransferRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      {from}
      <span className="text-[10px] text-muted-foreground">→</span>
      {to}
      <span className="ml-0.5 text-[11px] font-medium text-foreground">{amount}</span>
      {note && <span className="text-[10px] text-muted-foreground">({note})</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar colour tokens — consistent across both diagrams
// ---------------------------------------------------------------------------

// oklch palette — background lightness chosen so white/dark text is clearly legible
const ANNA = { initial: 'A', bgColor: 'oklch(0.55 0.1 220)', textColor: 'oklch(1 0 0)' };
const BEN = { initial: 'B', bgColor: 'oklch(0.62 0.12 40)', textColor: 'oklch(1 0 0)' };
const CLARA = { initial: 'C', bgColor: 'oklch(0.78 0.1 75)', textColor: 'oklch(0.25 0.06 75)' };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GreedyExplainerSheet({ onClose }: Props) {
  const { t } = useTranslation();

  useBackHandler(() => {
    onClose();
    return true;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55] bg-black/40"
        onClick={onClose}
        onKeyUp={(e) => e.key === 'Escape' && onClose()}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-[60] flex flex-col rounded-t-2xl bg-background shadow-xl"
        style={{
          bottom: 0,
          maxHeight: 'min(90dvh, calc(100vh - env(safe-area-inset-top, 0px)))',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <h2 className="pr-4 text-base font-medium leading-snug text-foreground">
            {t('balances.explainer_title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-safe">
          {/* Explanation text */}
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            {t('balances.explainer_body')}
          </p>

          {/* Example card */}
          <div className="rounded-xl border border-border bg-muted/40 px-4 pb-4 pt-3">
            {/* Card heading */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('balances.explainer_example_heading')}
            </p>

            {/* Who paid what */}
            <div className="mb-1 flex items-center gap-2">
              <Avatar {...ANNA} />
              <p className="text-[13px] text-foreground">
                Anna bezahlt <strong className="font-medium">Hotel</strong> für alle:{' '}
                <strong className="font-medium">60 €</strong>
              </p>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <Avatar {...BEN} />
              <p className="text-[13px] text-foreground">
                Ben bezahlt <strong className="font-medium">Restaurant</strong> für alle:{' '}
                <strong className="font-medium">30 €</strong>
              </p>
            </div>

            <p className="mb-3 text-[12px] text-muted-foreground">
              {t('balances.explainer_example_subtitle')}
            </p>

            {/* Before / After comparison */}
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              {/* Without Sharli */}
              <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                  {t('balances.explainer_without_title')}
                </p>
                <div className="space-y-1.5">
                  <TransferRow
                    from={<Avatar {...CLARA} size="sm" />}
                    to={<Avatar {...ANNA} size="sm" />}
                    amount="20 €"
                  />
                  <TransferRow
                    from={<Avatar {...CLARA} size="sm" />}
                    to={<Avatar {...BEN} size="sm" />}
                    amount="10 €"
                  />
                  <TransferRow
                    from={<Avatar {...BEN} size="sm" />}
                    to={<Avatar {...ANNA} size="sm" />}
                    amount="10 €"
                  />
                </div>
                <p className="mt-2.5 text-[11px] text-muted-foreground">
                  {t('balances.explainer_without_count')}
                </p>
              </div>

              {/* With Sharli */}
              <div className="rounded-lg border border-[#1D9E75] bg-background px-3 py-2.5">
                <p className="mb-2 text-[11px] font-medium text-[#0F6E56]">
                  {t('balances.explainer_with_title')}
                </p>
                <div className="space-y-1.5">
                  <TransferRow
                    from={<Avatar {...CLARA} size="sm" />}
                    to={<Avatar {...ANNA} size="sm" />}
                    amount="30 €"
                  />
                  {/* Spacer to align footer with the left column */}
                  <div className="h-[19px]" />
                  <div className="h-[19px]" />
                </div>
                <p className="mt-2.5 text-[11px] font-medium text-[#0F6E56]">
                  {t('balances.explainer_with_count')}
                </p>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p className="mt-4 text-center text-[12px] leading-relaxed text-muted-foreground">
            {t('balances.explainer_footer')}
          </p>
        </div>
      </div>
    </>
  );
}
