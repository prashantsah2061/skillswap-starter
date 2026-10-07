# SkillSwap architecture

The repository contains two independent Next.js applications managed with npm workspaces. The frontend uses local demo state. The backend remains the preserved starter scaffold and is not connected to the frontend.

## Responsibilities

| Folder | Responsibility |
| --- | --- |
| `frontend/src/app/` | Frontend pages and layouts |
| `frontend/src/components/` | Reusable UI and feature components |
| `frontend/src/lib/` | Fictional demo fixtures and frontend-only helpers |
| `frontend/public/` | Local images and static assets |
| `backend/src/app/api/` | Existing backend route handlers |
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

The frontend runs on port 3000 and requires no backend server or Supabase credentials. Mock data lives in `frontend/src/lib/frontend-data.ts`; shared React state and validated localStorage restoration live in `frontend/src/components/demo/demo-provider.tsx`.

The backend scaffold runs separately on port 3002. Its `/api/health` endpoint reports scaffold status without checking the database. Unimplemented feature endpoints return HTTP 501. Optional backend Supabase configuration belongs in `backend/.env.local`.

## Future integration

To connect real features later, configure a backend API URL for the frontend, implement authentication and endpoint authorization, and choose an appropriate CORS/cookie strategy for separate origins. The frontend should communicate with backend endpoints rather than importing backend models or services.

A future swipe flow would send a decision to the backend, validate the authenticated actor, execute a transactional reciprocal-match rule, and return a result to the frontend. Message persistence, invitations, and real sessions also remain future backend work.

## Conventions

Keep mock data out of UI components and server-only code out of `shared/` and the frontend. Use client components for browser state and events. Await Next.js dynamic page parameters. Never use a user's browser-supplied identifier as proof of backend authorization. Do not store passwords in demo state.

See the root README for current commands and `FRONTEND-DEMO.md` for the completed frontend behavior.
