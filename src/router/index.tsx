/**
 * router/index.tsx
 *
 * TanStack Router route tree — the single definition of all app routes.
 *
 * Route structure:
 *   /login                                    → LoginPage
 *   /home                                     → HomePage
 *   /groups                                   → GroupsPage
 *   /groups/:groupId                          → GroupDetailPage
 *   /groups/:groupId/expenses/:expenseId/edit → ExpenseFormPage (edit, future)
 *   /groups/:groupId/settlements              → SettlementsPage
 *   /expenses/new                             → ExpenseFormPage (create)
 *   /friends                                  → FriendsPage
 *   /account                                  → AccountPage
 *
 * Notable changes from previous version:
 *   - /expenses/new replaces /groups/:groupId/expenses/new (expense creation
 *     is no longer group-scoped; the group is chosen inside the form)
 *   - /expenses/new accepts an optional ?groupId search param to pre-select a group
 *   - /balances removed; replaced by /friends
 *
 * See ADR-0011 for rationale.
 */

import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

import AppShell        from '../components/layout/AppShell';
import HomePage        from '../pages/HomePage';
import LoginPage       from '../pages/LoginPage';
import GroupsPage      from '../pages/GroupsPage';
import GroupDetailPage from '../pages/GroupDetailPage';
import ExpenseFormPage from '../pages/ExpenseFormPage';
import SettlementsPage from '../pages/SettlementsPage';
import FriendsPage     from '../pages/FriendsPage';
import AccountPage     from '../pages/AccountPage';
import { requireAuth, requireGuest } from './guards';

// ---------------------------------------------------------------------------
// Root route — AppShell is the layout for every route
// ---------------------------------------------------------------------------

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  beforeLoad: ({ location }) => {
    if (location.pathname === '/') throw redirect({ to: '/home' });
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
// Protected routes
// ---------------------------------------------------------------------------

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/home',
  beforeLoad:     requireAuth,
  component:      HomePage,
});

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

// Edit route stays group-scoped (existing expenses already have a groupId).
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

// New expense creation — no group required in the URL; group chosen inside form.
const expenseNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/expenses/new',
  beforeLoad:     requireAuth,
  component:      ExpenseFormPage,
  validateSearch: (search: Record<string, unknown>) => ({
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
  }),
});

const friendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/friends',
  beforeLoad:     requireAuth,
  component:      FriendsPage,
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           '/account',
  beforeLoad:     requireAuth,
  component:      AccountPage,
});

// ---------------------------------------------------------------------------
// Route tree + router instance
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  groupsRoute,
  groupDetailRoute,
  expenseNewRoute,
  expenseEditRoute,
  settlementsRoute,
  friendsRoute,
  accountRoute,
]);

export const router = createRouter({
  routeTree,
  context:        { queryClient: undefined! },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
