# Plan 03 — Hosted Registry & Badge Service Design Spec

**Date:** 2026-04-25
**Status:** Design approved, ready for implementation plan
**Tracks advanced:** A (Merchants), B (Consumer-agent developers)
**ROADMAP row:** Plan 03 — `docs/ROADMAP.md` §5
**Depends on:** Plan 01 (`@openkarta/spec`, `@openkarta/conformance-tests`), Plan 02 (`@openkarta/orchestrator` registry consumer)

---

## 1. Purpose

Replace the static `registry/agents.json` (PR-only submissions, no badge re-verification, no query API) with a hosted service that:

1. lets any merchant or platform self-serve a registry listing through a web UI,
2. proves the submitter actually controls the `baseUrl` they're listing,
3. re-runs the conformance harness daily and reflects health in the public listing,
4. exposes a queryable REST API so consumer agents (Claude/ChatGPT plugins, custom MCP clients, our own SDK) can discover agents without scraping a JSON file,
5. surfaces all of the above on a public dashboard.

This closes the v1.0 gap noted in `docs/ROADMAP.md` §3 Track A and §3 Track B (every "hosted registry" / "badge re-verified within 7 days" / "conformance dashboard" bullet).

---

## 2. Decisions locked during brainstorming

| # | Decision | Why |
|---|---|---|
| D1 | Hosted database is canonical; no PR flow. | True self-serve UX. PR-merge model doesn't scale beyond a few dozen entries. |
| D2 | Domain verification via `https://<baseUrl>/.well-known/openkarta-owner.txt`. | Industry-standard pattern (Search Console, Cloudflare, ACME). Hard to spoof. No new crypto for submitters to manage. |
| D3 | Auth = email magic link (primary) + GitHub OAuth (alternative). Account keyed on email. | Magic link covers non-developer merchants; GitHub OAuth wins the developer first-impression. Linking by email is trivial. |
| D4 | Re-verification cadence: daily. Failure escalation: 3-strike "stale", 7-strike "delisted". Email at each transition. | Comfortable buffer for transient outages. Owner has 6 days to fix before delisting. Aligns with ROADMAP "verified within 7 days" requirement. |
| D5 | Cloudflare-native stack: Workers + D1 + Pages + Queues + Resend. | Free at v1.0 scale, ROADMAP-aligned, edge-fast for a global registry. Foundation handover stays portable through the daily git-mirror snapshot. |
| D6 | Nightly git-mirror snapshot to `registry-mirror` branch → daily auto-merge to `main` → `registry/agents.json` stays canonical-looking. | Old SDK clients hitting `raw.githubusercontent.com/.../registry/agents.json` keep working. Provides an audit log and a portability artifact for foundation handover. |

---

## 3. System architecture

Five deployable components on Cloudflare, plus one external dependency (Resend for email).

| Component | Surface | Responsibility |
|---|---|---|
| **`registry-api`** Worker | `registry.openkarta.org/v1/*`, `/auth/*` | Public REST API + auth. Reads/writes D1. Enqueues verification jobs. |
| **`registry-verifier`** Worker | Queue consumer (no public surface) | For each agent in the queue: fetch its `/v0/discover`, run the conformance suite as a library, write a `badge_runs` row, send transition emails. |
| **`registry-cron`** Worker | Cloudflare Cron Triggers (no public surface) | `0 2 * * *` — enqueue every active agent for re-verification. `0 3 * * *` — git-mirror snapshot. |
| **`registry-web`** | `registry.openkarta.org/` (root) | Cloudflare Pages — static Astro site. Dashboard, submission wizard, account/listings management. Talks to `registry-api` for everything dynamic. |
| **D1** | (internal only) | Single SQLite database. Tables: `accounts`, `sessions`, `magic_links`, `agents`, `verifications`, `badge_runs`, `email_log`. |
| **Resend** | (external) | Magic-link email, verification emails, health-transition notifications. |

**Why the split.** API and verifier separate because the verifier runs slow conformance suites (15-30s per agent) and shouldn't share request-handling capacity. Cron separate because Cloudflare Cron Triggers are bound per-Worker and we have two distinct schedules. Web is static — lives on Pages, not a Worker — for cost and so the UI can deploy independently of the API.

**Why D1 (not KV / R2 / external Postgres).** Workload is relational and write-volume is tiny (~100 cron writes/day + a handful of submissions). D1 is purpose-built and free at this scale.

---

