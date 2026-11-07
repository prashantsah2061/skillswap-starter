# Public onboarding and authenticated discovery

`/onboarding` explicitly saves a public profile, skill catalog selections, self-
reported skill levels, optional target levels, and optional meeting preference.
`/discover` uses persisted data and ranks reciprocal exact skill swaps above
one-way recommendations. The API route uses the explainable catalog-ID matcher.
The separate experimental semantic matcher is not called by discovery. Availability
is not represented by the current schema and is not inferred.

## API contract

All endpoints require a confirmed Supabase user, preserve existing MFA/admin MFA
requirements, and use a request-scoped authenticated client. The browser uses
same-origin frontend paths; the server forwards cookies to fixed backend paths.
Bearer authentication is not implemented. No caller-supplied owner ID is accepted.

| Frontend path | Backend path | Methods |
| --- | --- | --- |
| `/api/public-profile` | `/api/profiles/me` | GET own public profile/null; PATCH create/update explicit public fields; POST publish after saving skills |
| `/api/skills` | `/api/skills` | GET full visible canonical catalog |
| `/api/user-skills` | `/api/user-skills` | GET own listings; POST add; DELETE remove |
| `/api/discover` | `/api/discover` | GET reciprocal and one-way recommendations |
| `/api/swipes` | `/api/swipes` | GET pending outgoing interests; POST like/pass |

Public-profile PATCH accepts only `display_name`, `bio`, and nullable
`meeting_preference` (`online`, `in_person`, or `either`). The name is trimmed
and must have 2–80 Unicode characters; bio is trimmed and at most 500. The server
inserts a missing own profile or updates only granted public columns, never its
immutable ID. No city, private account data, avatar, or Auth metadata is copied.
The onboarding flow publishes the profile only after at least one teach skill and
one learn skill have been saved. Publication is enforced by the authenticated
`publish_my_public_profile` database function.

User-skills POST accepts canonical `skill_id`, `direction`, current `level`, and
nullable `goal_level`; DELETE accepts the skill and direction. Level values are
self-reported, not verified qualifications. `goal_level` applies to a learned
skill and remains unknown when omitted. Writes are restricted to the authenticated
owner and catalog. Mutation bodies are streamed with an 8 KiB limit at both
layers, with Origin checks at both layers.

Success is `{ "data": ... }`: a profile, catalog array (`id,name`), own listing
array (`skill_id,direction,level,goal_level`), pending interests, or changed
selection. All responses, including errors, are private/no-store.

Discovery accepts optional `limit` (default 20, integer 1–50 without leading
zeroes), opaque `cursor`, `skill` (catalog UUID the user wants to learn), `mode`
(`online` or `in_person`), and `include_skipped=true`. Unknown/duplicate
parameters, changed filters during pagination, and another user's cursors return
400. The actor and skills come from the session and persisted listings.

Shared types: `shared/types/discovery.ts`.

```ts
type Skill = { id: string; name: string };
type DiscoverResponse = {
  data: Array<{
    id: string; display_name: string; bio: string;
    recommendation_type: "reciprocal" | "one_way";
    recommendation_reason: string;
    teaches: Skill[]; learns: Skill[];
    compatibility: { you_can_learn: Skill[]; you_can_teach: Skill[] };
  }>;
  meta: {
    next_cursor: string | null;
    reason: "PROFILE_REQUIRED" | "SKILLS_REQUIRED" | null;
  };
};
```

Reciprocal recommendations require both intersections: caller learns ∩ candidate
teaches, and caller teaches ∩ candidate learns. If there are too few, one-way
recommendations use only the exact supported intersection and are labeled
separately. Skill identity comes from stable catalog UUIDs; labels are never
case-normalized to guess equivalence. Filtered candidates must match the chosen
skill and meeting mode; `either` matches either mode, while missing mode remains
unknown and is excluded by an explicit mode filter.

Exclude self, blocked users in either direction, hidden/unpublished/incomplete or
suspended profiles, prior interests, and confirmed matches. Passes leave the
normal queue and may be revisited using the explicit revisit action. A revisited
pass can be upgraded to a like; repeat likes are idempotent. Pending interests are
shown separately until mutual interest creates a match. Missing public profile or
either skill direction returns 200 with the relevant onboarding reason.

Errors use `{ "error": { "code": "...", "message": "..." } }`:

