# Implementation milestones

Complete each milestone before depending on its unfinished behavior. The scaffold
is the starting point; the steps below are work for your capstone team.

## Milestone 1 — Understand and customize the layout

1. Run the project without credentials.
2. Open src/app/page.tsx and change the introduction.
3. Inspect SiteNav and SkillCard to see reusable components.
4. Edit globals.css and check mobile and desktop widths.
5. Inspect an API route: a route.ts exports HTTP method functions.
6. Inspect docs/FILE-STRUCTURE.txt together as a team.
7. Agree on route names and database field names before splitting tasks.

Done when everyone can run the same app and explain where a screen and endpoint live.

## Milestone 2 — Authentication

1. Configure Supabase and environment variables using the setup guide.
2. Implement POST /api/auth/signup: verify Origin, parse JSON safely, validate with
   signupSchema, call signUp using the cookie-based server client.
3. Return a check-your-email result when confirmation is required. Do not expose
   whether an arbitrary email address has an account through recovery responses.
4. Implement /auth/confirm with Supabase's documented token_hash verification flow.
   Accept only expected OTP types, handle expired/invalid tokens, and redirect to
   a fixed local onboarding URL. Do not blindly redirect to a query parameter.
5. Replace disabled signup fields with a client form. Show loading and error states.
6. Implement POST /api/auth/login with signInWithPassword. Keep passwords out of logs.
7. After success, navigate to onboarding if there is no profile; otherwise discover.
8. Implement logout as POST, then refresh client navigation state.
9. Add a verified-user check to the main app layout, but exempt onboarding from
   any requirement to already have a profile to avoid redirect loops.
10. Add the same identity check to EVERY data endpoint. A protected layout alone
    does not protect an API route or the underlying database.
11. Implement password recovery and a password-update screen before calling auth complete.
12. Check invalid password, expired email link, refresh, logout, and signed-out API access.

The included proxy refreshes sessions when credentials exist. It does not enforce
feature authorization. getVerifiedUser provides a server-confirmed user via getUser.
The scaffold deliberately provides no global server client: each request gets its own.

## Milestone 3 — Profiles and skills: your first full feature

1. Apply the SQL migration and seed catalog.
2. After verified sign-in, send the user to onboarding.
3. Collect display_name and bio, validate them on both client and server.
4. Use the verified user ID for profiles.id; never accept another person's ID.
5. Implement profile.model.ts with get and upsert queries on profiles.
6. Implement profile.service.ts to apply rules and call the model.
7. Implement GET/PATCH /api/profiles/me using those functions and profileSchema.
8. Handle a missing profile as a normal onboarding state, not an unexpected failure.
9. Connect the form; only show a success message after the database confirms saving.
10. Load the skills catalog and let the user choose teach/learn entries.
11. Implement the user-skills operations with ownership checks and UUID validation.
12. For onboarding completion, query real data to ensure at least one teach and one
    learn entry exist. Keep completion derived rather than trusting a client boolean.
13. Test the profile persists across a refresh and another user cannot change it.

Generate Supabase Database types after applying migrations, replacing the placeholder
src/types/database.ts. Add that type to the client factories for typed database queries.

## Milestone 4 — Discovery and matching

1. Replace fictional discovery data with a server-side query.
2. Exclude the signed-in user, incomplete profiles, and already-swiped profiles.
3. Find complementary skills: someone teaches something I want to learn.
4. Rank mutual complementarity higher if I also teach something they want to learn.
5. Use bounded pagination; do not download every user's data to filter in the browser.
6. Build a database function for recording swipes AND creating matches atomically.
7. The function must derive actor from auth.uid(), reject missing auth and self-swipes,
   validate decision/target, and serialize operations on the canonical user pair.
8. Acquire a transaction-level advisory lock (or another correct locking strategy)
   BEFORE reading/writing the pair so simultaneous likes do not miss each other.
9. Store the swipe once, check reverse interest, and insert one canonical match with
   conflict handling. Decide explicitly how repeat requests and changed decisions work.
10. If the function uses SECURITY DEFINER, set a safe search_path, qualify references,
    revoke execution from PUBLIC and anon, and grant only authenticated execution.
    It must perform its own auth checks because elevated execution can bypass RLS.
11. Keep direct client writes to swipes/matches blocked. The RPC is the authorized path.
12. Connect POST /api/swipes to that function through the current user's client.
13. Enable the card buttons and display the API result. A lone like is not a match.
14. Test A likes B, B likes A, repeated clicks, simultaneous likes, pass, and self-like.

This function is intentionally not supplied as pretend-finished logic in the scaffold.
The migration's read-only swipe/match grants make the incomplete state explicit.

## Milestone 5 — Messaging

1. Load own matches with partner display details.
2. Open /messages/[matchId] when selecting a match.
3. Verify membership before reading messages, with RLS as a second boundary.
4. Implement GET with cursor pagination and stable ordering.
5. Implement POST with messageSchema and the verified user's sender ID.
6. Show sent messages only after persistence succeeds, or mark optimistic messages pending.
7. Render message bodies as normal React text, never untrusted HTML.
8. Add loading, empty, failed-send, retry, and duplicate-submit behavior.
9. Start with manual refresh or polling; add Supabase Realtime after persistence works.
10. If adding Realtime, configure the messages table publication and test authorization;
    filter subscriptions by match ID and unsubscribe on unmount.
11. Test with two browser profiles plus a third unauthorized user.

## Milestone 6 — Complete the capstone demo

1. Add empty and error states to each page.
2. Add keyboard access and labels; don't make drag/swipe the only interaction.
3. Check a narrow phone layout.
4. Add rate limiting and review auth/password recovery behavior before public use.
5. Decide whether avatars, scheduling, reviews, reports, and blocking fit your time.
   They are outside this minimal scaffold. A public launch needs abuse controls.
6. Separate development/test data from a production project.
7. Configure the deployment environment and exact auth redirect URLs.
8. Run the lint/type/build checks and the test checklist.
9. Rehearse: register → confirm → profile → skills → discover → mutual match → message.
10. Prepare the architecture diagram, database explanation, individual contributions,
    and known limitations for your capstone presentation.