## 4. Data model (D1)

### `accounts`
- `id` TEXT PRIMARY KEY (ULID)
- `email` TEXT UNIQUE NOT NULL
- `display_name` TEXT
- `github_login` TEXT — set if user has signed in via GitHub at least once
- `created_at` INTEGER (unix seconds)

### `sessions`
- `id` TEXT PRIMARY KEY (32-byte random, base64url) — used as the cookie value
- `account_id` TEXT NOT NULL REFERENCES accounts(id)
- `expires_at` INTEGER

### `magic_links`
- `token` TEXT PRIMARY KEY
- `email` TEXT NOT NULL
- `expires_at` INTEGER (15-min TTL)
- `consumed_at` INTEGER NULL — single-use

### `agents` — canonical registry table
- `id` TEXT PRIMARY KEY — same as `agentId`. Regex: `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`.
- `account_id` TEXT NOT NULL REFERENCES accounts(id) — owner; transferable
- `display_name` TEXT NOT NULL
- `description` TEXT
- `base_url` TEXT NOT NULL — must be HTTPS
- `manifest_url` TEXT — defaults to `${base_url}/v0/discover`
- `tier` TEXT NOT NULL CHECK(tier IN ('lite','http','agentic'))
- `supported_item_types` TEXT NOT NULL — JSON array, validated to subset of `['product','stay','flight','bus','service']`
- `regions` TEXT — JSON array of `{country, city?, pincodes?[]}`
- `tags` TEXT — JSON array
- `public_key` TEXT NULL
- `verification_status` TEXT NOT NULL CHECK(verification_status IN ('pending','verified','delisted'))
- `health_status` TEXT NOT NULL CHECK(health_status IN ('unknown','healthy','stale','delisted'))
- `consecutive_failures` INTEGER NOT NULL DEFAULT 0
- `last_verified_at` INTEGER NULL
- `created_at` INTEGER NOT NULL
- `updated_at` INTEGER NOT NULL

### `verifications` — domain-verification challenges
- `agent_id` TEXT NOT NULL REFERENCES agents(id)
- `token` TEXT NOT NULL — `okv-` + 24 base32 chars
- `created_at` INTEGER
- `completed_at` INTEGER NULL
- `status` TEXT NOT NULL CHECK(status IN ('pending','passed','failed','expired'))

### `badge_runs` — every conformance run we execute (90-day retention)
- `id` TEXT PRIMARY KEY (ULID)
- `agent_id` TEXT NOT NULL REFERENCES agents(id)
- `ran_at` INTEGER NOT NULL
- `passed` INTEGER NOT NULL — 0 or 1
- `tests_passed` INTEGER NOT NULL
- `tests_failed` INTEGER NOT NULL
- `packs` TEXT — JSON array (e.g. `["core","product"]`)
- `error_summary` TEXT NULL — first failure message if not passed
- `signed_badge` TEXT — the HMAC-signed badge JSON (mirrors what `@openkarta/conformance-tests` would emit)

### `email_log` — audit trail (anti-spam, deliverability monitoring)
- `id` TEXT PRIMARY KEY
- `account_id` TEXT REFERENCES accounts(id)
- `kind` TEXT CHECK(kind IN ('magic_link','verification_passed','stale','delisted','back_to_healthy','transfer_invite'))
- `sent_at` INTEGER
- `provider_id` TEXT — Resend message id

### `transfer_invites` — pending ownership transfers
- `token` TEXT PRIMARY KEY
- `agent_id` TEXT NOT NULL REFERENCES agents(id)
- `from_account_id` TEXT NOT NULL REFERENCES accounts(id)
- `to_email` TEXT NOT NULL
- `expires_at` INTEGER (24-hour TTL)
- `consumed_at` INTEGER NULL

### Cascade behaviour
- `DELETE FROM agents WHERE id = ?` cascades to `verifications`, `badge_runs`, `transfer_invites` (all FK rows removed). `email_log` rows are preserved for audit.
- `DELETE FROM accounts` is **disallowed while the account owns any agents** — owner must delete or transfer all listings first. Rejected with `forbidden` if attempted.

### Indexes
- `agents(health_status)`
- `agents(verification_status)`
- `agents(account_id)`
- `badge_runs(agent_id, ran_at DESC)`
- `magic_links(expires_at)` — for the cleanup cron
- `sessions(expires_at)` — for the cleanup cron

---

## 5. Public API surface

