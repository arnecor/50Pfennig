/**
 * components/layout/AppShell.tsx
 *
 * The root layout component — wraps all routes.
 *
 * Responsibilities:
 *   - Bottom navigation bar (Groups, Balances, Account)
 *   - Safe area insets for Android notch / gesture bar
 *     (CSS: env(safe-area-inset-bottom), env(safe-area-inset-top))
 *   - Renders <Outlet /> (TanStack Router) for the active route
 *
 * This is the component attached to the root route in router/index.tsx.
 * The bottom nav is hidden on /login.
 */

import { Outlet, Link, useRouterState } from '@tanstack/react-router';
import { Users, ArrowLeftRight, CircleUser } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const navItems = [
  { to: '/groups',   labelKey: 'nav.groups',   Icon: Users,           prefix: '/groups'   },
  { to: '/balances', labelKey: 'nav.balances',  Icon: ArrowLeftRight,  prefix: '/balances' },
  { to: '/account',  labelKey: 'nav.account',   Icon: CircleUser,      prefix: '/account'  },
] as const;

export default function AppShell() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const showNav = pathname !== '/login';

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground">
      <main className={`flex-1 overflow-auto${showNav ? ' pb-16' : ''}`}>
        <Outlet />
      </main>

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
          <div className="flex">
            {navItems.map(({ to, labelKey, Icon, prefix }) => {
              const isActive = pathname.startsWith(prefix);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{t(labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
