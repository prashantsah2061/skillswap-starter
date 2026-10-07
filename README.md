# SkillSwap

A responsive capstone frontend for exchanging skills, with a separate backend starter scaffold. The frontend uses fictional data, React state, and browser storage. No account, database, or real call setup is needed.

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
npm run dev
```

Open http://localhost:3000 and choose **Try demo**. `npm run dev` starts the frontend only.

To run the backend scaffold in another terminal:

```sh
npm run dev:backend
```

The backend uses http://localhost:3002. `/api/health` reports scaffold status; unfinished API endpoints return HTTP 501. The frontend does not call these endpoints. Optional Supabase settings belong in `backend/.env.local`; see `backend/.env.example`.

## Commands

| Command | Purpose |
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

Sign-in/sign-up demonstrations, six skill categories, searchable skill lists, partner discovery with swipes, predefined demo matches, local messaging, session scheduling, simulated session controls, and an editable profile. Non-sensitive preferences persist in localStorage. Passwords are never saved or submitted.

See [Frontend demo guide](docs/FRONTEND-DEMO.md) for routes, interactions, and verification. See [Architecture](docs/01-ARCHITECTURE.md) for the preserved backend integration plan.
