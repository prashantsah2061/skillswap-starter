# Database setup

This folder contains a proposed first schema, not an already provisioned database.
The migration has not been executed against your Supabase project.

Beginner path:
1. Create a separate Supabase development project.
2. Open the SQL Editor.
3. Paste the contents of migrations/202609210001_initial_schema.sql and run once.
4. Run seed.sql separately.
5. Inspect all six tables in Table Editor.
6. Confirm RLS is enabled for all six tables.
7. Create test users with Auth, then insert each user's own profile through an authenticated session.
8. Test permissions with those user sessions, not just SQL Editor (which has elevated privileges).

Team rule: keep every database change in a NEW timestamped migration file. Do not
silently modify an already applied migration. One person applies migrations to the
shared development project and records the filename and date in the team notes.

Optional CLI workflow, after the team learns migrations:
- Install the Supabase CLI using its official instructions.
- Run `npx supabase init` to create CLI config (not included here).
- Authenticate and link the intended development project.
- If a migration was applied manually, reconcile migration history before using db push.
- Never run reset against a shared environment without understanding what it deletes.

Profiles are visible to signed-in members. Store no email address, phone number,
password, or other private account fields in these public profile rows.
Auth manages credentials separately in auth.users.

Swipes and matches deliberately cannot be written by normal clients yet. Implement
and test the atomic matching function described in docs/04-BUILD-ORDER.md before
connecting the swipe buttons. Do not fix the restriction by granting broad writes.
