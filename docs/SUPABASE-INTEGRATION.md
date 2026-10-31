# SkillSwap database integration

## What was inspected

The repository's original member migration was a scaffold; backend feature services/routes were unfinished. Discovery, matches, messages, sessions, Explore selections and profile skill lists depended on `frontend-data.ts` and local storage. Dashboard rendered Explore, and member viewing was a TODO. Those production dependencies and the old demo fixtures have been removed.

A read-only inspection on 2026-10-29 found only `public.account_profiles` in the connected project, with owner-only read/update policies and the two authentication functions. Supabase's migration history was empty, so the account migration appears to have been installed manually. No live migrations, seeds, users, or data were changed by this implementation.

## Migration order

Back up and test in an isolated Supabase project first. Do not reset any database. Each SQL file is transactional. Stop at the first error and inspect it; do not continue blindly. Do not re-run migrations that are already installed.

For a new, empty development project, apply these files once in this order through the SQL Editor (or `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>` with credentials supplied privately through the environment):

1. `backend/supabase/migrations/202609210001_initial_schema.sql`
2. `backend/supabase/migrations/202610280001_private_account_profiles.sql`
3. `backend/supabase/migrations/202610290001_community.sql`
4. `backend/supabase/migrations/202610290002_queries.sql`
5. `backend/supabase/migrations/202610290003_timestamps.sql`
6. `backend/supabase/migrations/202610290004_skill_changes.sql`
7. `backend/supabase/migrations/202610300001_member_identity.sql` (adds usernames, pictures, the `avatars` storage bucket and its policies, and profile completion rules; deletes nothing)

**For the inspected connected project:** the private account migration (step 2) is already present despite missing migration history. Apply step 1, skip step 2, then apply steps 3–7. Existing private profile values are retained and copied into newly created member rows. If the database has changed since inspection, compare the actual schema and policies before executing these instructions.

Do not use a blanket `db push` until manual installations have been reconciled with migration history using the installed CLI's documented migration-repair workflow. Otherwise it can attempt to recreate existing policies/tables. Do not edit the old migration files or drop existing tables to resolve history differences.

Once migrations succeed, separately run **only** `backend/supabase/catalog/skills.sql`. This repeatable catalog includes technology, languages, art, music, cooking, business, sports and everyday skills. Existing same-name skills receive a category without changing their IDs. `backend/supabase/seed.sql` was inspected: it contains eight catalog skills and no users. It is retained for historical compatibility; it is not needed after the broader catalog script. Neither seed runs automatically. There are no production demo users, matches or messages.

## Configuration

Copy `frontend/.env.example` to `frontend/.env.local` and replace placeholders locally:

- `NEXT_PUBLIC_SUPABASE_URL`: your project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_...`; never a secret or service-role key.
- `APP_ORIGIN`: `http://localhost:3000` for the default local frontend, or the exact HTTPS production origin without a trailing slash.

`npm run dev` serves the complete application, including its authenticated server API. The backend workspace is optional; it reuses the same server operations and has matching REST endpoints for development. If running it, configure its `.env.local` with the same project settings and `APP_ORIGIN=http://localhost:3002`, then run `npm run dev:backend`. Authentication is owned by the frontend's existing server actions and callbacks; the backend's old auth placeholders are not a second login system. Do not enable cross-origin credential sharing between separate production services.

Render continues to use the existing root build/start commands in `render.yaml`. Set the same public URL/key and `APP_ORIGIN` in Render's environment. `RENDER_EXTERNAL_URL` remains supported by the existing origin code. No additional secret is required. Public Next.js settings must be set at build time. Nothing has been deployed.

In Supabase:

- Enable the Data API for `public`, including the new tables/functions. Migrations explicitly grant only the necessary authenticated access.
- Keep email confirmation and Google OAuth configured as described in `docs/AUTHENTICATION-REVIEW.md`; allow the frontend's `/auth/callback` and `/auth/confirm` URLs for each development/production origin.
- Do not expose the `private` or `auth` schema through the Data API.
- No Realtime publication or dashboard setting is required. Existing authentication stores tokens in HttpOnly cookies, so chat uses authenticated server polling every five seconds, plus focus/online reconciliation. Browser tokens are not introduced. The subscription-cleanup concern is avoided because there are no Realtime subscriptions.

## Data and security behavior

