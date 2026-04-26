# OpenKarta Registry

The hosted registry replaces the static `registry/agents.json` PR flow with a
self-service service: agents are submitted through a web form, verified by
domain ownership, exercised by the conformance suite on a daily cadence, and
listed publicly with a health/verification badge. A daily git mirror keeps the
legacy static URL backwards-compatible.

## Architecture

Five Cloudflare-resident components, one D1 database:

```
                            ┌────────────────────────┐
                            │   registry-web         │
                            │  Astro Pages site      │
                            │  (registry.openkarta…) │
                            └───────────┬────────────┘
                                        │ fetch /v1/*
                                        ▼
┌──────────────┐  enqueue  ┌────────────────────────┐    runs    ┌──────────────────────┐
│ registry-cron│──────────▶│   registry-api         │───────────▶│ registry-verifier    │
│  scheduled   │           │  Hono Worker           │   queue    │  queue consumer       │
│  Worker      │           │  /auth /v1/agents      │            │  conformance + email │
└──────┬───────┘           └───────────┬────────────┘            └──────────┬───────────┘
       │ daily git mirror              │ reads/writes                       │ writes
       ▼                               ▼                                    ▼
┌──────────────┐                ┌─────────────────┐                  ┌─────────────────┐
│  GitHub      │                │  D1 (SQLite)    │◀─────────────────│  D1 (badge_runs)│
│  registry    │                │  agents/sessions/│                 │                 │
│  mirror      │                │  badge_runs/…   │                  │                 │
└──────────────┘                └─────────────────┘                  └─────────────────┘
```

| Package              | Type                   | Cloudflare resource          |
|----------------------|------------------------|------------------------------|
| `registry-api`       | HTTP Worker (Hono)     | Worker + D1 binding + Queue producer |
| `registry-verifier`  | Queue consumer Worker  | Worker + D1 binding + Queue consumer |
| `registry-cron`      | Scheduled Worker       | Worker + D1 + Queue producer + Cron |
| `registry-web`       | Static Astro site      | Pages                        |
| `registry-shared`    | Library                | n/a (used by api + verifier) |

## API surface

All endpoints are versioned under `/v1` except auth endpoints under `/auth`.

### Public

- `GET /v1/agents` — cursor-paginated listing of verified, non-delisted agents.
  Filterable by `tier`, `country`, `itemType`. Returns `{ items, nextCursor }`.
- `GET /v1/agents/:id` — single agent detail, including last conformance run.
- `GET /v1/agents/:id/badge` — HMAC-signed badge image/SVG for embedding.

### Authenticated (session cookie)

- `POST /auth/magic-link/request` — body `{ email }`, sends a one-time link.
- `GET  /auth/magic-link/consume` — exchanges `?token=` for a session cookie.
- `GET  /auth/github/start` / `GET /auth/github/callback` — GitHub OAuth.
- `GET  /auth/me` — current session.
- `POST /auth/logout`.
- `POST /v1/agents` — submit agent (returns verification token).
- `POST /v1/agents/:id/verify` — confirms `/.well-known/openkarta-owner.txt`.
- `POST /v1/agents/:id/reverify` — manually enqueue a conformance re-run.
- `DELETE /v1/agents/:id` — delist owned agent.
- `POST /v1/agents/:id/transfer` — invite a new owner by email.

## Submission flow

```
user → POST /v1/agents → returns { verificationInstructions: { path, token } }
user hosts the token at https://<their-host>/.well-known/openkarta-owner.txt
user → POST /v1/agents/:id/verify
api  → fetches the well-known URL, compares to stored token, marks pending→verified
api  → enqueues a VerifyMessage on the conformance queue
verifier → runs @openkarta/conformance-tests against baseUrl
        → writes badge_run row, updates agents.health_status / consecutive_failures
        → on first pass: sends "verification passed" email
        → on state transitions: sends stale/delisted/back-to-healthy email
```

## Reverify cadence

`registry-cron` fires daily at 02:00 UTC. It SELECTs all verified, non-delisted
agents and enqueues one `VerifyMessage` per agent. The queue consumer rate-limits
itself by Cloudflare's queue concurrency settings.

State machine (3-strike stale, 7-strike delisted):

```
unknown → healthy            (first pass)
healthy ⇄ stale              (3 consecutive failures → stale; any pass → healthy)
stale   → delisted           (7 consecutive failures total → delisted)
delisted → healthy           (any pass → healthy, with "back_to_healthy" email)
```

Emails fire only on state transitions, never on re-emit.

## Backwards compatibility

`registry-cron` also runs at 03:00 UTC daily and pushes a `registry/agents.json`
snapshot to the `registry-mirror` branch on the public OpenKarta GitHub repo.
A workflow (`.github/workflows/registry-mirror-merge.yml`) auto-fast-forwards
that branch onto `main` if the snapshot only adds or updates agents (it rejects
any mirror that *removes* a previously-listed `agentId` to avoid surprise
delistings on consumers pinned to the static URL).

The orchestrator's `DEFAULT_REGISTRY_URL` now points to
`https://registry.openkarta.org/v1/agents` and sniffs the response shape, so
existing consumers continue to work. Pass `{ url }` to `loadRegistry` (or set
`OPENKARTA_REGISTRY_URL`) to keep using the static mirror.

## Local development

Each Worker package is testable through the `@cloudflare/vitest-pool-workers`
harness without spawning `wrangler dev`:

```bash
pnpm --filter '@openkarta/registry-api'      test
pnpm --filter '@openkarta/registry-verifier' test
pnpm --filter '@openkarta/registry-cron'     test
```

The `scripts/registry-smoke.sh` script runs the whole stack end-to-end:

```bash
./scripts/registry-smoke.sh
```

To run the Astro dashboard against a local API:

```bash
PUBLIC_API_BASE=http://127.0.0.1:8787 pnpm --filter @openkarta/registry-web dev
```

To run a real `wrangler dev` (against a real Cloudflare account, with a real
D1 database), see [`runbook.md`](./runbook.md).
