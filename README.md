# SkillSwap — Next.js + Supabase starter

A beginner-oriented project structure for a five-person capstone team.
SkillSwap lets people showcase skills, discover complementary learners/teachers,
express interest, match when interest is mutual, and message their matches.

## Start here

1. Extract this ZIP. Open the `skillswap-starter` folder in VS Code.
2. Open Terminal → New Terminal. Confirm the terminal is in this folder.
3. Install Node.js 22 LTS if needed, then check `node -v` and `npm -v`.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open http://localhost:3000.
7. Click Discover, Matches, Messages, My profile, and Log in.
8. Stop the development server with Ctrl+C when finished.

No Supabase account is needed to preview the layout. Missing credentials leave
this scaffold in demo mode. The app never falls back to fake successful saves.

## What works now

- Next.js App Router project with TypeScript and simple CSS.
- Landing page, navigation, fictional discovery cards, and placeholder feature pages.
- Dynamic page examples for users and conversations.
- `GET /api/health` returns the scaffold's status (not database health).
- Supabase browser/server client helpers and optional session-refresh proxy.
- Input validation schemas, domain types, and a proposed SQL schema with RLS.

## What you must implement

Sign-up/login/logout, email confirmation, password recovery, protected pages,
profile saving, skill editing, database-backed discovery, atomic matching,
message persistence, and realtime subscriptions are NOT implemented.
Unfinished API routes return HTTP 501. Auth fields and swipe buttons are disabled.
Models and services contain implementation instructions, not working queries.
This is a starter folder, not a completed or production-ready application.

## Read these in order

1. `docs/01-ARCHITECTURE.md` — vocabulary, file roles, and request flow.
2. `docs/02-SETUP.md` — local setup, Supabase, environment variables, Git.
3. `docs/03-DATABASE-AND-API.md` — tables, permissions, endpoint contracts.
4. `docs/04-BUILD-ORDER.md` — step-by-step implementation milestones.
5. `docs/05-TEAM-PLAN.md` — ownership and team workflow.
6. `docs/06-TEST-CHECKLIST.md` — what to verify before each merge.
7. `docs/FILE-STRUCTURE.txt` — complete folder/file inventory.
8. `docs/VALIDATION.md` — checks performed on this delivered scaffold.

## Commands

| Command | Purpose |
|---|---|
| npm install | Download dependencies and create/update the dependency lockfile |
| npm run dev | Start local development server |
| npm run lint | Run ESLint |
| npm run typecheck | Check TypeScript |
| npm run build | Compile a production build |
| npm start | Run an existing production build |

Use one package manager: npm. Commit package-lock.json after your first successful
install if it is not included. All teammates should then use npm ci after pulling.

## Why there is no separate frontend/backend project

`src/app/**/page.tsx` files render screens. `src/app/api/**/route.ts` files expose
backend endpoints. Both belong to the same Next.js application. Next.js supplies
the router through folder naming; a separate Express server/router is unnecessary.

## Dependencies and references

This scaffold targets Next.js 16, React 19, TypeScript, Supabase JS/SSR, and Zod 4.
Plain CSS keeps the first setup small. Add Tailwind later only if the team wants it.

Official references checked during preparation:
- https://nextjs.org/docs/app/getting-started/installation
- https://nextjs.org/docs/app/getting-started/project-structure
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/database/postgres/row-level-security

Next.js 16 uses proxy.ts; older tutorials may use middleware.ts. Follow the docs
for the version in your installed lockfile. Do not combine old Auth Helpers with
this @supabase/ssr setup.