| HTTP | Code / meaning |
| --- | --- |
| 400 | VALIDATION_ERROR: query/body/cursor or unknown catalog selection |
| 401 | UNAUTHORIZED: missing/invalid/unconfirmed session |
| 403 | MFA_REQUIRED or FORBIDDEN: incomplete MFA or invalid mutation Origin |
| 409 | PROFILE_REQUIRED: create public profile before adding skills |
| 413 | REQUEST_TOO_LARGE: body exceeds 8 KiB |
| 429 | RATE_LIMITED: Auth provider throttling |
| 503 | DISCOVERY_UNAVAILABLE: config/schema/permission/provider/transport failure |
| 500 | INTERNAL_ERROR: unexpected discovery application failure |

No raw database/provider errors are exposed or logged by these handlers. Backend
proxy refresh/config exceptions for these API paths receive the same 503 envelope.
Missing schema is never presented as missing onboarding.

## Pagination and matching boundaries

The service scans eligible profile keyset batches, applies exclusions and filters,
then sorts before pagination. Ranking order is: reciprocal over one-way, greater
number of exact reciprocal skill overlaps, compatible preference over unknown
over a known conflict, then more teaching proficiencies that meet a stated learner
target level, then stable profile UUID. Unknown preference/goal levels are not
mismatches and do not earn a level-fit point. Availability is not stored, so it
contributes no score.
The cursor stores the last card's ranking tuple and filters and is bound to the
authenticated actor, so removing already-shown cards after a swipe does not shift
the next-page boundary. Restart discovery after changing skills or filters.
Candidate ranking is
bounded to the first 5,000 visible profiles; catalog UUIDs are stable skill keys.

Cursors are versioned, actor-bound base64url JSON. They are not signed
authorization capabilities: altered offsets cannot bypass RLS. Requests are not
snapshots; concurrent edits can change ordering. Restart pagination after skill,
swipe, or profile edits. Sparse matches can require many reads.

Pure matching/explanation logic is separate from HTTP, data access, and service
orchestration in `backend/src/lib/discovery/matching.ts`. Semantic matching can be
added independently; changing ordering requires a new cursor version and tests.

## Schema, RLS, and public/private separation

The additive migration 20261107000100_discovery_ranking_and_visibility.sql adds
nullable meeting preference, suspension state, and learner target level, removes
an old broad active_session policy if present, and narrows profile, skill, match,
and message reads to authorized visible data. It preserves existing rows and RLS:

- Authenticated SELECT grants and USING(true) policies allow public profiles,
  catalog, and listing reads. Anonymous users have no table grants.
- Profile insert/update policies require auth.uid()=id; UPDATE grants cover public
  fields, not id. Skill insert/delete policies require own user_id; updates cover
  self-reported skill/goal levels. The APIs use precisely these permitted operations.
- Swipe reads are actor-only and explicitly actor-filtered. Direct swipe/match
  writes remain blocked; the additive matching migration grants authenticated
  users only the `record_swipe` RPC. It derives the actor from `auth.uid()`, makes
  pass-to-like revisits, serializes both directions on the canonical pair, and
  inserts one match after mutual likes. Pair uniqueness and conflict handling make
  retries safe.
- Match reads are member-only. Message reads/inserts are restricted to match
  members; the API checks membership before paginated reads or sends.
- Blocked users are excluded in both directions from public profile/listing reads,
  discovery, matches, messages, and sessions. Direct swipe/match/message/session
  RPC calls also check the block relationship.
- Database-backed quotas limit swipes to 60/minute, messages to 20/minute,
  session state changes to 10/day, and reports to 5/day. Supabase Auth provider
  rate limits and CAPTCHA settings still require dashboard configuration.
- Hidden/suspended/unpublished profiles are excluded from discovery. No
  service-role client is used to bypass RLS.

Private account_profiles uses user_id, includes city, and accepts 1–80 character
names. Public profiles uses id, excludes city, and requires 2–80 character names.
The private initializer creates no public rows. Public onboarding loads only an
existing public row and otherwise starts blank. The save button explicitly
publishes the chosen name/bio/skills to signed-in members. Private edits remain
separate and are not synchronized automatically.

Browser demo names and fictional partner IDs are not migrated to catalog UUIDs.
Different labels (for example UI design and Graphic Design) are not assumed
equivalent. The team must configure its canonical catalog separately.

Saving involves separate authorized requests: save profile, add missing skills,
then remove obsolete skills. It is not atomic. The UI reports possible partial
saves, offers retry/reload, and never reports success prematurely. Retry reads
fresh persisted listings and reconciles the diff, then verifies the final set.
Concurrent edits may require reload. No transactional RPC is introduced silently.

## Same-origin proxy and refresh cookies

