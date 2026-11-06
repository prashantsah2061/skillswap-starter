# Deploy SkillSwap on Render

SkillSwap uses two Next.js Node web services. The frontend serves the site and forwards authenticated profile, discovery, swipe, match, messaging, and session requests to the backend. Both services need the same Supabase URL and publishable key. The backend APIs require the signed-in Supabase session and enforce database RLS.

## Create the service

1. In Render, create a Blueprint from the repository's `render.yaml` (or create two Node web services using the commands below).
2. For both services, leave **Root Directory empty** (the repository root). npm workspaces use the root `package-lock.json` and shared types.
3. The frontend builds with `npm ci --include=dev && npm run build:frontend` and starts with `npm run start --workspace @skillswap/frontend -- --hostname 0.0.0.0 --port $PORT`.
4. The `skillswap-api` service builds with `npm ci --include=dev && npm run build:backend` and starts with `npm run start --workspace @skillswap/backend`. Its start script binds to Render's `PORT`.
5. The frontend health check is `/login`; the API health check is `/api/health`.
6. Both Blueprint services use Node 22 and the free web plan. Free web services can spin down while idle, so the first request after inactivity can be slow. Review Render's current plan limits before deploying. Committing the Blueprint alone does not create or update services.

## Environment variables: Render dashboard only

| Frontend variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project's API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase `sb_publishable_...` key |
| `APP_ORIGIN` | The exact HTTPS Render service URL, such as `https://your-service.onrender.com`, with no trailing slash or path |
| `SKILLSWAP_BACKEND_URL` | Automatically references the API service's `RENDER_EXTERNAL_URL` in the Blueprint |

Enter the same two Supabase values and exact `APP_ORIGIN` on both services in Render's environment dashboard. The Blueprint wires the frontend to the backend's HTTPS external URL. Never upload local `.env.local` files or commit their values. With a custom domain, use that canonical HTTPS origin consistently for `APP_ORIGIN` and Supabase redirects.

NEXT_PUBLIC values are public connection settings, not administrative secrets. Never put Supabase secret/service-role keys, Google client secrets, SMTP credentials, or database passwords in NEXT_PUBLIC variables. Google OAuth client secrets and SMTP settings belong in Supabase's dashboard, not frontend code.

These NEXT_PUBLIC values must be configured **before the build**. If you change them, rebuild/redeploy. `APP_ORIGIN` is used for origin/CSRF checks and redirect URLs; an incorrect value will block authentication and profile saves. `SKILLSWAP_BACKEND_URL` must point to the deployed API service, not localhost. The app also needs outbound HTTPS access to Supabase and to the Pwned Passwords range API for new-password safety checks.

## Supabase production setup

1. Set the Supabase **Site URL** to the same APP_ORIGIN.
2. Add exact allowed Redirect URLs: `https://your-service.onrender.com/auth/callback` and `https://your-service.onrender.com/reset-password`. Add the corresponding custom-domain URLs if used; avoid broad production wildcards.
3. Keep Google enabled. Its Google Cloud **authorized redirect URI** remains the Supabase project's `/auth/v1/callback`. Add your deployed frontend origin to Google's authorized JavaScript origins as appropriate.
4. Apply the ordered migrations in `backend/supabase/migrations/` to the Supabase project. Never disable RLS to make deployment work.
5. Keep email verification enabled. Configure SMTP, the recovery template, password-change notifications, the password policy and provider rate limits described in [AUTHENTICATION-REVIEW.md](AUTHENTICATION-REVIEW.md).
6. After deployment, test Google login, email verification/password login, recovery email delivery and completion, logout, MFA, and two-user profile discovery, matching, and messaging on the actual hosted domain. Local tests do not verify Render DNS, email delivery, private dashboard configuration, or a completed production sign-in.

Render uses HTTPS for its service URL. Keep the canonical URL consistent during a login/recovery flow. Configure any extra ingress/access-log tooling to redact auth queries, headers, cookies, and request bodies. The app disables Next development action-argument logging and does not log passwords or tokens.

## Files intentionally kept off GitHub

Real `.env`/`.env.local` files, private keys, local shell/R history, logs, local tool/editor configuration, node_modules, `.next` build output, and coverage output are excluded. `.env.example` files contain placeholders only. The repository contains application source, fictional sample data, original SVG illustrations, tests, SQL migrations, and deployment instructions—not production user data.

## Useful local checks

```sh
npm ci
npm run lint
npm run typecheck
npm run test:auth
npm run build:frontend
```

No Render account or deployment, Supabase migration, SMTP setting, or paid plan is changed by these commands.

Official references: [Next.js on Render](https://render.com/docs/deploy-nextjs-app), [monorepo support](https://render.com/docs/monorepo-support), [Blueprint environment variables](https://render.com/docs/blueprint-spec#setting-environment-variables).
