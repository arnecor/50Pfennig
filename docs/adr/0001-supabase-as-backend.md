# ADR-0001: Supabase as the Backend Platform

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

The app requires a backend that provides: persistent relational storage, user authentication (email + OAuth), real-time data sync across devices, and row-level access control. The team is a solo developer primarily experienced in Node.js/TypeScript.

Options considered:
- **Supabase** — Postgres + Auth + Realtime + RLS as a managed service
- **Firebase/Firestore** — Google BaaS, NoSQL, real-time built-in
- **Custom Node.js API + Postgres** — full control, full responsibility

## Decision

Use **Supabase** as the backend platform for V1.

The data model is inherently relational (users → groups → expenses → splits → settlements). A relational database with foreign keys and transactions is a natural fit. Supabase exposes Postgres directly, meaning data integrity can be enforced at the database level via constraints and transactions — not just at the application level.

Firebase/Firestore was rejected because its NoSQL document model is a poor fit for this relational domain. Modeling expenses with splits across multiple users in Firestore leads to denormalization, fan-out writes, and complex client-side joins.

A fully custom Node.js backend was rejected for V1 because it would require writing auth, session management, real-time subscriptions, and a REST layer from scratch — none of which is domain differentiation for this app.

## Consequences

- **Positive:** Auth, realtime, and REST/RPC are available immediately without custom code. Row-level security enforces authorization at the database layer, reducing the risk of data leaks from application logic bugs.
- **Positive:** Supabase is open source and self-hostable on standard Postgres — no proprietary lock-in.
- **Positive:** `supabase gen types typescript` provides compile-time safety against schema drift.
- **Negative:** New mental model for the developer: RLS policies are SQL predicates, not `if` statements in TypeScript. Requires learning.
- **Negative:** Complex business logic that needs to call external APIs (PayPal, currency rates) is awkward in Supabase Edge Functions (Deno runtime). This is acceptable for V1 because such integrations are explicitly out of scope.
- **Future:** When external service integrations are added (V2+), a Node.js API layer (e.g. Hono) will be added alongside Supabase. It will connect to the same Postgres database. No migration of Supabase is required — see ADR-0008 when created.