`account_profiles` is private and authoritative for display name, city and bio. A non-callable trigger in `private` synchronizes these fields to `profiles` in the same transaction, including edits through the older private profile action/API. Existing account fields win during migration backfill. `ensure_my_account_profile()` is idempotent, creates a missing member row and initializes new names from display/full/name metadata without copying email addresses. Existing edited names are preserved. Profiles begin invisible and incomplete. A profile is complete with a name, a bio, one skill to teach and one to learn (a picture is optional; initials are the default). Only complete, visible members appear in Discover or can like others, and removing a required field removes them again. The visibility checkbox lets a complete member opt out.

The existing `account_session_allowed()` is retained unchanged: it requires a live Auth session, confirmed email, and AAL2 when an admin or a verified MFA factor requires it. All feature tables either have a restrictive policy using that function or a participant/owner policy that also invokes it. All mutation RPCs explicitly call it, derive the actor from `auth.uid()`, use an empty search path and qualified objects, and revoke PUBLIC/anon execution. Definer access is used only for the bounded synchronization and transaction workflows, not ordinary reads. The private trigger functions cannot be executed directly. No service-role client is used.

Only discovery fields are returned from member queries. Other authenticated members may see completed, visible profiles; match participants retain access to each other's discovery fields after hiding a profile. Other private account fields, email, Auth metadata and Auth sessions are never joined into discovery responses.

Profile and skill replacement saves run as one transaction; a bad skill ID, level or duplicate rolls the entire save back. Individual catalog toggles use `set_my_skill`, serialize with profile saves, and do not overwrite profile text. User/skill/direction primary keys prevent duplicate selections; teaching and learning the same skill is allowed.

Discovery uses UUID cursors and pages of 24; skill, learning, category, city and name/bio search are applied in the database. It excludes self and anyone already liked, passed or matched. A saved member URL allows changing an earlier decision while the member is visible. Decisions use last committed value; changing a decision preserves an established match and conversation. Matches are created only by reciprocal likes, with both profile rows locked in canonical order before checking reciprocity. The ordered pair has both a CHECK and UNIQUE constraint. Clients have no direct match/swipe write grants.

Messages are immutable, reject whitespace-only content, are limited to 1–2000 trimmed characters, React-escaped, and limited to participants. UUIDs generated per send make retries idempotent. Conversation previews include latest time and unread count; opening a visible conversation records the last fetched message as the read cursor, so messages arriving after that fetch remain unread. History pages use `(created_at,id)` cursors. Older messages are loaded explicitly. Reconnection fetches all missing message pages through the previously seen cursor. Pending sends disable resubmission; failed sends retain their text and retry UUID. Polling is cleaned up on navigation. Conversations and sessions use bounded offset pages; under concurrent insertions those lists can shift, and refreshing reloads their first page.

Upcoming and history tabs are filtered and paginated in the database, with upcoming sessions ordered soonest first. Sessions store a match and proposer; participants are derived from the match, so they cannot diverge. Only the recipient accepts/declines pending proposals. Either participant can cancel pending/accepted sessions; either can complete an accepted session after its end time. Terminal statuses cannot reopen. Repeating an already-applied status is idempotent. Proposals must be in the future; durations are 1–480 minutes. Accepted intervals are half-open, so adjacent bookings are allowed. Acceptance locks the two participants in canonical order across all matches and rejects overlap for either participant. Timestamps use `timestamptz`, inputs are converted from local time to UTC, and displays use the viewer's local timezone. Optional meeting links must use HTTPS. No video service is installed; the old simulated video room and its undelivered local chat were replaced with real session details, actions, meeting links and a link to persistent match chat.

Auth-user deletion cascades through the member's profile, selections, decisions, matches, conversation messages/read markers and sessions. Deleting a match removes its conversation and bookings. Skills referenced by selections cascade those selections if removed by an administrator; categories cannot be deleted while skills reference them. There is no application account-deletion or message-edit/delete feature.

## API

The shared implementation lives in `shared/server/community.ts` and is mounted at `/api/community` in both workspaces. The production frontend calls its own same-origin endpoint. Every request verifies Auth, confirmation, MFA and the live session gate; mutations also verify Origin. Responses are private/no-store and failures never produce sample data.

GET operations: `state`, `skills`, `user-skills`, `me`, `member&id=UUID`, `discover` (optional `after`, `search`, `city`, `skill`, `learning`, `category`), `conversations&offset=0`, `conversation&match=UUID`, `messages&match=UUID` (older pages add `before=ISO_TIMESTAMP&cursor=UUID`), `sessions&offset=0&history=false`, `session&id=UUID`.

