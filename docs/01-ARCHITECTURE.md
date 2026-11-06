# SkillSwap architecture

The repository contains two independent Next.js applications managed with npm workspaces. The frontend proxies authenticated public-profile, skills, discovery, swipe, match, messaging, and session requests to the backend. Supabase Auth and private account profiles are handled by the frontend directly. The live-call room still uses local demo state.

## Responsibilities

| Folder | Responsibility |
| --- | --- |
| `frontend/src/app/` | Frontend pages and layouts |
| `frontend/src/components/` | Reusable UI and feature components |
| `frontend/src/lib/` | Supabase Auth/profile helpers, API proxies, and remaining demo fixtures |
| `frontend/public/` | Local images and static assets |
| `backend/src/app/api/` | Authenticated profile, skill, discovery, swipe, match, and message route handlers |
| `backend/src/app/auth/` | Existing email-confirmation route scaffold |
| `backend/src/services/` | Future business rules |
| `backend/src/models/` | Future data-access implementation |
| `backend/src/lib/` | Backend validators, authentication, and Supabase helpers |
| `backend/src/proxy.ts` | Preserved optional backend session-refresh proxy |
| `backend/supabase/` | Database migrations, seed data, and test plans |
| `shared/types/` | Common domain types and generated-database type placeholder |
| `docs/` | Architecture, setup, and capstone planning |
| `tests/` | Existing unit, integration, and end-to-end test plans |

Each application owns its package manifest, TypeScript config, and Next.js config. One root lockfile and npm workspace installation manage dependencies. Common lint settings and development tools live at the root.

`@/` imports resolve within the current application's `src/`. `@shared/` imports resolve to common types in `shared/types/`.

## Current demo behavior

The frontend runs on port 3000. Auth, private profiles, onboarding, discovery, matching, and messaging need Supabase configuration and database migrations. Remaining demo data lives in `frontend/src/lib/frontend-data.ts`; shared React state and validated localStorage restoration live in `frontend/src/components/demo/demo-provider.tsx`.

The backend runs separately on port 3002. Its `/api/health` endpoint reports process status without checking the database. Remaining unimplemented endpoints return HTTP 501. Backend Supabase configuration belongs in `backend/.env.local`.

## Future integration

The frontend communicates with fixed same-origin API routes, which forward requests to the backend and preserve session cookies. Both apps use request-scoped authenticated Supabase clients; RLS remains authoritative.

The swipe flow calls one transaction-safe RPC that makes the first decision immutable and creates one canonical match after reciprocal likes. Message reads and sends verify match membership and use stable cursor pagination. Session proposals and state transitions use a separate database function that verifies match membership and locks each session row.

## Conventions

Keep mock data out of UI components and server-only code out of `shared/` and the frontend. Use client components for browser state and events. Await Next.js dynamic page parameters. Never use a user's browser-supplied identifier as proof of backend authorization. Do not store passwords in demo state.

See the root README for current commands and `FRONTEND-DEMO.md` for the completed frontend behavior.
