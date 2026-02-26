/**
 * router/index.tsx
 *
 * TanStack Router route tree — the single definition of all app routes.
 *
 * Route structure:
 *   /login                                        → LoginPage
 *   /groups                                       → GroupsPage
 *   /groups/:groupId                              → GroupDetailPage
 *   /groups/:groupId/expenses/new                 → ExpenseFormPage (create)
 *   /groups/:groupId/expenses/:expenseId/edit     → ExpenseFormPage (edit)
 *   /groups/:groupId/settlements                  → SettlementsPage
 *
 * Features:
 *   - Route params are fully typed (no manual casting needed)
 *   - Route loaders prefetch via queryClient.ensureQueryData() for instant navigation
 *   - Auth guard redirects unauthenticated users to /login (see router/guards.tsx)
 *
 * See ADR-0008 for rationale on TanStack Router vs React Router.
 */

import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

import AppShell        from '../components/layout/AppShell';
import LoginPage       from '../pages/LoginPage';
import GroupsPage      from '../pages/GroupsPage';
import GroupDetailPage from '../pages/GroupDetailPage';
import ExpenseFormPage from '../pages/ExpenseFormPage';
import SettlementsPage from '../pages/SettlementsPage';
import { requireAuth, requireGuest } from './guards';

// ---------------------------------------------------------------------------
// Root route — AppShell is the layout for every route
// ---------------------------------------------------------------------------

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  // Redirect bare "/" to "/groups"
  beforeLoad: ({ location }) => {
    if (location.pathname === '/') throw redirect({ to: '/groups' });
  },
});

// ---------------------------------------------------------------------------
// /login — accessible only when NOT authenticated
// ---------------------------------------------------------------------------

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/login',
  beforeLoad:     requireGuest,
  component:      LoginPage,
});

// ---------------------------------------------------------------------------
// Protected routes — accessible only when authenticated
// ---------------------------------------------------------------------------

const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/groups',
  beforeLoad:     requireAuth,
  component:      GroupsPage,
});

const groupDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/groups/$groupId',
  beforeLoad:     requireAuth,
  component:      GroupDetailPage,
});

const expenseNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/groups/$groupId/expenses/new',
  beforeLoad:     requireAuth,
  component:      ExpenseFormPage,
});

const expenseEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/groups/$groupId/expenses/$expenseId/edit',
  beforeLoad:     requireAuth,
  component:      ExpenseFormPage,
});

const settlementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/groups/$groupId/settlements',
  beforeLoad:     requireAuth,
  component:      SettlementsPage,
});

// ---------------------------------------------------------------------------
// Route tree + router instance
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  loginRoute,
  groupsRoute,
  groupDetailRoute,
  expenseNewRoute,
  expenseEditRoute,
  settlementsRoute,
]);

export const router = createRouter({
  routeTree,
  context:       { queryClient: undefined! }, // provided at runtime via RouterProvider
  defaultPreload: 'intent',
});

// TypeScript module augmentation for fully-typed useNavigate, Link, etc.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
