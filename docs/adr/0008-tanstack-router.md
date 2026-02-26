# ADR-0008: TanStack Router over React Router

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

The app needs client-side routing for a multi-page React application running inside a Capacitor WebView. The two main options for React in 2025/2026 are React Router v6 and TanStack Router v1.

## Decision

Use **TanStack Router v1**.

Key reasons:
1. **Type-safe route parameters.** `params.groupId` is typed as `string` (not `string | undefined`) when accessed inside a route that declares it. React Router v6 requires manual casting (`useParams<{ groupId: string }>()`), which is a repeated source of runtime errors in a TypeScript codebase.
2. **First-class TanStack Query integration.** Route loaders can call `queryClient.ensureQueryData(...)` to prefetch data before the component renders, with full type inference. This eliminates loading spinners for most navigation transitions.
3. **No file-based routing required.** Code-based route definitions work well for a Capacitor app where routes are defined once and rarely change. File-based routing adds build tooling complexity with no benefit at this scale.

## Consequences

- **Positive:** Route params and search params are fully typed throughout the app. No runtime `undefined` checks needed for things that are guaranteed by the route definition.
- **Positive:** Loaders + TanStack Query prefetching gives near-instant navigation for data that was recently fetched.
- **Negative:** TanStack Router v1 is newer and has a smaller community and ecosystem than React Router. Documentation is good but thinner. This is an acceptable trade-off given the type-safety gains.
- **Negative:** The API surface is slightly more verbose than React Router for simple use cases. Worth it for the type safety on a growing codebase.
