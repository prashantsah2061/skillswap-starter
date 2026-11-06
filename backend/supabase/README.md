# Database setup

This folder contains the versioned database schema and migrations. A committed
migration file is not proof it has been applied to your Supabase project. Check
the project's migration history before applying any of them.

Beginner path:
1. Use a separate Supabase development project.
2. Check whether the original public schema migration has already been applied.
   If not, review and apply `migrations/202609210001_initial_schema.sql` once.
3. Run `seed.sql` to add the canonical skill catalog (safe to repeat).
4. Check whether `account_profiles` exists. If not, review and apply
   `migrations/202610280001_private_account_profiles.sql` once.
5. Apply `migrations/20261106205430_matching_messaging.sql` to enable atomic,
   authenticated swipe decisions and reciprocal match creation.
6. Apply `migrations/20261106210208_session_scheduling.sql` to enable member-only
   session proposals and transitions.
7. Apply `migrations/20261106211146_user_safety_controls.sql` to enable blocking,
   user reports, and hidden-profile enforcement.
8. Inspect all public tables plus `account_profiles` in Table Editor, and
   confirm RLS is enabled. The skill catalog should show the seed entries.
   For a read-only SQL Editor summary of tables, policies, catalog entries, and
   RPC grants, run `verify_setup.sql`.
9. Create test users through Auth, then verify onboarding, discovery, swipes,
   matches, messages, and session transitions using two separate browser sessions.
10. Test isolation with a third non-member account; SQL Editor uses elevated
   privileges and is not a substitute for these user-session checks.

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

Direct swipe and match table writes remain blocked. The matching migration gives
authenticated users execute access to `record_swipe`, which derives the actor
from the verified database session and creates matches atomically. Do not loosen
table grants to bypass this function.

## Private account profiles (authentication review)

The additive `202610280001_private_account_profiles.sql` migration is independent of the original starter schema. Apply it once to enable the actual account profile/name flow. It creates a separate owner-only `account_profiles` table with no email or password columns, initializes names from the Auth user ID, preserves edited names, and checks live sessions and MFA in RLS. The old `profiles` table above remains a proposed member-directory schema and is not used for private account profile edits. See `docs/AUTHENTICATION-REVIEW.md` at the repository root for the required Auth settings and test status.
