# Backend scaffold

This separate Next.js application preserves the starter's API routes, models, services, validators, authentication utilities, Supabase helpers, and database files. Moving these files does not implement backend features or connect the frontend.

From the repository root, run `npm ci`, then `npm run dev:backend`. The API runs at http://localhost:3002. Check `/api/health` for scaffold status. Planned feature endpoints still return HTTP 501.

Optional Supabase credentials belong in this folder's `.env.local` using `.env.example` as a template. With no credentials, the preserved proxy skips session refresh.

`@/` resolves to `backend/src/`; `@shared/` resolves to `../shared/types/`. Future frontend integration will need an explicit API URL and an appropriate authentication/CORS strategy; neither is implemented here.
