> Folder organization: the frontend and backend are separate npm workspaces. See the root README for current commands. Backend integration steps below describe future work; the frontend currently uses local demo state.

# Database and API contract

## Entities

| Table | Purpose | Key relationships |
|---|---|---|
| auth.users | Supabase-managed credentials | One account to one profile |
| profiles | Display name and bio | id references auth.users.id |
| skills | Shared catalog such as Python or Guitar | Referenced by user_skills |
| user_skills | What a person teaches or learns | User + skill + direction is unique |
| swipes | A person's like/pass decision | Actor and target are profiles; self-swipe prohibited |
| matches | A mutually interested pair | Canonically ordered unique user pair |
| messages | Messages inside a match | Sender profile and parent match |
| skill_sessions | Proposed or completed skill exchanges | Match participants and proposal state |
| user_blocks | Member blocks | Block owner and hidden target |
| user_reports | Moderation reports | Reporter, reported profile, optional match |

Using user_skills avoids comma-separated skill strings and lets you filter and join.
One person may teach Python and learn Guitar. The direction field separates those
relationships. Skill level is self-reported, not a verified qualification.

## Data access rules in the included migration

- Signed-out clients have no table access.
- Signed-in people can read member profiles, the skill catalog, and skill listings.
- People can create/edit only their own profile and skill listings.
- People can read only their own outgoing swipes.
- People can read only matches they belong to.
- People can read/send messages only in their matches; sender_id must be their own.
- People can read sessions in their matches; session state changes use the membership-checked RPC.
- People can block/unblock members; blocked pairs disappear from discovery, matches, messages, and sessions.
- Reports are private to the reporter and MFA-protected admins. Admins review them through the Supabase dashboard; this starter has no moderation UI.
- Direct swipe/match writes are blocked; authenticated swipe decisions use one atomic matching function.
- Only catalog maintainers via trusted administration add catalog skills in version 1.
- No message edit/delete or account-delete flow is included yet.

## Planned endpoints

Health, authenticated public profiles, catalog/user-skills, ranked discovery,
pending interests and swipes,
matches, messages, and session scheduling are implemented. Live video rooms remain
a demo feature. See [the discovery contract](DISCOVERY-API.md) for onboarding and
recommendations.

| Method | URL | Intended behavior |
|---|---|---|
| GET | /api/health | Working scaffold status; no database check |
| POST | /api/auth/signup | Validate credentials and call Supabase signUp |
| POST | /api/auth/login | Sign in and set session cookies |
| POST | /api/auth/logout | Sign out and clear session |
| POST | /api/auth/forgot-password | Send recovery link with generic response |
| GET | /auth/confirm | Verify email token and redirect to onboarding |
| GET | /api/profiles/me | Implemented: return own public profile or null before onboarding |
| PATCH | /api/profiles/me | Implemented: create/update own public profile with owner-scoped insert/update |
| GET | /api/profiles/[userId] | Read a member's display profile |
| GET | /api/skills | Implemented: read the visible canonical skill catalog |
| GET | /api/user-skills | Implemented: return own teaching/learning skills |
| POST | /api/user-skills | Implemented: add own catalog skill/direction idempotently |
| DELETE | /api/user-skills | Implemented: remove own skill/direction association |
| GET | /api/discover | Implemented: rank reciprocal and relevant one-way catalog-skill candidates before pagination; supports skill and meeting-mode filters |
| GET | /api/swipes | Implemented: list pending outgoing interests for the signed-in user |
| POST | /api/swipes | Implemented: persist interest/pass, upgrade an intentionally revisited pass, and possibly create one reciprocal match atomically; database limits 60 decisions per minute |
| GET | /api/matches | Implemented: list matches for the current user with partner profiles |
| GET | /api/matches/[matchId]/messages | Implemented: read a bounded, cursor-paginated page after membership check |
| POST | /api/matches/[matchId]/messages | Implemented: send as current user after membership and Origin checks; database limits 20 messages per minute |
| GET | /api/sessions | Implemented: list sessions belonging to the current user's matches |
| POST | /api/sessions | Implemented: propose, accept, reschedule, cancel, or complete a session through an authorized RPC; database limits 10 actions per day |
| POST | /api/blocks | Implemented: block or unblock a profile, hiding the pair from member features |
| POST | /api/reports | Implemented: submit a categorized report; database limits 5 per day |

Example planned POST /api/swipes request:

```json
{"target_id":"a-real-profile-uuid","decision":"like"}
```

Do NOT accept actor_id from that request. Resolve it from the verified session.
Likewise, the server decides sender_id and profile ownership for message/profile writes.

Standard response shapes:

```json
{"data":{"matched":false,"match":null}}
```

```json
{"error":{"code":"VALIDATION_ERROR","message":"Check your input."}}
```

Use 400 for malformed/invalid input, 401 for no verified session, 403 for denied
actions, 404 for missing/inaccessible resources, 409 for true conflicts, 429 for
rate limits, and 500 for unexpected failures. Do not return raw database errors or
credentials. Read endpoints that return user-specific data must not use shared caching.
Use same-origin requests and verify Origin on cookie-authenticated mutation routes;
configure the expected application origin rather than trusting arbitrary redirect input.

Validate UUIDs, bound page sizes (for example max 50), and use stable cursor ordering.
Messages should order by created_at plus id so equal timestamps do not break pagination.
