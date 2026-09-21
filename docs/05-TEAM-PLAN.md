# Five-person team plan

| Person | Primary ownership | First deliverable | Review partner |
|---|---|---|---|
| 1 | App shell, UI conventions, integration | Responsive navigation and shared components | 2 |
| 2 | Supabase Auth and protected access | Two test accounts can sign in/out | 3 |
| 3 | Database, RLS, profiles, skill catalog | Profile/skill persistence with permission tests | 4 |
| 4 | Discovery and atomic matching | Mutual likes create exactly one match | 5 |
| 5 | Messaging and end-to-end QA | Only matched users can exchange messages | 1 |

These are ownership areas, not isolated silos. Each person should touch a screen,
its API boundary, and the relevant tests. The database owner reviews migrations
from everyone; the integration owner reviews changes to shared config/layouts.

## First team meeting (about an hour)

1. Agree on the MVP: accounts, profiles, teaching/learning skills, discovery, mutual
   matching, and basic text messaging.
2. Open the starter together and follow one route from UI to planned database table.
3. Assign the five ownership areas and review partners.
4. Create GitHub issues with a clear input/output and completion check.
5. Choose one package manager and agree on the API response format.
6. Choose a teammate to apply shared database migrations.
7. Schedule two short integration sessions per week.

## Branch workflow

```bash
git switch main
git pull --ff-only
git switch -c feat/profile-editor
# Make a small, focused change.
npm run lint
npm run typecheck
npm run build
git add .
git commit -m "Add validated profile editor"
git push -u origin feat/profile-editor
```

Open a pull request. A teammate reviews it, checks behavior, then merges it.
Do not push directly to main after initial setup. Configure branch protections if
available. Do not force-push shared branches. When branches diverge, integrate and
resolve changes together instead of discarding someone else's work.

## Example issue

Title: Save my profile
Input: display_name and bio from the onboarding form.
Behavior: authenticated user can create/update only their own row.
Completion: refresh keeps values; invalid names fail; signed-out request returns 401;
another user's ID cannot be used; all errors are shown clearly in the UI.

## Definition of done

- Actual behavior works; no hardcoded success response.
- Loading/error/empty states exist where relevant.
- Inputs are validated at the server boundary.
- Access rules are tested with more than one user.
- Any SQL change is recorded in a new migration.
- A teammate reviews it and another machine can run it.
- README or API docs change when the contract changes.
