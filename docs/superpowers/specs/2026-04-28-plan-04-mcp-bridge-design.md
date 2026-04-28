# Plan 04 — `@openkarta/mcp-bridge` Design Spec

**Date:** 2026-04-28
**Roadmap row:** Plan 04 (per `docs/ROADMAP.md` §5)
**Ships as:** part of release v0.5.0 (lockstep with the rest of the monorepo)
**Status:** design approved, ready for implementation plan

---

## 1. Goal

Ship a thin, MIT-licensed npm package that exposes OpenKarta's 8 protocol verbs as MCP tools to any MCP-capable host (Claude Desktop, MCP-aware editors, future hosts). The bridge is a **transport adapter**, not a runtime — it owns no LLM, no state, no business logic. It lets a host's existing LLM transact against any OpenKarta merchant with zero account, zero key, zero config.

Success criteria:
- A user can paste a 5-line config into `claude_desktop_config.json`, restart Claude Desktop, and place an order against a reference merchant via natural conversation.
- Bridge code is small enough to audit in one sitting (~600 LOC across six files).
- A new **stateless dispatcher** + tool-defs land in `@openkarta/orchestrator` first; the bridge wraps them. The CLI REPL keeps the existing stateful path unchanged.

Non-goals (v1): HTTP/SSE transport, auth, accounts, resources, prompts, custom registry override, telemetry, recommendation logic.

---

## 2. Locked design decisions

| # | Topic | Decision | Rationale |
|---|---|---|---|
| 1 | Transport | stdio only | Local-first, zero infra, ships as MIT npm. HTTP variant defers to a future hosted bridge (Game 2 monetization path). |
| 2 | LLM-key handling | N/A — host owns the LLM | Bridge is pure tool execution; no chat/completions calls leave the bridge. |
| 3 | Tool surface | Flat 8 verbs, exposed via a new `buildStatelessToolDefs()` in `@openkarta/orchestrator` | Bridge does not invent its own schemas — it imports them from orchestrator. New verbs added later are inherited automatically. |
| 4 | State model | Stateless — `cart` and `quote` are inputs and outputs of the relevant tools | Matches MCP request/response. Parallel-conversation-safe (multi-tab). Existing stateful dispatcher is preserved for the CLI REPL. |
| 5 | Merchant routing | Explicit `agentId` on every merchant-bound tool | Matches existing dispatcher shape. Hallucinated agentIds error loudly and recoverably. |
| 6 | MCP primitives | Tools only — no resources, no prompts | `search` already covers merchant discovery. Resources/prompts add product opinions to a transport adapter. |
| 7 | Error mapping | Structured `code` + advisory `hint`, hint table colocated with `@openkarta/spec` errors | Closed-enum codes are load-bearing; hints help the LLM recover without hiding the canonical signal. |
| 8 | Distribution | `@openkarta/mcp-bridge`, in-monorepo, lockstep semver, registry hardcoded to `DEFAULT_REGISTRY_URL` | Consumer surface is safe-by-default. Custom registry needs use the orchestrator package directly. |

---

## 3. Architecture

Plan 04 ships in two waves inside the same release:

**Wave 1 — orchestrator additions** (`@openkarta/orchestrator`):
- `buildStatelessToolDefs()` — same 8 verbs, but with `cart` and `quote` as explicit input/output fields where relevant. Returns the same `ToolDef[]` envelope.
- `createStatelessDispatcher()` — pure functions over `(args) → result`. `add_to_cart`/`view_cart`/`quote`/`checkout` operate on a `StatelessCart`/`StatelessQuote` passed in args, return updated cart/quote in result. The existing `createDispatcher` is left untouched — CLI REPL keeps using it.
- `StatelessCart`, `StatelessQuote` types exported from the orchestrator public API.

**Wave 2 — the bridge package** (`@openkarta/mcp-bridge`):
- A stdio-mode MCP server that handles two MCP requests:
  - `tools/list` → returns 8 tool definitions from `buildStatelessToolDefs()`.
  - `tools/call` → routes to the stateless dispatcher, wraps the result for MCP, returns it.

Everything else (registry loading, merchant HTTP calls, schema validation, signed-quote handling) is reused from orchestrator. Bridge owns adaptation only.

### What lives in the bridge
- `@modelcontextprotocol/sdk` server bootstrap.
- A thin re-export of `buildStatelessToolDefs()` shaped to MCP's tool-definition envelope.
- A call-router (`tools.ts`) that maps `request.params.name` → stateless-dispatcher call.
- An error shaper (`errors.ts`) that looks up the closed-enum code and attaches a `hint`.
- A registry loader pinned to `DEFAULT_REGISTRY_URL`, called once on startup.

### What does NOT live in the bridge
- No LLM or chat-completions client.
- No process-level state.
- No env-driven registry override.
- No auth, no keys, no user identity.
- No new tools beyond what stateless tool-defs publish.

---

## 4. Components & file structure

### 4.1 Orchestrator additions (Wave 1)

