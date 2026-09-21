# Understand the structure first

## Your technology stack

| Layer | Tool | Responsibility |
|---|---|---|
| Frontend | React inside Next.js | Screens, forms, cards, navigation |
| Backend | Next.js Route Handlers | Validate requests, check identity, run business logic |
| Database | Supabase Postgres | Persistent tables, relationships, constraints |
| Authentication | Supabase Auth | Accounts, passwords, sessions, email confirmation |
| Data access | Supabase JS client | Query Postgres through Supabase's API |
| Styling | CSS | Responsive page layout and appearance |

Supabase is more than a database: this design also uses its authentication.
You do not write password hashing or a custom JWT system for this project.

## Vocabulary with a SkillSwap example

- A **page** is a screen: `/discover` shows skill cards.
- A **component** is a reusable piece of a screen: `SkillCard`.
- A **route** is an address: `/api/swipes`.
- A **router** chooses the code for that address. Next.js builds it from folders.
- A **Route Handler** exports GET, POST, PATCH, or DELETE functions in route.ts.
- A **validator** checks external input before using it.
- A **service** contains a business rule, such as mutual interest creates a match.
- A **model** in this starter wraps database queries. It is not a Mongoose class.
- A **type** describes a data shape to TypeScript; it does not create a database table.
- A **migration** is versioned SQL that creates/changes actual tables and permissions.
- **Authentication** asks who is signed in.
- **Authorization** asks whether that person may read/change this data.
- **RLS** applies row permissions inside Postgres, even if someone bypasses the UI.

## How one request will work

1. A user clicks Interested on a card in a client component.
2. The component sends POST /api/swipes with target_id and decision.
3. The handler verifies the session using the server Supabase client.
4. It parses and validates JSON; the actor ID comes from the verified session.
5. A service rejects self-swipes and calls the matching database function.
6. The database records interest and creates a match if the other person liked back.
7. The endpoint returns a consistent JSON result.
8. The component shows the next card or a match notification.

Server Components may call services directly for reads; they need not fetch their
own application's API over HTTP. Browser mutations use Route Handlers in this
starter so your team has a clear, consistent learning path.

## Folder conventions

| Path | Meaning |
|---|---|
| src/app/page.tsx | Homepage at / |
| src/app/layout.tsx | Shared HTML/body wrapper |
| src/app/(auth) | Grouping folder, absent from URLs |
| src/app/(app) | Main feature screens; grouping does NOT enforce auth |
| src/app/api | HTTP API endpoints |
| src/app/auth/confirm | Email-confirmation handler location |
| src/components | Reusable UI grouped by feature |
| src/lib/supabase | Client setup and cookie refresh |
| src/lib/auth | Verified-user helper |
| src/lib/validators | Zod schemas |
| src/services | Business rules |
| src/models | Database query wrappers |
| src/types | TypeScript types |
| src/hooks | Reusable interactive client behavior |
| supabase/migrations | Versioned SQL |
| supabase/seed.sql | Development skill catalog |
| tests | Planned automated tests |
| public | Static files accessible from the website |

`[userId]` and `[matchId]` represent dynamic URL segments. In this Next.js version,
page params are awaited. `(app)` and `(auth)` do not appear in URLs.

Use `use client` only for components that need state, event handlers or browser
APIs. Keep database services server-only. Never import a server model into a
client component. Components can import shared types without database access.

Begin with one working feature across every layer. Avoid creating generic
repository factories or adding an ORM until you have a clear need.