POST JSON operations:

- `profile`: `name`, `city`, `bio`, `visible`, `selections: [{skill_id,direction,level}]`.
- `selection`: `skill`, `direction`, optional `level` and `remove`.
- `swipe`: `target`, `decision` (`like` or `pass`). Returns `{data: matchIdOrNull}`.
- `send`: `match`, retry-stable `id`, `body`.
- `read`: `match`, `message` (last fetched message UUID).
- `propose`: retry-stable `id`, `match`, `topic`, `start` (ISO with timezone), `duration`, `notes`, `url`.
- `transition`: `id`, `status`.

Mutations return `{data: ...}` or `{error: message}`. Actor/owner/sender IDs supplied by callers are never used. REST aliases for profiles, skills, user-skills, discover, swipes, matches, messages and session listing route to the same implementation. Their payload fields are the ones above (not the old proposed placeholder contract). POST/DELETE `/api/user-skills` add/remove individual selections; PATCH `/api/profiles/me` saves the atomic profile/selection payload.

## Verification and remaining checks

Run `npm run lint`, `npm run typecheck`, `npm run test:auth`, and `npm run build` from the repository root. The database test runs all migrations and the repeatable catalog twice in isolated PGlite PostgreSQL with three synthetic accounts and Auth/session fixtures. It tests SQL execution, privacy, mutation grants, atomic rollback, duplicate selection prevention, self-like denial, one-sided/mutual likes, match retries, message idempotency/authorization, unread markers, session permissions/status/overlap, revocation, MFA and anonymous denial. These are local SQL tests, not live Supabase account tests. They do not prove multi-connection concurrency because PGlite serializes one connection.

After applying to an isolated Supabase project, use two browser accounts plus a third nonparticipant to verify persistence across refresh/devices, hidden/incomplete discovery, filter/pagination behavior, mutual matching, messages, reconnect recovery, session actions, and empty/error states. Run simultaneous reciprocal likes and overlapping booking acceptances with separate authenticated sessions; confirm a single match and only one accepted overlapping booking. Use member JWTs/HTTP requests, not the elevated SQL Editor, when checking RLS. Verify revoked sessions and MFA denial again in Supabase. Do not insert fictional users or run these tests against production.

The connected production project was only inspected read-only. Live browser flows and genuine concurrent transactions remain unverified until an isolated Supabase test environment with authenticated accounts is configured. Existing browser demo state is deliberately ignored rather than imported as real relationships.

### Checks run for this implementation

- `npm run lint`: passed.
- `npm run typecheck`: both workspaces passed.
- `npm run test:auth`: 18 tests passed, including the three-account PGlite database workflow and HTTP authorization tests.
- `npm run build:backend`: passed with Turbopack.
- `npm run build --workspace @skillswap/frontend -- --webpack`: passed.
- The standard `npm run build` frontend step could not complete in this environment: Turbopack's CSS worker tried to bind a port and received `Operation not permitted`, including on the escalation retry. The Webpack build above completed instead; the default build script has not been changed.
- `npm run test:community:live`: one test skipped because no local Supabase test URL/accounts were configured. The executable concurrency suite and exact local setup are in `tests/integration/README.md`. It rejects hosted project URLs, uses no administrator credentials, and does not reset data.
- `git diff --check`: passed.

The new message whitespace constraint is `NOT VALID` for historical rows, preserving any existing legacy content while enforcing it on every new write. No historical messages are deleted or rewritten. The SQL tests also verify migration backfill when private account and member profile text differ.

## Profile pictures

Uploads go through `POST /api/avatar`, which checks the file's actual bytes (JPEG, PNG, or WebP), enforces 5 MB, and writes to `avatars/<user id>/<random id>.<ext>` using the member's own session. `set_my_avatar` then records the path, only for a file that member owns. Storage policies let members add, read, and delete files only in their own folder. The bucket is public-read so pictures can be displayed by URL: file names are unguessable and cannot be listed, but anyone holding a URL can view that picture.

Google pictures are copied from account metadata on the first profile creation only, and only from `googleusercontent.com`, because that metadata is editable by its user. Removing a picture also stops a Google picture from returning at the next sign-in.

## Finding demo accounts

`backend/supabase/audit/find-demo-data.sql` is read-only. It lists accounts with placeholder email domains, demo-style addresses, exact names from the old demo data, or no sign-in yet, with the reason for each. A match is a reason to review, not proof that an account is fake. No deletion script is provided; review the results first.