```
packages/orchestrator/
├── src/
│   ├── llm/
│   │   ├── stateless-types.ts         ← NEW: StatelessCart, StatelessQuote types
│   │   ├── stateless-tool-defs.ts     ← NEW: buildStatelessToolDefs()
│   │   └── stateless-dispatcher.ts    ← NEW: createStatelessDispatcher()
│   └── index.ts                       ← MODIFIED: export the three new symbols
└── test/
    └── stateless-dispatcher.test.ts   ← NEW: unit tests for the new dispatcher
```

### 4.2 Spec additions (Wave 1)

```
packages/spec/
├── src/
│   ├── error-hints.ts        ← NEW: hint lookup table for closed-enum codes
│   └── index.ts              ← MODIFIED: re-export errorHintFor / ERROR_HINTS
└── test/
    └── error-hints.test.ts   ← NEW: every code → expected hint
```

### 4.3 Bridge package (Wave 2)

```
packages/mcp-bridge/
├── package.json              ← bin: openkarta-mcp, deps on workspace + @mcp sdk
├── tsconfig.json
├── tsup.config.ts
├── README.md                 ← Claude Desktop config + 8-tool reference + troubleshooting
├── src/
│   ├── bin.ts                ← #!/usr/bin/env node — wires stdio transport, starts server
│   ├── server.ts             ← MCP Server: tools/list + tools/call handlers
│   ├── tools.ts              ← maps tool name → stateless-dispatcher call
│   ├── errors.ts             ← OpenKarta error → MCP isError result, with hint lookup
│   ├── registry.ts           ← thin wrapper around loadRegistry({ url: DEFAULT_REGISTRY_URL })
│   └── index.ts              ← public exports for tests and embedding
└── test/
    ├── server.test.ts        ← in-process MCP roundtrip per tool
    └── errors.test.ts        ← every closed-enum code → expected hint
```

Each `src/*.ts` file is ≤150 lines. Total bridge code excluding tests targets ~500–600 LOC.

### 4.4 Interface boundaries

- `bin.ts` depends on `server.ts` only.
- `server.ts` depends on `tools.ts`, `errors.ts`, `registry.ts`.
- `tools.ts` depends on `@openkarta/orchestrator` (`createStatelessDispatcher`, `buildStatelessToolDefs`).
- `errors.ts` depends on `@openkarta/spec` (`errorHintFor`, `ErrorCode`).
- `registry.ts` depends on `@openkarta/orchestrator` (`loadRegistry`, `DEFAULT_REGISTRY_URL`).

No file imports from sibling test files. No circular deps.

---

## 5. Data flow

```
┌────────────────────────────┐
│ Host (Claude Desktop, etc.)│
└──────────────┬─────────────┘
               │ spawns subprocess: npx -y @openkarta/mcp-bridge
               ▼
       ┌───────────────┐
       │   bin.ts      │ wires stdio transport
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   server.ts   │ MCP Server
       └───────┬───────┘
               │
               │  tools/list  → buildToolDefs() → 8 tool defs
               │  tools/call  → tools.ts → dispatcher[name](args)
               ▼
       ┌───────────────┐
       │ orchestrator  │ HTTP to merchant.baseUrl
       └───────┬───────┘
               ▼
   ┌──────────────────────┐
   │ Merchant reception   │ returns OpenKarta payload OR closed-enum error
   │ agent (third-party)  │
   └──────────┬───────────┘
              ▼
       ┌───────────────┐
       │   errors.ts   │ on error: lookup hint, wrap as MCP isError
       └───────┬───────┘
               ▼
       Host receives result, LLM continues conversation
```

### Invariants

- **Registry loaded once at startup.** Small JSON (~tens of agents). Cached in process memory until restart. No per-call refresh.
- **No cross-call state.** Cart and quote tokens are returned in tool results; the LLM threads them back through subsequent calls. Two parallel conversations cannot poison each other's state because there is no shared state.
- **One bridge process per host.** Each Claude Desktop instance spawns its own subprocess; bridge-level concurrency = 1.
- **Bridge never speaks directly to a merchant outside the registry.** All `agentId` values are validated against the loaded registry before a merchant call. Unknown agentId → `BRIDGE_INVALID_MERCHANT` error.

---

## 6. Error handling

Three layers, all return MCP `{ isError: true, content: [{ type: 'text', text: <json> }] }`:

### 6.1 Merchant-returned OpenKarta errors
The merchant's reception agent returns a closed-enum error like `{ error: { code: 'quote_expired', message: '...', retryable: true, details: {...} } }`. `errors.ts` looks up the code via `errorHintFor()` and adds a `hint` field:

```json
{
  "code": "quote_expired",
  "message": "Quote token expired at 2026-04-28T10:14:00Z",
  "hint": "The signed quote has expired. Call quote again on the same cart to get a fresh token, then checkout.",
  "retryable": true,
  "details": { ... }
}
```

The hint table lives in `@openkarta/spec` so it's the single source of truth — orchestrator and CLI can opt in to the same hints later.

### 6.2 Bridge-internal errors
When the bridge itself fails (registry unreachable on boot, merchant connection refused, malformed merchant response), it synthesizes its own `bridge_*` codes that follow the same shape:

