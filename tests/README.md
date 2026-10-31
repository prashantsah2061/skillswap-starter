# Verification

- `npm run test:auth`: isolated PostgreSQL/PGlite, HTTP authorization and existing authentication tests. The community test executes every migration and verifies three-account isolation and core workflows.
- `npm run test:community:live`: optional real concurrency suite against a local Supabase stack; skipped unless explicitly configured. See [local integration setup](integration/README.md).
- `npm run lint`, `npm run typecheck`, `npm run build`: workspace checks. In environments that block Turbopack's worker port, `npm run build --workspace @skillswap/frontend -- --webpack` verifies the frontend with Next.js's alternate compiler.

The full migration/configuration handoff and remaining live browser checks are in [SUPABASE-INTEGRATION.md](../docs/SUPABASE-INTEGRATION.md).
