# Semantic skill discovery: experimental, disabled by default

Local configuration and connectivity checks passed: both applications use matching
Supabase settings, Supabase Auth accepted the publishable key, the frontend login
and signup pages and backend health endpoint returned HTTP 200, and signed-out
protected requests returned HTTP 401 through both the backend and frontend proxy.
Live authenticated profile/skill persistence, reload, and reciprocal two-account
discovery remain unverified pending browser sign-in. No shared schema changes
were applied. Follow [DISCOVERY-API.md](DISCOVERY-API.md) for the remaining checks.
Real-provider semantic evaluation remains outstanding; no provider quality or
threshold validation is claimed. Fixture tests and the lexical control below
are not live model validation. Semantic matching remains disabled.

## Approach and dependency choice

The installed dependencies contain Next/React, Supabase, Zod, TypeScript, and
PGlite, with no embedding SDK or local ONNX/transformer runtime. Rather than add
an inference runtime/model download, the experimental adapter uses Node's native
fetch and the OpenAI embeddings API with text-embedding-3-small, 256 dimensions,
float output. See the official [embeddings reference](https://developers.openai.com/api/reference/resources/embeddings/methods/create)
and [model documentation](https://developers.openai.com/api/docs/models/text-embedding-3-small).
No dependency or lockfile changes were needed.

The provider endpoint/model are fixed, not user-selected. Inputs are normalized
JSON containing only canonical skill name and optional canonical description.
The actual schema has no skill description column, so production reads and the
evaluation use **names only**. No descriptions are invented from bios. A future
catalog-description migration would require review and a new evaluation/input
version. No profile ID, name, bio, email, message, or authorization data is sent
in embedding input. Requests contain the private provider Authorization key, which
is never returned/logged. Do not put this key in NEXT_PUBLIC variables.

Exact canonical-ID matching remains the unchanged default and fallback. The
semantic matcher compares candidate teaches -> actor learns and actor teaches ->
candidate learns, taking the best supported pair per direction. Each must meet
the configured threshold; one strong direction cannot compensate for the other.
Exact IDs score 1. Related IDs use cosine similarity. Overall rank is the minimum
of the two scores, then profile UUID as a deterministic tie-breaker. Multiple
skill coverage, level suitability, teaching quality, prerequisites, availability,
and real learning outcomes are not measured.

There is no exact-overlap prefilter. Related skills can qualify independently.
Confirmed-user/MFA checks and database RLS run before scoring. Self, invisible
profiles/skills, and all previous swipe targets remain excluded. A score cannot
grant access or create mutual interest. Both skill directions must be present.

## Cache, provider limits and fallback

Vectors are cached only in process memory by SHA-256 of model ID, explicit
operator revision, dimension, input-format version, and normalized content.
Different IDs with the same content share a vector; content/revision changes
invalidate it. Cache entries expire after 24 hours and are capped at 1,024.
No user sessions or authenticated clients are cached. The model name is a provider
alias, not immutable weights: bump the operator revision and reevaluate when
changing model assumptions or input descriptions; TTL is not a drift guarantee.

Hard application limits:

- At most 64 unique canonical contents per semantic search, 512 UTF-8 bytes each.
- One batched provider request per initial search; no retries. Cache-only searches
  make zero requests. No provider calls for pagination or an empty candidate pool.
- Four-second AbortSignal deadline, including response streaming; response cap
  1 MiB, finite nonzero 256-dimensional vectors, unique complete response indices.
- One concurrent provider call; maximum 16 attempts and 128 KiB reserved input
  bytes per hour per process. Reservations include overhead and failed calls.
- Full visible ranking pool capped at 200 scanned profiles by default, configurable
  to at most 500. More profiles cause a complete baseline fallback, never ranking
  just the first chunk and pretending it is a global result.

These are per-process limits. Restarts reset them; multiple workers multiply
them. They are **not an account-wide dollar ceiling**. Before enabling on a hosted
service, configure a dedicated provider project, account/project usage limits,
and appropriate worker counts. Monitor actual billed token usage rather than
assuming similarity searches are free. This change makes no paid provider call
without private configuration and a successful real evaluation.

Provider/config/evaluation/budget/input/pool failures return ordinary exact
recommendations with meta.matching.mode=baseline and an explicit fallback_reason:
CONFIGURATION, EVALUATION_REQUIRED, PROVIDER_UNAVAILABLE, PROVIDER_BUDGET,
CATALOG_LIMIT, or CANDIDATE_LIMIT. Database/authorization failures remain errors;
they never produce fake recommendations or bypass RLS. Baseline continuations
stay baseline (BASELINE_CONTINUATION), even if the provider later recovers.

## Global ranking and pagination

On an initial semantic request, the entire bounded visible pool is read and
scored, sorted once, and frozen in a five-minute server-side snapshot. Pages slice
this ordering, not independently ranked database pages. Version-2 opaque cursors
contain a snapshot UUID, actor and offset; version-1 cursors retain baseline UUID
ordering. At most 50 snapshots are kept per process.

Each page verifies its actor and rechecks the actor's current skill fingerprint,
current RLS-visible candidate profiles/skills, and swipes. Changed/hidden/swiped
candidates are omitted without reranking the others. Lookahead occurs after
these exclusions, with the next offset after the last returned result. Newly
added candidates wait for a fresh search. Actor skill edits, expiry, eviction,
worker restart/worker mismatch, or disabling the flag returns 409 CURSOR_EXPIRED;
the frontend clears the old cursor and offers a fresh search. It never silently
switches a semantic continuation into baseline order.

Process-local snapshots require sticky routing to avoid needless restarts in a
multiworker deployment. This baseline does not add a shared cache/database. It
does not promise a transactional database snapshot under concurrent edits.

## Response and UI additions

Baseline responses are unchanged while the flag is off. When enabled, meta gains
matching with mode, optional fallback_reason, or semantic model_version/threshold.
Semantic candidates also include:

```ts
semantic: {
  learning: { offered, wanted, kind, similarity, explanation },
  teaching: { offered, wanted, kind, similarity, explanation },
  score: number,
  score_kind: "cosine_similarity"
}
```

Each offered/wanted value is a canonical {id,name}. Kind is exact or related.
Scores are cosine similarities, not probabilities or guarantees. Grounded,
templated explanations identify both actual catalog skills, distinguish related
skills from exact matches, and ask users to confirm curricular fit. No generated
claims about personal expertise are added. The frontend shows both directions,
the reciprocal score, and explicit baseline-fallback status.

## Synthetic evaluation and results

The hand-labeled dataset in tests/semantic/fixtures/labeled-skills.cjs contains
24 cases: 12 calibration and 12 held-out. It includes exact IDs, useful partial
specializations, ambiguous language/instrument terms, unrelated objectives and
one-way compatibility. Labels describe plausible exchange usefulness, not skill
identity. They are author judgments, not expert-validated user outcomes. The
small held-out set shares skill vocabulary with calibration and is not a strong
generalization benchmark.

Run the offline evaluation:

```sh
npm run eval:semantic
```

Results are saved to artifacts/semantic/evaluation.json, with per-case scores,
labels/rationales, split metrics and threshold sweeps. A character-trigram cosine
control is included as a dependency-free lexical ablation; it is **not** the
production semantic provider. Threshold selection uses calibration F1, then
precision, then the larger threshold; held-out labels do not select it.

| Method | Held-out precision | Held-out recall | Held-out F1 |
| --- | --- | --- | --- |
| Exact-ID baseline | 1.00 | 0.33 | 0.50 |
| Lexical control, threshold 0.55 | 1.00 | 0.67 | 0.80 |
| OpenAI semantic model | Blocked | Blocked | Blocked |

Across all 24 cases the exact baseline has 4 true positives, 0 false positives,
9 false negatives and 11 true negatives (precision 1.00, recall 0.31, F1 0.47).
These numbers describe this synthetic set only. Lexical improvement does not
validate a learned model, and lexical controls can conflate Java/JavaScript or
Python/snake care at different thresholds. Cosine relatedness is symmetric;
pedagogical usefulness may be asymmetric, so inspect the hard-negative errors
and directional labels rather than choosing a threshold from recall alone.

For a real model comparison, privately set OPENAI_API_KEY and a nonsecret
SKILL_EMBEDDING_REVISION in backend/.env.local, then run:

```sh
npm run eval:semantic -- --provider
```

This embeds only the 27 synthetic canonical names, not users or the shared
database. It uses the same capped provider and matcher, evaluates ten thresholds
from 0.50 to 0.95, and writes artifacts/semantic/provider-evaluation.json only
after a successful response. Missing credentials/provider failure exits nonzero
and reports blocked without printing details. No fixture/lexical score is
substituted for a missing real model result.

The report must match provider/model/dimensions/input format/operator revision,
contain held-out cases and include the chosen threshold in its evaluated sweep.
It is a mechanical evaluation gate, **not a quality guarantee**: review the actual
precision/recall and hard negatives before opting in. The code rejects a lexical
or fixture report for provider activation. A broader independently labeled
dataset and actual user evaluation are still needed for production confidence.

## Private activation after evaluation

Keep SEMANTIC_SKILL_MATCHING unset/false until both live integration and provider
evaluation have been reviewed. In backend/.env.local configure privately:

- OPENAI_API_KEY: dedicated private development provider key
- SKILL_EMBEDDING_REVISION: nonsecret operator revision used by the evaluation
- SKILL_MATCH_EVALUATION_REPORT: absolute path to provider-evaluation.json
- SKILL_MATCH_THRESHOLD: an evaluated threshold selected after reviewing errors
- SKILL_MATCH_MAX_PROFILES: optional 1–500, default 200
- SEMANTIC_SKILL_MATCHING=true

Restart the backend. Missing/mismatched configuration explicitly falls back to
exact discovery. Use the two existing development accounts in DISCOVERY-API.md
to verify related-skill candidates in both directions, visible fallback, and
stable load-more pagination. Do not create accounts, change catalog data, apply
migrations, or share credential/cookie values implicitly during verification.

## Tests and verification limits

```sh
npm run test:semantic
npm run test:discovery
npm run test:auth
npm run lint
npm run typecheck
npm run build
```

Semantic unit/service tests use synthetic vectors and mocked provider responses
to verify reciprocal eligibility, explanations, bounds, caching, global ordering,
authorization rechecks, expiry, evaluated-report gating, and baseline fallback.
Existing mocked integration and isolated PostgreSQL RLS tests remain separate
from hosted verification. No live authenticated Supabase or OpenAI quality result
is claimed by these tests.
