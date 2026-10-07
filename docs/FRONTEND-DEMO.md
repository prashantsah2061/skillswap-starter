# SkillSwap frontend demo

Run with Node.js 22 or newer:

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and choose **Try demo**. No Supabase setup is needed. The frontend runs independently and does not load Supabase credentials. Optional Supabase configuration belongs to the backend workspace only.

## Screens

- `/login`, `/signup`, `/forgot-password`: validated demonstration forms; credentials are never saved or submitted. Sign-up and reset explicitly explain that no account or email is created.
- `/explore`: searchable six-category grid.
- `/explore/technical` (and the other category IDs): searchable skills, technical filters, add/remove learning list, and skill-filtered discovery links.
- `/discover?skill=Python`: partner stack with learning/teaching selectors, touch swipes, accessible Pass/Interested buttons, and predefined mutual-interest demonstration dialogs.
- `/matches`: locally stored demo matches.
- `/messages` and `/messages/maya`: local conversation history, sending, and session scheduling.
- `/sessions`: upcoming/past fixtures and scheduling with future-date validation.
- `/sessions/first`: simulated room with countdown, automatic halftime switch, manual role switch, visual microphone/camera controls, screen-preview toggle, local chat, and Leave navigation. Intervals are cleaned up on unmount.
- `/profile`: editable non-sensitive profile, placeholder photo selector, and teaching/learning skills.

Fixtures and frontend types live in `frontend/src/lib/frontend-data.ts`. Shared state lives in `frontend/src/components/demo/demo-provider.tsx`. Feature components live in `frontend/src/components/demo`; plain CSS stays in `frontend/src/app/globals.css`.

The state provider restores validated browser storage after hydration and persists preferences under `skillswap-demo-v1`. Clear that localStorage key to restore the fixtures. If storage is unavailable, state continues to work for the current visit. Session chat and reviewed discovery cards are temporary React state.

Portrait and category-art crops are local WebP assets extracted from the supplied design references. Full reference screenshots are never used as page backgrounds. Replace these demonstration assets before production.

Backend APIs, Supabase files, services, models, and migrations are preserved in the separate `backend/` workspace. The new frontend does not import services or call backend endpoints. There is no real login, delivery, matching, scheduling invitation, call, or device permission request.

Validation commands: `npm run lint`, `npm run typecheck`, `npm run build`.

## Verification completed

- ESLint, TypeScript, and production build pass.
- Desktop screenshots compared with the five provided layouts; mobile and tablet screenshots visually reviewed.
- Browser flows verified: Explore search, category filters, learning-list add/remove, predefined match dialog, local message sending, session scheduling, running countdown, microphone/camera/share controls, role switch, room chat, Leave navigation, and profile persistence after reload.
- Sign-up password-length validation, visibility toggle, and demo-only reset/sign-up messages checked.
- Keyboard Pass button, simulated touch swipes, and exhausted-profile empty state checked.
- All six category pages render; category grid has two columns at tablet width.
- Main screens checked for horizontal overflow at 320, 390, and 820 pixel widths; no browser runtime errors found in these flows.

Formatting and browser tools were installed temporarily outside the project. Project dependencies and lockfile were not changed.

## Workspace separation verification

The app now lives in `frontend/`; backend routes and server files live in the independent `backend/` application, and common types live in `shared/types/`. Root commands use npm workspaces. Both applications pass lint, type checks, and production builds after the move. The complete frontend interaction flow and mobile checks were rerun successfully against the separated frontend.

The separate backend's health endpoint returns HTTP 200 and scaffold status; its unfinished login endpoint still returns HTTP 501. `/api/health` returns HTTP 404 in the frontend, confirming that backend routes are separate. All 29 existing backend route/service/model/proxy/database files retain their original contents. Dependency versions remain unchanged; the lockfile now records the two workspace packages.
