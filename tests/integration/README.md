# Local Supabase integration test

`npm run test:community:live` skips unless `SKILLSWAP_TEST_URL` is set. The test refuses hosted Supabase URLs and requires an explicit opt-in. It uses separate authenticated sessions and simultaneous HTTP requests to test real database concurrency, including duplicate message submissions and overlapping session acceptances.

Start a local Supabase stack, apply every migration and the catalog using [the integration guide](../../docs/SUPABASE-INTEGRATION.md), and create three fresh, confirmed local accounts without MFA. They must not already have matches. Put the following settings in the gitignored root `.env.test`, using local values only:

```dotenv
SKILLSWAP_TEST_URL=http://127.0.0.1:54321
SKILLSWAP_TEST_PUBLISHABLE_KEY=YOUR_LOCAL_PUBLIC_KEY
SKILLSWAP_TEST_ALLOW_MUTATIONS=1
SKILLSWAP_TEST_EMAIL_A=LOCAL_ACCOUNT_A_EMAIL
SKILLSWAP_TEST_PASSWORD_A=LOCAL_ACCOUNT_A_PASSWORD
SKILLSWAP_TEST_EMAIL_B=LOCAL_ACCOUNT_B_EMAIL
SKILLSWAP_TEST_PASSWORD_B=LOCAL_ACCOUNT_B_PASSWORD
SKILLSWAP_TEST_EMAIL_C=LOCAL_ACCOUNT_C_EMAIL
SKILLSWAP_TEST_PASSWORD_C=LOCAL_ACCOUNT_C_PASSWORD
```

Run `node --env-file=.env.test --test tests/integration/community-live.test.cjs`. The script uses ordinary user credentials, never a service-role key. It leaves test records for inspection and signs out its sessions afterward. For another run, provide fresh local test accounts; it deliberately does not reset or delete records. No secrets need to be pasted into chat or committed.

This database/API test does not replace a two-browser UI test. Browser persistence, layout, Google OAuth and reconnect behavior still need verification in an isolated full Supabase environment.
