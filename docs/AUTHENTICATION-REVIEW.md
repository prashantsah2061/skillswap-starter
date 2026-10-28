# Authentication review and deployment steps

## Root causes and scope

The password-reset page previously displayed a preview message and never called Supabase. There was no recovery callback/form, password update, session revocation, or logout implementation. Email callbacks shared the Google callback error path, causing misleading failures after otherwise successful email confirmation. Registration/login were browser-only and used an eight-character signup policy. The profile screen edited local sample data while the account menu read Auth metadata, so names disagreed and edits were not stored to a real user profile. Layout-only checks did not authorize individual server pages or the separate backend scaffold endpoints.

Authentication remains Supabase Auth. The application does not implement passwords, tokens, email verification, identity merging, or MFA itself. Frontend server actions now handle password authentication, signup, recovery, logout, and MFA. Next.js validates the Origin/Host for Server Actions; an additional exact comparison with the server-only APP_ORIGIN rejects unexpected origins. Mutation APIs check Origin explicitly. Auth and session cookies are HttpOnly, SameSite=Lax, and Secure for HTTPS deployments. Browser Supabase clients are not used for authenticated operations. No service-role key is required or used.

## Current provider inspection

The read-only public Auth settings check returned HTTP 200: Google and email providers enabled, signup enabled, and email autoconfirm disabled (email verification is required). The anonymous zero-row account_profiles probe returned PGRST205: the new table is not yet installed. No user records were read and no accounts or emails were created during the audit.

The available tools cannot inspect/change your private SMTP credentials, email templates, redirect allowlist, notification switches, password policy, rate-limit settings, Auth logs, production domain, or privileged dashboard settings. No Supabase CLI login or running local Docker daemon was available. Those items below remain operator steps, not verified production behavior.

## Required Supabase and deployment configuration

1. Apply [202610280001_private_account_profiles.sql](../backend/supabase/migrations/202610280001_private_account_profiles.sql) in Supabase SQL Editor. It is an additive, standalone migration; the old starter schema is not required. It creates account_profiles, owner-only RLS policies, a session/MFA validity predicate, and an authenticated profile-initialization RPC. Run once. Review before applying to production; do not disable RLS or use the service-role key to work around an error.
2. Keep Authentication → Email provider → **Confirm email** enabled. Set minimum password length to **15** and enable **Leaked password protection**. Supabase currently provides leaked-password protection on Pro and above. The app additionally uses the Pwned Passwords k-anonymous range API on the server (only five SHA-1 prefix characters, never a password/full hash/email); it fails closed if unavailable. Provider protection is still necessary to cover callers that bypass the app and call Supabase Auth directly.
3. Configure custom SMTP and verify the sender/domain. The built-in sender is for testing and is limited to two auth emails/hour per project. Test recipient inbox and spam delivery, including a second test account; a successful Auth HTTP response is not proof of delivery.
4. Enable **Password changed** security notification emails in Authentication → Email Templates / Security notifications. Also enable identity-linked/unlinked and MFA-added/removed notifications. These are provider-generated notifications; the app does not send a second homemade notification. Confirm delivery after a real password reset before launch.
5. Enable provider **secure password change / reauthentication** and, where available, **require current password**. The app exposes password changes only through a fresh verified recovery proof; MFA enrollment additionally requires a verified AMR timestamp within ten minutes. Existing passwords/verification factors are not changed through ordinary profile edits. Test these provider settings with the recovery flow on your hosted version.
6. Review Authentication → Rate Limits for password login/token, signup, recovery/OTP, and verification requests. The app relies on Supabase's distributed rate limits, not an in-memory counter that disappears between deployments. Because password calls now originate on the server, provider IP-based limits can apply to the server's shared egress IP. Configure the supported trusted-IP-forwarding option only for a trusted deployment proxy, and consider provider CAPTCHA protection for internet exposure. Do not enable CAPTCHA until a supported captchaToken widget is integrated; this change does not include that widget. No arbitrary client-supplied IP is forwarded as trusted. Exact live rate-limit configuration and CAPTCHA enforcement have not been verified or enabled by this change.
7. Enable TOTP MFA. /security offers enrollment and /mfa handles challenges. Accounts with an enrolled factor and users whose **server-controlled app_metadata.role** is admin must reach aal2 before protected pages/private profile operations. Do not assign roles in user_metadata. There is no administrative UI or privileged admin API in this starter; requireAdmin is available for future server handlers. MFA enrollment needs a fresh sign-in. MFA recovery/removal is deliberately not an email-only bypass; keep operational recovery procedures for lost authenticators.
8. Set APP_ORIGIN in frontend/.env.local to http://localhost:3000 for development. In production set it to your exact HTTPS frontend origin, with no trailing slash or path. HTTPS origin is required outside localhost. Set the matching Supabase Site URL. Use separate development and production Supabase projects where possible.
9. Allow only these exact redirects for each approved origin:
   - http://localhost:3000/auth/callback
   - http://localhost:3000/reset-password
   - https://YOUR_DOMAIN/auth/callback
   - https://YOUR_DOMAIN/reset-password
   Do not add wildcard production domains. Keep Google's authorized redirect URI as the Supabase project's /auth/v1/callback, not the frontend recovery route. Google passwords are managed by Google. Adding an app password uses verified Supabase email recovery and updateUser; the app never merges accounts based on matching email addresses.
