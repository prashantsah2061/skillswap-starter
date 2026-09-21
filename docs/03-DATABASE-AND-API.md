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
- Swipe/match inserts are blocked pending the atomic matching function.
- Only catalog maintainers via trusted administration add catalog skills in version 1.
- No message edit/delete or account-delete flow is included yet.

## Planned endpoints

All endpoints below except health are placeholders returning 501 in this delivery.
The table is the contract to implement, not a claim they already work.

| Method | URL | Intended behavior |
|---|---|---|
| GET | /api/health | Working scaffold status; no database check |
| POST | /api/auth/signup | Validate credentials and call Supabase signUp |
| POST | /api/auth/login | Sign in and set session cookies |
| POST | /api/auth/logout | Sign out and clear session |
| POST | /api/auth/forgot-password | Send recovery link with generic response |
| GET | /auth/confirm | Verify email token and redirect to onboarding |
| GET | /api/profiles/me | Return own profile or null before onboarding |
| PATCH | /api/profiles/me | Create/update own profile through validated upsert |
| GET | /api/profiles/[userId] | Read a member's display profile |
| GET | /api/skills | Read the skill catalog |
| GET | /api/user-skills | Return own teaching/learning skills |
| POST | /api/user-skills | Add own skill association |
| DELETE | /api/user-skills | Remove own skill/direction association |
| GET | /api/discover | Return a bounded page of eligible candidates |
| POST | /api/swipes | Atomically record decision and possibly create match |
| GET | /api/matches | List own matches |
| GET | /api/matches/[matchId]/messages | Read a bounded page of messages |
| POST | /api/matches/[matchId]/messages | Send message as current user |

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
