# Frontend

This Next.js application contains all pages, components, styling, local demo fixtures, and public images. It uses Supabase Authentication with a session-refresh proxy. Skill, matching, message, and session content still use local sample data.

From the repository root, run `npm ci` and `npm run dev`. Open http://localhost:3000 and sign in with email/password or Google. There is no public demo entry point.

`@/` imports resolve to this application's `src/`. `@shared/` resolves to `../shared/types/`.

See `../docs/FRONTEND-DEMO.md` for page and interaction details.

## Animated login and Supabase authentication

`/login` uses Motion for React, Lucide icons, scoped login styles, and Tailwind utilities without Preflight so existing demo screens retain their styles. Decorative motion is reduced on small screens and disabled for reduced-motion preferences.

Copy `.env.example` to `frontend/.env.local` and set the Supabase project URL and publishable key (the same public settings as the backend). Restart the frontend after changes. Never put secret/service-role keys in public variables. Browser authentication uses `signInWithPassword`; the proxy refreshes session cookies, and `/dashboard` verifies the user with Supabase Auth before rendering the Explore screen. All main app routes, including `/explore`, require a verified Supabase user and redirect signed-out visitors to `/login`. The shared app layout verifies users with `getUser()` through the request-cached `requireUser` helper.

Sign-up creates real Supabase Auth accounts. Password reset remains a preview and does not send email. Email/password login requires a confirmed user when email confirmation is enabled. This change does not connect the demo's matching, profile, or messaging data to the database.

### Interactive login network

The login now includes five draggable skill cards with live SVG connections and traveling particles. Drag within the network, use arrow keys on a focused card (Shift for larger steps), press Home to reset that card, or use Reset to restore the layout. All continuous motion respects reduced-motion preferences, including changes while the page is open. Headlines can be selected or paused.

Remember me controls Supabase auth-cookie persistence, including server refreshes: unchecked uses session-only cookies; checked uses persistent cookies. Browser session restoration behavior still depends on browser settings.

Google sign-in uses Supabase OAuth with PKCE and the frontend `/auth/callback` route. Enable the Google provider in Supabase, configure its Google OAuth credentials, and allow `http://localhost:3000/auth/callback` (plus the deployed site's callback URL) in Supabase Authentication URL Configuration. The callback exchanges the code for a cookie session and redirects to the verified `/dashboard`; failed callbacks return a fixed error message on `/login`. No provider secrets belong in frontend environment variables.


### Real email/password signup

`/signup` calls Supabase Auth `signUp` with email/password and saves `username` and `display_name` in user metadata. The username is display information, not a unique login identifier or an authorization claim. Users sign in with email/password. No password is stored in application tables, React state, localStorage, or logs; Supabase Auth manages password hashing. The account username is used in the navigation after a verified login.

Enable the Email provider and user registration in Supabase Authentication. Set the Site URL to the frontend origin and allow `/auth/callback` for development and production origins. The default Supabase confirmation email works with this PKCE callback when opened in the same browser. When confirmation is enabled, signup shows a check-email message; when disabled, the returned session redirects to `/dashboard`.

For SSR email confirmation that also works on another device/browser, set the **Confirm signup** email template link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

Set Site URL to `http://localhost:3000` for local development (or your deployed frontend origin in production). The frontend `/auth/confirm` route verifies the token with Supabase, sets session cookies, and redirects to `/dashboard`; expired/invalid links return a fixed error on `/login`. Neither confirmation route accepts arbitrary redirect destinations. Mail delivery/rate limits and SMTP are controlled in Supabase.

View accounts in Supabase **Authentication → Users**. User metadata contains the username; passwords are not viewable. This signup flow does not depend on the still-unconfigured public application tables.

Email signup continues to use the existing `/auth/callback` URL, so no additional redirect URL configuration is needed for this fix. The callback distinguishes provider errors from an unavailable automatic session: an unexchangeable/legacy code leads to a neutral manual-sign-in notice, while a valid existing user session continues to `/dashboard`. No failed callback is treated as proof that an email was confirmed. For automatic confirmation across browsers/devices, use the `/auth/confirm` token-hash template documented above.

## Authentication security review

See [the current audit and deployment guide](../docs/AUTHENTICATION-REVIEW.md) for the implemented server-side authentication, recovery, MFA, logout, and private profile flows, required Supabase migration/settings/templates, token-expiry limitations, and test evidence. That guide supersedes earlier demo-era authentication notes in this file. Run `npm run test:auth` from the repository root.