10. Configure and test the email templates below. Set short provider OTP/link expiry (for example 15 minutes) in Auth settings. Supabase verifies expiry and one-time use. Disable mail-provider click tracking/link rewriting if it corrupts or preconsumes links. Recovery token verification occurs only after the user submits the new password, not on page GET, to avoid email scanners consuming a link.
11. Configure hosting/proxy/application monitoring to redact auth query strings, request bodies, cookies, and Authorization headers. The app never logs passwords, auth tokens, recovery links, TOTP codes, or QR secrets. Referrer-Policy:no-referrer is set. Production HTTPS enables Secure cookies and HSTS. Restrict Server Action allowedOrigins if you intentionally deploy behind a different trusted host; do not allow arbitrary origins.

### Reset password email template (recommended across devices)

```html
<h2>Reset your SkillSwap password</h2>
<p>If you requested this change, open the link and choose a new password.</p>
<a href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
<p>If you did not request this, you can ignore this email.</p>
```

The fragment is not sent to the web server. The browser removes it immediately and retains it only in memory until the server action verifies it with verifyOtp(type:recovery), validates the user and any enrolled second factor, and calls updateUser. No ordinary login session or URL flag authorizes a recovery. If the tab reloads after the fragment is removed, request a new email. Both fields support password-manager autocomplete and paste.

The default Supabase ConfirmationURL template is also supported for same-browser PKCE recovery: resetPasswordForEmail returns to /reset-password?code=..., and the action exchanges the code with the original server-held verifier and checks the SDK's recovery redirect type. Cross-browser PKCE exchange cannot work without that verifier; use the fragment template instead. The code is removed from the address bar immediately; gateway logs must redact auth query strings.

### Confirm signup template (SSR)

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

The default same-browser PKCE signup template remains supported by /auth/callback. An unexchangeable code shows a neutral manual-sign-in notice and never asserts that confirmation succeeded. Expired/invalid confirmation links show a separate message.

## Password policy and account privacy

New passwords require at least 15 Unicode characters. Supabase Auth's bcrypt implementation limits passwords to 72 UTF-8 bytes; the app rejects an overlong password without truncating or prehashing it. This supports 64+ ASCII characters, spaces, paste, and password managers. Existing shorter passwords can still be used to sign in; new registrations/resets follow the new policy. Login errors are generic for unregistered email, wrong password, and unconfirmed accounts. Recovery uses the same public response for eligible/ineligible email and provider throttling/failure; it does not claim an email was delivered.

Private profile rows are keyed only by auth.users.id. Initial creation reads verified Auth user metadata and prefers display_name/full_name/name/legacy username, then the email local part, then New user. Initialization uses ON CONFLICT DO NOTHING: Google metadata never overwrites a custom name. The account menu and profile share the saved row. Profile fields are plain React text; there is no HTML injection path or lookup through an external personal-information service. No email or credential columns are in account_profiles. Skill/placeholder-photo preferences remain sample browser data, now namespaced by authenticated user ID. Their per-browser storage is not a real messaging/skills backend.

