# Deploy SkillSwap on Render

The frontend is a full Next.js Node web service. It includes Supabase Auth server actions, profile APIs, recovery, and MFA. A static site deployment will not support these features. The separate backend is still a scaffold and is not required to host the current frontend.

## Create the service

1. In Render, select **New → Web Service**, connect your GitHub repository, and select branch **main**. Alternatively, create a Blueprint from the repository's `render.yaml`.
2. Use **Node** runtime and leave **Root Directory empty** (the repository root). npm workspaces use the root `package-lock.json` and shared types.
3. Set **Build Command** to `npm ci --include=dev && npm run build:frontend`.
4. Set **Start Command** to `npm run start --workspace @skillswap/frontend -- --hostname 0.0.0.0 --port $PORT`.
5. Set **Health Check Path** to `/login`.
6. Use Node22 (`NODE_VERSION=22`) and `NODE_ENV=production`. A free service is selected in the Blueprint; review Render's current plan limits before deploying. No service or subscription is created by committing the Blueprint.

## Environment variables: Render dashboard only

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project's API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase `sb_publishable_...` key |
| `APP_ORIGIN` | The exact HTTPS Render service URL, such as `https://your-service.onrender.com`, with no trailing slash or path |

Copy the two Supabase settings from your local `frontend/.env.local` into Render's environment dashboard. Do not upload that file or commit its values. Copy APP_ORIGIN from the actual URL assigned to your Render service; do not guess the hostname. Set it before testing sign-in. With a custom domain, use that canonical HTTPS origin consistently.

NEXT_PUBLIC values are public connection settings, not administrative secrets. Never put Supabase secret/service-role keys, Google client secrets, SMTP credentials, or database passwords in NEXT_PUBLIC variables. Google OAuth client secrets and SMTP settings belong in Supabase's dashboard, not frontend code.

These NEXT_PUBLIC values must be configured **before the build**. If you change them, rebuild/redeploy. APP_ORIGIN is used by the server for origin/CSRF checks and redirect URLs; an incorrect value will block authentication. The Blueprint prompts for the three values and never stores them in git. The site also needs outbound HTTPS access to Supabase and to the Pwned Passwords range API for new-password safety checks.

## Supabase production setup

1. Set the Supabase **Site URL** to the same APP_ORIGIN.
2. Add exact allowed Redirect URLs: `https://your-service.onrender.com/auth/callback` and `https://your-service.onrender.com/reset-password`. Add the corresponding custom-domain URLs if used; avoid broad production wildcards.
3. Keep Google enabled. Its Google Cloud **authorized redirect URI** remains the Supabase project's `/auth/v1/callback`. Add your deployed frontend origin to Google's authorized JavaScript origins as appropriate.
4. Apply `backend/supabase/migrations/202610280001_private_account_profiles.sql` in Supabase SQL Editor to enable saved private profiles. It is an additive, standalone migration. Never disable RLS to make deployment work.
5. Keep email verification enabled. Configure SMTP, the recovery template, password-change notifications, the password policy and provider rate limits described in [AUTHENTICATION-REVIEW.md](AUTHENTICATION-REVIEW.md).
6. After deployment, test Google login, email verification/password login, recovery email delivery and completion, logout, MFA, and two-user profile isolation on the actual hosted domain. Local tests do not verify Render DNS, email delivery, private dashboard configuration, or a completed production sign-in.

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

No Render account, deployment, database migration, SMTP setting, or paid plan is changed by these commands.

Official references: [Next.js on Render](https://render.com/docs/deploy-nextjs-app), [monorepo support](https://render.com/docs/monorepo-support), [Blueprint environment variables](https://render.com/docs/blueprint-spec#setting-environment-variables).

### Automatic Render origin handling

The app also recognizes Render's automatically supplied `RENDER_EXTERNAL_URL`. A stale localhost APP_ORIGIN is ignored on Render, and the platform HTTPS URL remains an approved origin. Explicit APP_ORIGIN custom domains and the platform domain are both supported without trusting arbitrary Host/Origin headers. Next.js Server Actions allow only those exact configured hosts through a reverse proxy; there are no wildcard deployment hosts. Secure cookies/HSTS also recognize the Render HTTPS environment. Do not manually set RENDER_EXTERNAL_URL to an unrelated domain.

If Google initiation fails before opening Google, the page now reports a safe code: AUTH_ORIGIN for an origin configuration error, or AUTH_CONFIGURATION for unavailable Supabase/client configuration. These codes include no credentials. Supabase URLs/keys must still be set in Render before the build, and its redirect allowlist must include the actual production callback URL.
