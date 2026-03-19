/**
 * components/shared/EnvBadge.tsx
 *
 * Displays the current environment and Supabase URL on-screen.
 * Controlled by the VITE_SHOW_ENV_BADGE feature flag — set to "true" to show.
 * Intended for local / dev environments only; never enable in production.
 */

const SHOW = import.meta.env.VITE_SHOW_ENV_BADGE === 'true';
const ENV = import.meta.env.VITE_APP_ENV ?? 'unknown';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '—';

const ENV_COLORS: Record<string, string> = {
  local: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  development: 'bg-blue-100 text-blue-800 border-blue-300',
  staging: 'bg-orange-100 text-orange-800 border-orange-300',
  production: 'bg-red-100 text-red-800 border-red-300',
};

const colorClass = ENV_COLORS[ENV] ?? 'bg-gray-100 text-gray-700 border-gray-300';

export function EnvBadge() {
  if (!SHOW) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-xs font-mono shadow-md ${colorClass}`}
    >
      <span className="font-semibold uppercase tracking-wide">{ENV}</span>
      <span className="opacity-75 max-w-[260px] truncate">{SUPABASE_URL}</span>
    </div>
  );
}
