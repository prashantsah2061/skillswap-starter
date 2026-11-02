# Backend scaffold

This separate Next.js application preserves the starter's API routes, models, services, validators, authentication utilities, Supabase helpers, and database files. Moving these files does not implement backend features or connect the frontend.

From the repository root, run `npm ci`, then `npm run dev:backend`. The API runs at http://localhost:3002. Check `/api/health` for scaffold status. Authenticated public-profile, catalog, user-skill, and discovery APIs support the frontend's public onboarding and discovery screens; see [the API contract, private configuration, and live verification steps](../docs/DISCOVERY-API.md). Other unfinished feature endpoints still return HTTP 501 after their authorization checks.

Optional Supabase credentials belong in this folder's `.env.local` using `.env.example` as a template. With no credentials, the preserved proxy skips session refresh.

`@/` resolves to `backend/src/`; `@shared/` resolves to `../shared/types/`. Future frontend integration will need an explicit API URL and an appropriate authentication/CORS strategy; neither is implemented here.

## Supabase SSR clients

Experimental related-skill discovery is disabled by default. See
[semantic matching](../docs/SEMANTIC-MATCHING.md) for the feature flag, private
provider/evaluation setup, bounded requests, fallback, and ranking pagination.

- Browser components: import `createClient` from `@/lib/supabase/client`.
- Server Components, Server Actions, and route handlers: await `createClient` from `@/lib/supabase/server`. A fresh client is created for each request.
- `src/proxy.ts` refreshes sessions with verified JWT claims and forwards refreshed cookies to both downstream handlers and the browser. Return its response intact to preserve cookies and cache headers.
- Protected handlers should call `getVerifiedUser` from `@/lib/auth/require-user`, reject a null user, and enforce resource permissions. This helper validates with Supabase Auth's `getUser`; do not authorize from `getSession` or browser-supplied user IDs.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `backend/.env.local`. The key must begin with `sb_publishable_`; secret and service-role keys must never use a `NEXT_PUBLIC_` variable. Server helpers are guarded by `server-only`. Never cache responses containing session cookies. Server Components cannot write cookies, so the proxy must remain enabled.

These helpers belong to the backend app. The separate frontend demo still uses local data; its forms do not yet authenticate against Supabase.
