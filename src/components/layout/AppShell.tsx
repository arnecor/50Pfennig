import OfflineBanner from '@/components/OfflineBanner';
import GuestUpgradeDialog from '@/features/auth/components/GuestUpgradeDialog';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';
import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { Home, Settings, UserPlus, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const navItems = [
  { to: '/home', labelKey: 'nav.home', Icon: Home, prefix: '/home' },
  { to: '/groups', labelKey: 'nav.groups', Icon: Users, prefix: '/groups' },
  { to: '/friends', labelKey: 'nav.friends', Icon: UserPlus, prefix: '/friends' },
  { to: '/account', labelKey: 'nav.account', Icon: Settings, prefix: '/account' },
] as const;

export default function AppShell() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const guestReminderOpen = useUIStore((s) => s.guestReminderOpen);
  const setGuestReminderOpen = useUIStore((s) => s.setGuestReminderOpen);

  const showNav =
    pathname !== '/login' && pathname !== '/onboarding' && !pathname.startsWith('/auth/');

  // Preload all tab routes on mount so lazy chunks are ready before the user
  // taps. On Capacitor, defaultPreload:'intent' fires on mouseenter (not
  // touchstart), so we trigger it manually here and on touch below.
  useEffect(() => {
    for (const { to } of navItems) {
      router.preloadRoute({ to });
    }
  }, [router]);

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground safe-top">
      <OfflineBanner />
      <main className={cn('flex-1 overflow-auto', showNav && 'pb-16')}>
        <Outlet />
      </main>

      {guestReminderOpen && (
        <GuestUpgradeDialog variant="reminder" onDismiss={() => setGuestReminderOpen(false)} />
      )}

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
          <div className="flex items-center justify-around py-2">
            {navItems.map(({ to, labelKey, Icon, prefix }) => {
              const isActive = pathname.startsWith(prefix);
              return (
                <Link
                  key={to}
                  to={to}
                  onTouchStart={() => router.preloadRoute({ to })}
                  className={cn(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all',
                    isActive ? 'text-owed-to-you' : 'text-muted-foreground hover:text-foreground',
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
