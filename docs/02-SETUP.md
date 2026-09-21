# Setup, one small step at a time

## A. Everyone prepares their computer

1. Install VS Code, Git, and Node.js 22 LTS.
2. In a terminal run `node -v`, `npm -v`, and `git --version`.
3. Extract the project and open its folder in VS Code.
4. Run `npm install` inside the folder containing package.json.
5. Run `npm run dev` and visit http://localhost:3000.
6. A changed page.tsx should update in the browser after saving.
7. If port 3000 is busy, use the local URL printed by Next.js.

## B. One teammate prepares the shared development database

1. Create a Supabase account and development project.
2. Keep the database password in your team's private password manager.
3. Give teammates individual project access using the dashboard's member controls.
4. Open the project's Connect/API settings and locate the project URL and publishable key.
5. Copy .env.example to .env.local. On macOS/Linux use `cp .env.example .env.local`.
   On Windows PowerShell use `Copy-Item .env.example .env.local`.
6. Paste the URL and publishable key into .env.local. Leave no example placeholders.
7. Stop and restart npm run dev after editing environment variables.
8. Follow supabase/README.md to apply the initial SQL and skill seed.
9. Share the URL and publishable key through your team's agreed channel. Do not share
   a secret/service-role key or put one in a browser variable.

The publishable key is intended to be visible in the browser. RLS and the signed-in
session protect rows. A publishable key alone does not grant access to private data.
No service-role key is needed for the proposed normal application flow.

## C. Configure authentication before building auth forms

1. Enable email/password authentication.
2. Set the development Site URL to http://localhost:3000.
3. Set exact permitted redirect URLs for your implemented confirmation/recovery flows.
4. Keep email confirmation on, and implement the confirmation route before testing sign-up.
5. Choose one documented email-confirmation flow. This scaffold reserves /auth/confirm
   for token_hash verification. Configure the email template to point to that route.
6. Never assume signUp returns an active session when email confirmation is enabled.
7. Add production URLs only when you know the actual deployment address.
8. For a larger demo group, check Supabase's current email sending limits and SMTP setup.

## D. Establish the repository

If your existing repository already has files/history, clone it first and copy this
starter into the appropriate project folder. Keep its .git directory. Do not initialize
an unrelated history on top of it, overwrite teammates' work, or force-push.

For a brand-new empty remote repository only:

```bash
git init
git add .
git commit -m "Add SkillSwap starter structure"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Each other teammate clones the remote, enters the project folder, installs dependencies,
creates their own .env.local, and starts the dev server. Never commit .env.local.
Use npm ci when a package-lock.json is committed; use npm install for deliberate
package changes. Commit package.json and package-lock.json together.

## E. Verify the setup

- Homepage loads with demo cards.
- /api/health returns status ok and databaseChecked false.
- /api/skills returns 501 until implemented; that is expected.
- The skill catalog is visible in Supabase Table Editor.
- Do not claim the app is connected just because the health endpoint works.
