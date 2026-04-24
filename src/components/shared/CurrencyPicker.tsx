/**
 * components/shared/CurrencyPicker.tsx
 *
 * Reusable bottom sheet for currency selection.
 * Searchable list of ~30 curated currencies with flag, code, and name.
 */

import { cn } from '@/lib/utils';
import type { CurrencyCode } from '@domain/currency';
import { SUPPORTED_CURRENCIES, isSameCurrency } from '@domain/currency';
import { Check, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  onClose: () => void;
};

export default function CurrencyPicker({ value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return SUPPORTED_CURRENCIES;
    const q = search.trim().toLowerCase();
    return SUPPORTED_CURRENCIES.filter(
      (c) =>
        (c.code as string).toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} onKeyDown={undefined} />

      {/* Sheet */}
      <div className="relative flex flex-col bg-background rounded-t-2xl max-h-[80vh] animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold">{t('currency.picker_title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('currency.search_placeholder')}
              className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-[border-color,box-shadow]"
              autoFocus
            />
          </div>
        </div>

        {/* Currency list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t('currency.empty_search')}
            </p>
          ) : (
            filtered.map((c) => {
              const selected = isSameCurrency(c.code, value);
              return (
                <button
                  key={c.code as string}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    onClose();
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors',
                    selected
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'hover:bg-muted/50 text-foreground',
                  )}
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="font-semibold w-12">{c.code as string}</span>
                  <span className="flex-1 text-left truncate text-muted-foreground">{c.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })
          )}
          <div className="pb-safe" />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline button that shows the current currency and opens the picker on tap.
 */
export function CurrencyButton({
  currency,
  onClick,
  disabled,
  className,
}: {
  currency: CurrencyCode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const info = SUPPORTED_CURRENCIES.find((c) => isSameCurrency(c.code, currency));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg bg-muted/40 border border-border px-2.5 py-1 text-lg font-bold text-primary/60 flex items-center gap-1 transition-colors',
        disabled ? 'opacity-60 cursor-default' : 'hover:bg-muted/60',
        className,
      )}
    >
      {info?.flag} {info?.code as string}
    </button>
  );
}