REST + JSON. All errors use the closed-enum vocabulary established in `@openkarta/spec`. List endpoints emit `Cache-Control` and `ETag`.

### Public reads (no auth)
- `GET /v1/agents` — list with filters: `itemType`, `country`, `city`, `pincode`, `tier`, `health` (default returns `healthy`+`stale`; pass `?include=delisted` to widen). Cursor pagination via `?cursor=…`, 50/page.
- `GET /v1/agents/:id` — detail incl. last badge run + 30-day history (run-counts/day).
- `GET /v1/agents/:id/badge` — signed badge JSON, suitable for README embed.

### Auth (cookie session, `Secure; HttpOnly; SameSite=Lax`)
- `POST /auth/magic-link` — body `{email}`. Same response whether email exists or not (anti-enumeration).
- `GET /auth/magic-link/consume?token=…` — sets session cookie, redirects to `/me`.
- `GET /auth/github/start` → OAuth handshake.
- `GET /auth/github/callback` → links account by email.
- `POST /auth/logout`.
- `GET /auth/me` — returns current account or 401.

### Owner-scoped writes (auth + ownership of `:id`)
- `POST /v1/agents` — submit. Validates schema. Creates `agents` row (`verification_status=pending`, `health_status=unknown`) and a `verifications` row. Returns `verificationInstructions: { token, path }`.
- `POST /v1/agents/:id/verify` — Worker fetches `https://<base_url>/.well-known/openkarta-owner.txt`, strips whitespace, compares to stored token. On match: sets `verification_status=verified`, enqueues a conformance run.
- `PATCH /v1/agents/:id` — edit. Most fields update in place. Changing `base_url` is the only field that resets `verification_status=pending` and re-issues a token; the listing is hidden from the public API until re-verified.
- `DELETE /v1/agents/:id`.
- `POST /v1/agents/:id/reverify-conformance` — manual re-run. Rate-limited 1/hr per agent.
- `POST /v1/agents/:id/transfer` — body `{to_email}`. Sends an "accept transfer" email; recipient confirms via emailed link.

### Closed-enum errors
`account_required`, `agent_not_found`, `agent_id_taken`, `domain_verification_pending`, `rate_limited`, `validation_failed`, `forbidden`. Mapped to HTTP per `@openkarta/sdk-node`'s existing error helpers.

---

## 6. Submission + verification flow