Each app page calls requireUser; the layout also checks authentication. /api/profile derives the actor from verified Supabase getUser/getClaims, checks MFA, rejects client-supplied owner IDs with a strict schema, and updates only the actor's user_id. RLS independently applies the same ownership/session/MFA restrictions to direct Data API requests. The separate backend's feature endpoints now return401 without a verified user; authenticated requests still get501 because those feature APIs remain scaffolds. The health endpoint is intentionally public. Existing starter messages/matches RLS scopes conversations to participants; public skill/profile directory fields in that old schema contain no emails or credentials. The new private profile table does not expose a member directory.

## Logout, recovery revocation, and expiry limits

Logout uses Supabase signOut(scope:local). Password recovery uses signOut(scope:global) after the provider confirms the password update and warns if revocation fails. Old refresh tokens are revoked. Already-issued JWTs can remain cryptographically valid until their expiry: provider sign-out cannot instantly invalidate a self-contained access token everywhere. Set an appropriate short access-token lifetime and session time-box/inactivity settings in Supabase. The private-profile RLS predicate also checks the live auth.sessions row, so it denies revoked sessions immediately. Old starter tables/services that only validate JWTs can retain access until token expiry; do not claim otherwise. Protected server operations validate getUser and verified claims; an active page checks session status on focus and at most every60 seconds while visible.

## Verification completed locally

Run npm run test:auth. Tests exercise real PostgreSQL RLS through a development-only PGlite database with fixture Auth tables, plus provider-contract fixtures for server logic. They do not substitute for testing the hosted project after migration/configuration.

- Actual PostgreSQL: two-user isolation for reads/writes, immutable owner ID, denied direct insert/anonymous access, preserved edited names after provider-name changes, email fallback, live-session revocation, MFA enforcement.
- Server contracts: generic login errors, server validation, CSRF rejection, role spoof rejection, recent-auth timestamps, breached-password rejection and outage handling, signup verification response, recovery/OTP and PKCE proof, invalid/reused links, second-factor requirement, password update before global signout, revocation warnings, logout, unauthorized profile API, Google callback success/rejection.
- Public provider audit: email/Google enabled, email verification required, new private profile table missing (migration required).
- Both production builds, TypeScript, and ESLint were run. Browser results and final counts are reported in the delivery message.

## Not verified against the hosted provider

Real Google-account completion after these changes, new-account confirmation email delivery, valid recovery email delivery/completion, actual security-notification delivery, production DNS/HTTPS/redirects, live two-user RLS after applying the migration, live MFA enrollment/challenge, provider CAPTCHA/rate settings, direct-Auth leaked-password enforcement, and cross-device mail-client behavior remain unverified. No real test accounts, reset emails, or password changes were created during the audit. Supply test accounts interactively; never send passwords, service-role keys, or recovery links in chat.

Final local browser run passed: recovery validation/retry and fragment removal, show/hide password, signup input validation, a real rejected password login, unauthorized frontend profile API and seven backend feature APIs, cross-origin mutation rejection, protected-page redirects, Google PKCE initiation (intercepted before external login) and rejected callback, and mobile overflow checks. No browser runtime errors. The repeatable test suite has 12 passing groups. A scan of all 29 browser assets found no privileged Supabase environment values (none were configured). Enforce HTTP-to-HTTPS redirection at the production hosting ingress in addition to setting APP_ORIGIN/secure cookies/HSTS; that hosting configuration is not accessible here.

### Development-origin and framework logging correction

A verification server occupying3000 caused the user's next dev process to use3001; the additional fixed-origin check rejected those otherwise same-origin requests. Development now permits only matching loopback Origin/Host pairs on the actual local port. Production still requires APP_ORIGIN exactly, and cross-origin/untrusted-host requests remain rejected. Verification servers were stopped to free3000. The browser check against the running dev app on3001 now reaches normal credential validation without an origin500. Thirteen security test groups, lint, and both TypeScript checks pass.

The installed Next.js version also logs Server Function arguments by default in development. This was not covered by the earlier application-source logging scan. Both Next configs now explicitly disable logging.serverFunctions and exclude auth/reset callback URLs from development request logging. Loading both actual development configurations confirmed that argument logging is false. Any real password already exposed in earlier terminal output/screenshots should be changed; the configuration change does not erase existing logs.
