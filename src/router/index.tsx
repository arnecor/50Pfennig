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

import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { lazy } from 'react';

import AppShell from '../components/layout/AppShell';
import GroupsPage from '../pages/GroupsPage';
import HomePage from '../pages/HomePage';
import { requireAuth, requireGuest } from './guards';

// ---------------------------------------------------------------------------
// Lazy page imports — each page becomes its own async chunk
// ---------------------------------------------------------------------------

const AccountPage = lazy(() => import('../pages/AccountPage'));
const BalancesPage = lazy(() => import('../pages/BalancesPage'));
const AddFriendEmailPage = lazy(() => import('../pages/AddFriendEmailPage'));
const AddFriendPage = lazy(() => import('../pages/AddFriendPage'));
const AddFriendQRPage = lazy(() => import('../pages/AddFriendQRPage'));
const AddFriendScanPage = lazy(() => import('../pages/AddFriendScanPage'));
const CheckEmailPage = lazy(() => import('../pages/CheckEmailPage'));
const CreateGroupPage = lazy(() => import('../pages/CreateGroupPage'));
const ExpenseDetailPage = lazy(() => import('../pages/ExpenseDetailPage'));
const ExpenseFormPage = lazy(() => import('../pages/ExpenseFormPage'));
const FriendDetailPage = lazy(() => import('../pages/FriendDetailPage'));
const FriendsPage = lazy(() => import('../pages/FriendsPage'));
const GroupDetailPage = lazy(() => import('../pages/GroupDetailPage'));
const GroupSettingsPage = lazy(() => import('../pages/GroupSettingsPage'));
const ImprintPage = lazy(() => import('../pages/ImprintPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const SettlementDetailPage = lazy(() => import('../pages/SettlementDetailPage'));
const SettlementsPage = lazy(() => import('../pages/SettlementsPage'));

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
  path: '/login',
  beforeLoad: requireGuest,
  component: LoginPage,
});

// Post-registration confirmation screen — no auth guard, shown before email is verified
const checkEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/check-email',
  component: CheckEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === 'string' ? search.email : undefined,
    type:
      search.type === 'magic_link' || search.type === 'signup'
        ? (search.type as 'magic_link' | 'signup')
        : undefined,
  }),
});

// ---------------------------------------------------------------------------
// Protected routes
// ---------------------------------------------------------------------------

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/home',
  beforeLoad: requireAuth,
  component: HomePage,
});

const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups',
  beforeLoad: requireAuth,
  component: GroupsPage,
});

// /groups/new must be declared before /groups/$groupId so the static segment
// wins over the dynamic param when the URL is exactly "/groups/new".
const groupCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/new',
  beforeLoad: requireAuth,
  component: CreateGroupPage,
});

const groupDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/$groupId',
  beforeLoad: requireAuth,
  component: GroupDetailPage,
});

// /groups/$groupId/settings must be declared before /groups/$groupId/settlements
// so that the static 'settings' segment wins over any potential ambiguity.
const groupSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/$groupId/settings',
  beforeLoad: requireAuth,
  component: GroupSettingsPage,
});

const balancesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/$groupId/balances',
  beforeLoad: requireAuth,
  component: BalancesPage,
});

// Edit route stays group-scoped (existing expenses already have a groupId).
const expenseEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/$groupId/expenses/$expenseId/edit',
  beforeLoad: requireAuth,
  component: ExpenseFormPage,
});

const settlementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/groups/$groupId/settlements',
  beforeLoad: requireAuth,
  component: SettlementsPage,
});

// New expense creation — no group required in the URL; group chosen inside form.
const expenseNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/new',
  beforeLoad: requireAuth,
  component: ExpenseFormPage,
  validateSearch: (search: Record<string, unknown>) => ({
    groupId: typeof search.groupId === 'string' ? search.groupId : undefined,
  }),
});

const expenseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/$expenseId',
  beforeLoad: requireAuth,
  component: ExpenseDetailPage,
});

const settlementDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settlements/$settlementId',
  beforeLoad: requireAuth,
  component: SettlementDetailPage,
});

const friendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends',
  beforeLoad: requireAuth,
  component: FriendsPage,
});

// /friends/add/* routes must be declared before /friends/$friendId so the
// static segments win over the dynamic param.
const addFriendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends/add',
  beforeLoad: requireAuth,
  component: AddFriendPage,
});

const addFriendQRRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends/add/qr',
  beforeLoad: requireAuth,
  component: AddFriendQRPage,
});

const addFriendScanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends/add/scan',
  beforeLoad: requireAuth,
  component: AddFriendScanPage,
});

const addFriendEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends/add/email',
  beforeLoad: requireAuth,
  component: AddFriendEmailPage,
});

const friendDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/friends/$friendId',
  beforeLoad: requireAuth,
  component: FriendDetailPage,
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  beforeLoad: requireAuth,
  component: AccountPage,
});

const imprintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account/imprint',
  beforeLoad: requireAuth,
  component: ImprintPage,
});

// ---------------------------------------------------------------------------
// Route tree + router instance
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  checkEmailRoute,
  groupsRoute,
  groupCreateRoute,
  groupDetailRoute,
  groupSettingsRoute,
  balancesRoute,
  expenseNewRoute,
  expenseDetailRoute,
  expenseEditRoute,
  settlementsRoute,
  settlementDetailRoute,
  friendsRoute,
  addFriendRoute,
  addFriendQRRoute,
  addFriendScanRoute,
  addFriendEmailRoute,
  friendDetailRoute,
  accountRoute,
  imprintRoute,
]);

export const router = createRouter({
  routeTree,
  // biome-ignore lint/style/noNonNullAssertion: TanStack Router context placeholder — overridden in App before use
  context: { queryClient: undefined! },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
