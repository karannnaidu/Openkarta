# Changelog

## 0.5.0 — 2026-04-28

### Added
- **`@openkarta/mcp-bridge`** — stdio MCP server that exposes OpenKarta's 8 verbs as tools to any MCP-aware host (Claude Desktop, MCP-aware editors). Pure transport adapter: no LLM, no state, no auth, no env-driven registry override. Install via `npx @openkarta/mcp-bridge`.
- **`@openkarta/orchestrator`**: `createStatelessDispatcher()` + `buildStatelessToolDefs()` — cart and quote threaded through tool I/O, parallel-conversation safe. Existing stateful `createDispatcher()` is preserved for the CLI REPL.
- **`@openkarta/spec`**: `errorHintFor()` and `ERROR_HINTS` — LLM-targeted recovery hint per closed-enum error code.

### Fixed
- **`@openkarta/orchestrator`**: `DEFAULT_REGISTRY_URL` now points at `https://api.openkarta.org/v1/agents` (the actual Worker hostname). Previously it pointed at `https://registry.openkarta.org/v1/agents`, which is the Pages dashboard and serves HTML — every default-config bridge/CLI invocation since 0.4.0 was failing to bootstrap. Custom-URL callers (`loadRegistry({ url })`) were unaffected.

### Why
v1.0 Track C of the roadmap calls for native MCP-host distribution so users can transact via OpenKarta from any MCP-capable assistant — no OpenKarta-specific install, no Anthropic-specific UI. The bridge is the safe-by-default consumer surface; developers who need custom registry behavior continue to use the orchestrator package directly.

## 0.4.0 — 2026-04-26

### Added
- **Hosted registry** at `api.openkarta.org` (Cloudflare Worker + D1 + Queues + cron). Self-serve agent submission, magic-link + GitHub OAuth auth, agents CRUD, verification, reverification, ownership transfer, public listing with cursor pagination.
- **Conformance verifier** (`@openkarta/registry-verifier`) — Cloudflare Queue consumer that runs the conformance harness against listed agents and updates health + signed badges.
- **Daily reverify cron** (`@openkarta/registry-cron`) — enqueues all listed agents for re-verification and snapshots a JSON mirror to the `registry-mirror` branch on every run.
- **Public dashboard** at `registry.openkarta.org` — Astro static site to browse, submit, and manage listings.
- `@openkarta/conformance-tests`: exposes `runConformance()` as a library API so the verifier worker can call it directly.

### Changed (BREAKING)
- `@openkarta/orchestrator` → `0.4.0`: `DEFAULT_REGISTRY_URL` now points at the hosted registry (`https://registry.openkarta.org/v1/agents`). The legacy static URL is mirrored daily and remains a valid override via the `OPENKARTA_REGISTRY_URL` env var or `loadRegistry({ url })`. `loadRegistry` sniffs the response shape and paginates hosted listings transparently — caller-visible types unchanged.
- `@openkarta/cli` → `0.4.0`: inherits the hosted-registry default. No CLI surface change.

### Why
The static `registry/` JSON file in git was browseable but not queryable, gated submissions behind a PR, and never re-verified badges. Track A and Track B of the v1.0 roadmap both required a hosted, queryable, self-serve registry with continuous conformance — this ships it.

## 0.3.0 — 2026-04-25

### Changed (BREAKING)
- `@openkarta/orchestrator`: `chatOnce` now uses the standard `chat/completions` wire format. Options changed from `{ apiKey, model? }` to `{ baseURL, model, apiKey? }`. Dropped the `@anthropic-ai/sdk` dependency.
- `@openkarta/orchestrator`: tool definitions renamed `AnthropicToolDef` → `ToolDef`, field `input_schema` → `parameters`.
- `@openkarta/cli`: `openkarta chat` now takes `--base-url`, `--model`, `--api-key`. Defaults point at OpenRouter. Reads `OPENKARTA_LLM_API_KEY`, `OPENROUTER_API_KEY`, or `OPENAI_API_KEY` from env.

### Why
The library is now LLM-vendor-neutral. Point it at any chat-completions endpoint — hosted or local (Ollama, llama.cpp, vLLM). Users can bring their own provider/key/model without us in the loop.

## 0.2.0 — 2026-04-25

### Added
- `@openkarta/sdk-node`: `createClient(opts)` — typed client wrapping all 8 verbs.
- `@openkarta/orchestrator` (new): consumer-side library — registry, fan-out search, homogeneous cart, signed-quote checkout, order tracking, Anthropic-bridged chat loop.
- `@openkarta/cli` (new): `openkarta` CLI with `search / cart / checkout / orders / chat`.

### Docs
- `docs/orchestrator.md`, `docs/cli.md`.

## 0.1.0 — 2026-05-?? (unreleased)

Initial public release of OpenKarta.

### Added

- `@openkarta/spec` with five item types, discriminated unions, homogeneous cart, CapabilitiesManifest v0.2, closed-enum errors, user-token delegation.
- `@openkarta/sdk-node` with Fastify server, typed client, HMAC-signed quote tokens, error helpers.
- Three reference agents: Halcyon Shop (product + quick-commerce), Halcyon Stays & Spa (stay + service), Halcyon Travel (flight + bus).
- `@openkarta/conformance-tests` with core pack (8) + five per-type packs (4+5+5+4+4 = 22). Auto-detects `supportedItemTypes` and emits a signed badge.
- `@openkarta/demo-cli` with product, stay, and flight end-to-end flows.
