/**
 * pages/LoginPage.tsx
 *
 * Route: /login
 *
 * Thin wrapper — renders the LoginForm feature component.
 * Guarded by GuestGuard: redirects to /groups if already authenticated.
 */

import LoginForm from '../features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <LoginForm />
    </div>
  );
}