| Code | When | Recovery hint |
|---|---|---|
| `bridge_registry_unavailable` | startup registry fetch failed | "OpenKarta registry is unreachable. Retry shortly." |
| `bridge_network_error` | merchant HTTP call timed out / refused | "Merchant unreachable. Try a different agentId or retry shortly." |
| `bridge_invalid_merchant_response` | merchant returned non-conformant payload | "Merchant returned an invalid response. Pick a different agent." |
| `bridge_invalid_merchant` | unknown agentId | "agentId not found in the OpenKarta registry. Use search to find a valid agentId." |
| `bridge_invalid_args` | zod schema rejected the args | (passes the zod path so the LLM can correct) |

### 6.3 Schema-validation errors
The orchestrator dispatcher already runs zod validation on tool args. When it throws, `errors.ts` catches it and wraps as `BRIDGE_INVALID_ARGS` with the zod-issued path string preserved.

---

## 7. Testing

### 7.1 Unit — error shaping (`test/errors.test.ts`)
- Every closed-enum code in `@openkarta/spec` → expected `hint` text.
- Every `BRIDGE_*` synthetic code → expected `hint` text.
- Unknown error code → falls through with empty `hint` (does not crash).
- Pure function tests, no I/O, fast.

### 7.2 Integration — server roundtrip (`test/server.test.ts`)
- Boot the MCP server in-process with a stubbed dispatcher and a stubbed registry.
- Use the `@modelcontextprotocol/sdk` in-memory client to issue:
  - `tools/list` — verify all 8 tool defs publish, names match `TOOL_NAMES`, schemas are valid JSON Schema.
  - `tools/call` for each verb — happy path, then forced error path. Verify wire envelope, `isError` flag, hint presence.
- Stubbed dispatcher means tests never hit the network. The orchestrator already has its own tests for real dispatch behavior.

### 7.3 End-to-end — manual release-checklist smoke test
Documented in `README.md`'s release checklist:
1. Install package locally (`npm i -g .`).
2. Add config to Claude Desktop, restart.
3. Ask: *"What restaurants are listed?"* → verify search returns Halcyon Shop.
4. Ask: *"Add 1 paneer tikka to my cart"* → verify add_to_cart returns a cart token.
5. Ask: *"What's in my cart?"* → verify view_cart echoes the cart.
6. Verify quote and checkout reach the merchant (sandbox payment).

Not automated. Host-version brittleness makes spawn-based tests low ROI. The release checklist catches host-side regressions; the integration tests catch our own.

---

## 8. Distribution & versioning

| Field | Value |
|---|---|
| Package name | `@openkarta/mcp-bridge` |
| License | MIT |
| Binary name | `openkarta-mcp` |
| Bin entry | `dist/bin.js` |
| Versioning | Lockstep with monorepo. Ships at `0.5.0` (the same release as Plan 04). Bumps with every monorepo release. |
| Dependencies | `@openkarta/spec: workspace:*`, `@openkarta/orchestrator: workspace:*`, `@modelcontextprotocol/sdk` pinned to latest stable at implementation time (resolve in plan) |
| Engines | `node >=20` (matches monorepo) |
| Build | `tsup` (matches monorepo conventions) |

### README minimum

The README must document:

1. **What it is** — one paragraph: "Use OpenKarta from any MCP-aware host."
2. **Install snippet** for Claude Desktop:
    ```json
    {
      "mcpServers": {
        "openkarta": {
          "command": "npx",
          "args": ["-y", "@openkarta/mcp-bridge"]
        }
      }
    }
    ```
3. **Tool reference** — table of 8 tools with one-line descriptions.
4. **Troubleshooting** — server didn't start, tool call failed, registry unreachable.
5. **Link** to `registry.openkarta.org` for browsing live merchants.

---

## 9. Out of scope (v1)

- HTTP / SSE transport (deferred to hosted bridge, post-monetization decision).
- Auth, API keys, account model on the bridge.
- MCP `resources`, `prompts`, `sampling`, `roots`.
- Custom registry URL override (consumer-surface footgun; orchestrator package retains the override for developer use).
- Bridge-side merchant ranking, recommendation, or fallback logic.
- Telemetry / observability (deferred — host logs are enough at v1 scale).
- Windows-specific tooling beyond what `npx` already handles.

---

## 10. Open questions for the implementation plan

None — all 8 design questions are locked. Implementation can proceed.

---

## 11. References

- `docs/ROADMAP.md` §5 — Plan 04 row.
- `packages/orchestrator/src/llm/tool-defs.ts` — the 8 tool defs the bridge wraps.
- `packages/orchestrator/src/registry.ts` — `loadRegistry`, `DEFAULT_REGISTRY_URL`.
- `packages/orchestrator/src/dispatcher/` — the dispatcher the bridge calls.
- `packages/landing-web/src/pages/why-not-mcp.astro` — the public commitment that frames the bridge as transport adapter, not protocol.
- `@modelcontextprotocol/sdk` — host-side SDK we use for the server.