1. User signs in (magic link or GitHub) → session cookie.
2. `POST /v1/agents { agentId, baseUrl, tier, supportedItemTypes, ... }`. Server creates `agents` row + `verifications` row. Returns `201 { agent, verificationInstructions: { token: "okv-...", path: "/.well-known/openkarta-owner.txt" } }`.
3. Submitter serves the bare token (no JSON wrapper, no surrounding whitespace required) at `https://<baseUrl>/.well-known/openkarta-owner.txt`.
4. Submitter clicks "Verify" in the dashboard → `POST /v1/agents/:id/verify`. Worker fetches the well-known file, compares to stored token. On match: `verification_status=verified`, enqueue `verify-agent` queue message.
5. `registry-verifier` picks up the queue message: imports `@openkarta/conformance-tests` as a library, runs the suite against `baseUrl`, writes a `badge_runs` row, updates `agents.health_status` (`unknown → healthy` if passed; `unknown → stale` if not). On first pass, sends `verification_passed` email.
6. Listing now appears in `GET /v1/agents` (default response, since it's `healthy` or `stale`).

**Lite-tier exception.** Lite-tier agents (Plan 04) are hosted on OpenKarta infrastructure — we control the `baseUrl`. For these, domain verification auto-passes; the submitter authenticates separately via Plan 04's submission flow (which is gated on the same account model).

---

## 7. Re-verification cron

`registry-cron` Worker, two cron triggers:

- **`0 2 * * *` (daily 02:00 UTC).** Read all agents with `verification_status='verified'` from D1 (regardless of `health_status` — delisted agents continue to be checked daily so they auto-recover when fixed) and enqueue one message per agent to the `verify-agent` queue. Cloudflare auto-fans-out the consumer (`registry-verifier`) so 100+ agents finish well within the 15-minute cron budget.
- **`0 3 * * *` (daily 03:00 UTC).** Git-mirror snapshot. Read all `verified` agents from D1, generate `registry/agents.json` matching the existing schema, commit + push to a `registry-mirror` branch on the GitHub repo via the GitHub REST API (bot PAT in CF Secrets). A scheduled GitHub Action then merges `registry-mirror` → `main` once daily after a sanity check (no destructive deletes of pre-existing entries).

### Verifier state machine

```
on conformance run for agent A:
  if passed:
    A.consecutive_failures = 0
    A.last_verified_at      = now
    if A.health_status != 'healthy':
      A.health_status = 'healthy'
      send "back_to_healthy" email
  else:
    A.consecutive_failures += 1
    A.last_verified_at      = now
    if A.consecutive_failures == 3:  A.health_status = 'stale';    email "stale"
    if A.consecutive_failures == 7:  A.health_status = 'delisted'; email "delisted"
```

Owner-triggered re-runs (`POST /v1/agents/:id/reverify-conformance`) follow the same state machine. A pass resets `consecutive_failures=0` and (if applicable) flips the health back to `healthy`.

---

## 8. Dashboard / web UI scope

`registry.openkarta.org` (root, Cloudflare Pages). Astro static + minimal vanilla TypeScript for interactivity; no React/SPA framework — keep it cheap and crawlable.

| Route | Audience | Purpose |
|---|---|---|
| `/` | public | Filterable table of all agents — filters: `itemType`, `country`, `tier`, `health`. Per row: name, types, regions, tier, health badge, last verified. |
| `/agent/:id` | public | Manifest summary, current badge, 30-day pass/fail strip, copy-paste badge embed snippet. |
| `/submit` | auth | Wizard: sign in → form → verification instructions (token + path) → poll verification status → done. |
| `/me` | auth | Account dashboard. List of my agents with health, edit/delete buttons. |
| `/sign-in` | public | Magic-link form + "Sign in with GitHub" button. |

**Out of dashboard scope for v1.0:** comments, ratings, reviews, free-text search (filters only — text search deferred until >100 agents), favoriting, watchlists, RSS/webhooks, public account profiles, agent-vs-agent comparison.

---

## 9. Backwards compatibility

- Existing SDK clients hitting `https://raw.githubusercontent.com/karannnaidu/Openkarta/main/registry/agents.json` keep working — the nightly git-mirror keeps that file fresh.
- `@openkarta/orchestrator@1.0.0` (per ROADMAP §6) flips the `DEFAULT_REGISTRY_URL` constant from the GitHub-raw URL to `https://registry.openkarta.org/v1/agents`. The new endpoint's response shape is a strict superset of the legacy file shape — old fields all present, new fields additive.
- Deprecation notice in the orchestrator changelog and the README. The GitHub-raw URL stays live throughout v1.0; removal is a v1.1+ decision.

---

## 10. Error handling & observability

- All write endpoints return closed-enum errors via the protocol's existing error helpers.
- Every Worker handler wraps in try/catch → structured log to Cloudflare Logs (`wrangler tail` for live debug). The future `status.openkarta.org` integration is out of v1.0 scope; emit-but-don't-consume the events for now.
- D1 query timing surfaces in the CF dashboard automatically.
- Conformance failures store `error_summary` (first failure message) so the listing owner can see *what* failed without us exposing the full run.
- **Rate limits:** `POST /auth/magic-link` 5/hr/IP. `POST /v1/agents/:id/reverify-conformance` 1/hr/agent. `GET` endpoints 100/min/IP via CF built-ins.

---

## 11. Testing approach

- **Unit:** `vitest` + `@cloudflare/vitest-pool-workers` (runs Workers locally with simulated D1). Cover: auth flows, agent CRUD, schema validation, rate limits, verifier state-machine transitions.
- **Integration on the verifier:** boot a real reference agent (`@openkarta/reference-agent-shop`) on an ephemeral port, point the verifier at it, assert `badge_runs` row contents and `agents.health_status` updates. No mocked agents — same discipline as Plan 02.
- **End-to-end smoke** in `scripts/registry-smoke.sh`: submit → serve well-known token from a fixture server → verify → manually trigger cron → assert listing appears in `GET /v1/agents`.

---

## 12. Out of scope (deferred to v1.1+)

- Federation (regional sub-registries mirroring each other).
- Full-text search across descriptions.
- Public webhooks (notify external systems on listing changes).
- Comments, reviews, ratings, watchlists, public account profiles.
- Per-listing analytics (impressions, click-throughs).
- Pricing/billing surface — listing is free, indefinitely.
- Public `status.openkarta.org` — separate Plan 09 work.
