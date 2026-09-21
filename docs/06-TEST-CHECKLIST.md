# Test checklist

## Starter checks
- npm run lint
- npm run typecheck
- npm run build
- Open the homepage and all navigation links.
- GET /api/health: 200, mode scaffold, databaseChecked false.
- Planned endpoints: 501, never fake success.

## Authentication, after implemented
- New account confirms email and reaches onboarding.
- Invalid credentials show a useful error without revealing account existence.
- A refresh preserves a valid session; logout removes it.
- Protected endpoints reject signed-out requests.
- Invalid/expired confirmation and recovery links fail safely.
- Mutation routes reject untrusted cross-site origins.

## Data authorization, after connected
Use user A, user B, and user C in separate browser profiles or test sessions.
Do not use an admin/service-role key to test ordinary user permissions.

- A edits A's profile; B cannot edit it through either Next.js or Supabase directly.
- Signed-out users cannot read profiles.
- A can add/remove only A's skill entries.
- A cannot read B's outgoing swipes.
- A cannot forge actor_id or sender_id.
- A cannot create arbitrary matches through a direct insert.
- A and B can read their shared conversation; C cannot read or send to it.
- Empty and overlong messages fail.

## Matching, after the RPC is implemented
- One like produces no match.
- Reciprocal likes produce exactly one match.
- Simultaneous likes still produce exactly one match.
- Retries never create duplicates.
- Self-swipes and invalid targets fail.
- Pass does not create a match.

## UX and integration
- Empty discovery/match/message lists have useful guidance.
- Pending buttons prevent accidental repeated submissions.
- Database/network errors never appear as successful saves.
- Keyboard navigation and mobile layouts work.
- Messages render as text, including strings containing HTML tags.
- Personalized responses and refreshed session cookies are not shared-cacheable.

Suggested future tooling: Vitest for pure logic/validators, Playwright for browser
flows, and Supabase/Postgres tests for RLS. Test directories are placeholders;
these frameworks and test suites are not installed in this scaffold.
