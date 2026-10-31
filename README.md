# SkillSwap

A responsive skill-exchange application using Next.js and Supabase for authentication, private and discoverable profiles, skill selection, discovery, mutual matches, messages and scheduled sessions. Apply the migrations in the [integration guide](docs/SUPABASE-INTEGRATION.md) before using community features.

## Folder structure

```text
skillswap-starter/
├── frontend/            Next.js UI, authenticated server API, CSS, and images
│   ├── src/app/         Pages and layouts
│   ├── src/components/  Reusable UI and feature components
│   ├── src/lib/         Auth, profile and community helpers
│   └── public/          Images and other static assets
├── backend/             Optional Next.js API workspace
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

Open http://localhost:3000 and sign in or create an account. `npm run dev` starts the frontend only. Set up authentication using the [authentication guide](docs/AUTHENTICATION-REVIEW.md), then apply the community migrations and catalog in the [integration guide](docs/SUPABASE-INTEGRATION.md).

To run the backend scaffold in another terminal:

```sh
npm run dev:backend
```

The backend uses http://localhost:3002 and reuses the shared community API. The frontend calls its own same-origin API and does not require a separate backend service. Optional backend settings belong in `backend/.env.local`. Authentication remains in the frontend server actions; old backend auth endpoints remain unused placeholders.

## Commands

| Command | Purpose |1
| --- | --- |
| `npm run dev` | Start the frontend on port 3000 |
| `npm run dev:backend` | Start the backend scaffold on port 3002 |
| `npm run lint` | Lint frontend, backend, and shared types |
| `npm run typecheck` | Type-check both applications |
| `npm run build` | Build both applications |
| `npm run build:frontend` | Build the frontend only |
| `npm run build:backend` | Build the backend only |
| `npm start` | Serve the built frontend |
| `npm run start:backend` | Serve the built backend on port 3002 |

## Frontend features

Real Supabase email/password and Google authentication, verified password recovery, MFA, private editable profiles, and an illustrated multi-field skill community on the login page. Discovery, matching, messaging, skill selections, dashboard counts and session bookings use the authenticated member’s database records. Passwords are managed by Supabase Auth and are never stored in application tables or browser preferences.

See [Supabase integration](docs/SUPABASE-INTEGRATION.md) for current routes, security rules, migration order and verification. The old frontend demo guide documents the previous prototype.

## Host on Render

Use a **Node web service** from the repository root. The included `render.yaml` contains no credentials. Follow [the Render deployment guide](docs/RENDER-DEPLOYMENT.md) to set build/start commands and enter your environment values privately in Render.

Database-backed profiles, skills, discovery, matches, chat and scheduling: see [Supabase integration and migration handoff](docs/SUPABASE-INTEGRATION.md). Apply the documented migrations before using the community screens; no migrations or seeds run automatically.
f