SKILLSWAP_BACKEND_URL is server-only and must be an exact origin without a path,
credentials, or trailing slash. HTTP is allowed only on loopback; use HTTPS for
hosting. Only fixed routes are forwarded, with Cookie, validated mutation Origin,
Content-Type, method/body/query. Client Authorization/arbitrary upstream headers
are not forwarded. Fetch uses no-store, manual redirects and a 30-second timeout.
Redirects/non-JSON upstream failures become 503 rather than exposing backend HTML.

For the four proxied API paths, frontend/src/proxy.ts skips its own refresh.
The backend performs the sole refresh/verification, avoiding concurrent use of
the same refresh token. Other frontend pages/APIs keep their normal refresh.
The backend proxy forwards refreshed request cookies to its route and response
cookies to the frontend fetch. The frontend forwards every separate getSetCookie()
value, including chunks and deletions on error responses. It never comma-joins or
comma-splits cookies (Expires contains commas), and strips upstream Domain so
cookies apply to the frontend host. No competing frontend refresh cookie can
overwrite that backend refresh in the same proxied request.

Both backend SSR helpers enforce HttpOnly, SameSite=Lax, Secure on HTTPS/production,
and the frontend's skillswap-remember=0 session-only policy. Session-only refresh
removes persistent expiry, while deletion cookies and persistent-login expiry
remain intact. The proxy preserves these attributes and always returns
Cache-Control: private, no-store. Do not cache these endpoints at a CDN. Direct
browser cross-origin calls remain unsupported; no wildcard CORS is enabled.

## Exact private configuration and live testing

Local configuration and connectivity checks passed; private settings are not
committed. For a new checkout, create/edit local files privately in your editor,
preserving existing entries. Do not put credentials in chat or shell commands.
Use the agreed development project, never a service-role/secret key.

1. Obtain the development Supabase project URL and publishable key from the team.
   The key must use the accepted sb_publishable_ format.
2. Set these in frontend/.env.local:
   - NEXT_PUBLIC_SUPABASE_URL: development project URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: that project's publishable key
   - APP_ORIGIN=http://localhost:3000
   - SKILLSWAP_BACKEND_URL=http://localhost:3002
3. Set these in backend/.env.local:
   - The same NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   - APP_ORIGIN=http://localhost:3000 (the allowed frontend mutation origin)
4. Ask the database owner to confirm the original public schema, catalog, grants,
   and RLS are installed in the development project. Also confirm the private
   account_profiles migration used by the current frontend layout. If anything
   is missing, the database owner must review/apply setup separately. This work
   has not applied migrations or seeded/changed the shared database.
5. Verify Supabase Site URL/redirect allowlist for the frontend origin and existing
   /auth/callback and /reset-password flows. Use confirmed existing development
   accounts, completing MFA when required. Do not change provider settings or
   create accounts implicitly during testing.
6. Restart both servers in separate terminals at the repository root:

```sh
npm run dev
```

```sh
npm run dev:backend
```

Keep frontend port 3000 available. If using a different origin, update APP_ORIGIN
in both apps and provider redirects consistently. Hosting requires exact HTTPS
origins and correctly preserved Secure/HttpOnly cookies.

7. As development user A, open /onboarding and explicitly save a public name/bio,
   Python to teach, and Guitar to learn. Reload to check persistence. In a separate
   browser profile, B saves reciprocal choices from the actual catalog. Verify
   they discover each other and unilateral overlap does not qualify.
8. Verify onboarding/empty states, signed-out/MFA denial, pagination with enough
   eligible saved users, and visible backend-unavailable errors. Inspect browser
   networking/storage privately for refresh chunk/deletion Set-Cookie headers,
   HttpOnly, and unchecked Remember me behavior. Never share token/cookie values.
   Check exclusions using existing development swipes; creating swipes remains
   unimplemented.

## Local evidence and limits

```sh
npm run test:discovery
npm run test:auth
npm run lint
npm run typecheck
npm run build
```

Integration tests execute production client -> frontend proxy -> backend API ->
model/service with mocked HTTP and Supabase. They cover two-user onboarding,
canonical selections, edits/deletes, spoofing, CSRF, partial-save retry, failure
states, cookies, auth/MFA and pagination. UI tests use mocked React hooks/effects
to exercise real callbacks and rendered states; they are not browser tests.
PGlite tests execute the actual migrations/RLS in disposable PostgreSQL and check
allowed owner writes, preserved levels, denied cross-user writes, immutable keys,
and anonymous denial. No shared database is used by these tests.

No hosted authenticated request with persisted team skill data or real browser
refresh flow has been verified. Live Supabase and browser checks above are still
required before calling the integration end-to-end complete.
