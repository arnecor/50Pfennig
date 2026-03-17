import { cn } from '@/lib/utils';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Home, Settings, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const navItems = [
  { to: '/home', labelKey: 'nav.home', Icon: Home, prefix: '/home' },
  { to: '/groups', labelKey: 'nav.groups', Icon: Users, prefix: '/groups' },
  { to: '/friends', labelKey: 'nav.friends', Icon: UserPlus, prefix: '/friends' },
  { to: '/account', labelKey: 'nav.account', Icon: Settings, prefix: '/account' },
] as const;

export default function AppShell() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const showNav = pathname !== '/login' && !pathname.startsWith('/auth/');

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground safe-top">
      <main className={cn('flex-1 overflow-auto', showNav && 'pb-16')}>
        <Outlet />
      </main>

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
          <div className="flex items-center justify-around py-2">
            {navItems.map(({ to, labelKey, Icon, prefix }) => {
              const isActive = pathname.startsWith(prefix);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn('w-6 h-6 transition-transform', isActive && 'scale-110')}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={cn('text-xs font-medium', isActive && 'font-semibold')}>
                    {t(labelKey)}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
