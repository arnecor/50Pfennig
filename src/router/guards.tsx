/**
 * router/guards.tsx
 *
 * Route guards — components and beforeLoad hooks that enforce auth state.
 *
 * AuthGuard:
 *   Wraps protected routes. Reads the Supabase session from authStore.
 *   If no session exists (and auth has hydrated), redirects to /login.
 *   Shows nothing (or a loading state) while auth is hydrating to avoid
 *   a flash of the login screen on app startup.
 *
 * GuestGuard:
 *   Wraps the /login route. If a session already exists, redirects to /groups.
 */

import { redirect } from '@tanstack/react-router';
import { useAuthStore } from '../features/auth/authStore';

/**
 * Use as `beforeLoad` on protected routes.
 * Redirects to /login if the user has no active session.
 * Auth must already be hydrated before this runs (App.tsx gates the router).
 */
export const requireAuth = () => {
  const { session } = useAuthStore.getState();
  if (!session) throw redirect({ to: '/login' });
};

/**
 * Use as `beforeLoad` on the /login route.
 * Redirects to /groups if the user is already signed in.
 */
export const requireGuest = () => {
  const { session } = useAuthStore.getState();
  if (session) throw redirect({ to: '/groups' });
};
