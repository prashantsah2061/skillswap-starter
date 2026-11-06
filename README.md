# SkillSwap

A responsive capstone app for exchanging skills, with separate frontend and backend workspaces. Supabase supports authentication, private account profiles, explicit public skill onboarding, reciprocal discovery, persistent swipes and mutual matches, match-only messaging, session scheduling, blocking, and reports. Live calls remain a demo feature.

## Folder structure

```text
skillswap-starter/
├── frontend/            Next.js UI, demo state, CSS, and static images
│   ├── src/app/         Pages and layouts
│   ├── src/components/  Reusable UI and feature components
│   ├── src/lib/         Frontend demo fixtures
│   └── public/          Images and other static assets
├── backend/             Separate Next.js API scaffold
│   ├── src/app/api/     API route handlers
│   ├── src/app/auth/    Email-confirmation route scaffold
│   ├── src/services/    Business-rule placeholders
│   ├── src/models/      Data-access placeholders
│   ├── src/lib/         Supabase helpers, validators, and auth utilities
│   └── supabase/        Migrations, seed data, and database test plans
├── shared/types/        Common domain types and database type placeholder
├── docs/                Architecture, frontend guide, and team documentation
├── tests/               Unit, integration, and end-to-end test plans
├── .github/             Repository collaboration templates
├── package.json         npm workspace commands and common development tools
└── package-lock.json    One dependency lockfile for both applications
```

Each application has its own `package.json`, `tsconfig.json`, and Next.js config. Shared lint settings and development tools live at the root. npm workspaces manage dependencies; run installation commands from the root.

## Run locally

Use Node.js 22 or newer:

```sh
git clone https://github.com/prashantsah2061/skillswap-starter.git
cd skillswap-starter
npm ci
# Copy frontend/.env.example to frontend/.env.local and fill in the settings.
npm run dev
```

Open http://localhost:3000 and sign in or create an account. `npm run dev` starts the frontend only. Set up Supabase and private profile storage using the [authentication guide](docs/AUTHENTICATION-REVIEW.md).

To run the backend scaffold in another terminal:

```sh
npm run dev:backend
```

The backend API runs at http://localhost:3002. `/api/health` reports process status but does not check the database. Public onboarding and discovery call authenticated backend APIs through same-origin frontend proxies. Configure both apps using [the discovery integration guide](docs/DISCOVERY-API.md), including the server-only backend URL and allowed frontend origin. Supabase settings belong in each app's `.env.local`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend on port 3000 |
| `npm run dev:backend` | Start the backend API on port 3002 |
| `npm run lint` | Lint frontend, backend, and shared types |
| `npm run typecheck` | Type-check both applications |
| `npm run test:discovery` | Test public onboarding, discovery, proxies, and isolated RLS |
| `npm run build` | Build both applications |
| `npm run build:frontend` | Build the frontend only |
| `npm run build:backend` | Build the backend only |
| `npm start` | Serve the built frontend |
| `npm run start:backend` | Serve the built backend on port 3002 |

## Frontend features

Real Supabase email/password and Google authentication, verified password recovery, MFA, private editable profiles, explicit public profiles with canonical teach/learn selections, authenticated reciprocal discovery, persistent swipe decisions and mutual matches, match-only messages, session scheduling, member blocking, reports, and database-backed action quotas. Live calls remain a fictional browser-based example. Apply the database migrations and seed catalog in `backend/supabase/` before using database-backed features. Passwords are managed by Supabase Auth and are never stored in application tables or browser preferences.

See [Frontend demo guide](docs/FRONTEND-DEMO.md) for routes, interactions, and verification. See [Architecture](docs/01-ARCHITECTURE.md) for the preserved backend integration plan.

An experimental [semantic skill matcher](docs/SEMANTIC-MATCHING.md) is available
behind a disabled-by-default backend flag. Exact canonical-ID discovery remains
the default/fallback; live provider evaluation is required before activation.

## Host on Render

Use the included Render Blueprint to deploy the frontend and matching API as two Node web services from the repository root. It contains no credentials. Follow [the Render deployment guide](docs/RENDER-DEPLOYMENT.md) to set the required environment values privately and verify the service wiring.
