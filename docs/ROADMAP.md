# OpenKarta Roadmap to v1.0

> **Purpose.** This is the durable north-star for v1.0 — the production-ready milestone where merchants onboard themselves, developers build on top of us, and end users transact through the protocol. Every planning conversation begins by reading this doc. Every plan that ships updates Section 2 (current state) and Section 6 (the v1.0 checklist).
>
> **Not for.** This is not a feature spec. Feature designs live in `docs/superpowers/specs/`. Implementation plans live in `docs/superpowers/plans/`. This doc tells you *what we are building toward* and *what order*; the linked plans tell you *how*.
>
> **Update cadence.** After every plan ships — bump Section 2, tick relevant boxes in Section 6, mark Section 5 plan rows complete.

---

## 1. End goal — what "v1.0 production-ready" means

OpenKarta v1.0 is the milestone where the protocol stops being an MIT spec with reference servers and becomes a live two-sided network that merchants, developers, and end users can actually use without us holding their hand.

**Concretely v1.0 is reached when** all three tracks have crossed a self-serve usage threshold:

- A merchant can onboard to a hosted reception agent in under a day with no engineering hand-holding.
- A third-party developer can ship a working consumer agent against the registry without contacting us.
- An end user can complete a real-money transaction across at least three verticals via at least one OpenKarta-distributed surface (web app, plus availability via any chat-completions-capable LLM).

The full acceptance checklist is in Section 6.

---

## 2. Current state — what's already shipped

Four plans have shipped end-to-end. In capability terms (not package names — those will evolve):

- **The protocol.** Eight verbs over five item types (product, stay, flight, bus, service), Zod-typed schemas, HMAC-signed quote tokens, closed-enum errors, user-token delegation. MIT-licensed at protocol version 0.1.
- **A Node SDK.** Typed Fastify server helpers + typed HTTP client wrapping all 8 verbs. Published as `@openkarta/sdk-node@0.2.0`.
- **Three reference reception agents** running every item type, with seeded fixtures and per-vertical state machines. Halcyon Shop is deployed at `halcyon-shop.fly.dev`.
- **A conformance harness** that auto-detects supported types, runs a core pack + per-type packs, and emits a signed badge. Self-serve for any merchant. Now also exposed as a `runConformance()` library API consumed by the verifier worker.
- **A consumer-side library and CLI.** `@openkarta/orchestrator@0.4.0` (registry → search → cart → quote → checkout → orders, hosted-registry default with cursor pagination) and `@openkarta/cli@0.4.0` with a vendor-neutral chat REPL. Works against any chat-completions endpoint (OpenRouter, OpenAI, Together, Groq, local Ollama / llama.cpp / vLLM).
- `@openkarta/mcp-bridge` 0.5.0 — stdio MCP server, ships OpenKarta's 8 verbs into any MCP-capable host.
- **A hosted registry.** `api.openkarta.org` (Cloudflare Worker + D1 + Queues), `registry.openkarta.org` (Astro dashboard for browse / submit / manage). Magic-link + GitHub OAuth auth. Daily cron re-enqueues every listed agent for conformance re-verification; verifier worker consumes the queue and updates health + signed badges. Daily JSON mirror snapshot to the `registry-mirror` branch.
- **A landing page** at `openkarta.org` (Cloudflare Pages, no build step).
- **Governance scaffolding.** Foundation, registry-operator, and neutrality-covenant docs plus a security threat model. Not yet a legal entity.

What we don't have yet is in Section 3 (per track) and Section 4 (cross-cutting).

---

## 3. The three audience tracks

### Track A — Merchants
**Who.** D2C brands, quick-commerce platforms, hotel chains, OTAs, salon chains. Anyone with a catalogue or a service slot to sell.

**v1.0 bar.**
- 20 live agents listed and conformance-passing across at least 4 of the 5 item types.
- At least half (10+) onboarded via the **Lite tier** — markdown/CSV catalogue, no engineering required.
- Self-serve registry submission flow (no email-Karan-to-list-me).
- Every listing carries a freshly-verified, signed conformance badge (re-verified within 7 days).

**Bottlenecks now.** No Lite tier exists — every conformant merchant still has to operate a reception agent. Self-serve registry submission and automated daily re-verification are now live; the gap is the no-code path *into* having a reception agent.

### Track B — Consumer-agent developers
**Who.** Anyone shipping a consumer agent that talks to OpenKarta — Claude/ChatGPT plugin authors, custom MCP server authors, mobile devs, our own iOS/web team.

**v1.0 bar.**
- Hosted registry API (queryable, not just a JSON file in git).
- Node SDK at semver `1.0.0` — surface frozen, breaking changes go through deprecation.
- Python SDK at `1.0.0` (parity with Node — same 8 verbs, server + client, signing primitives).
- Public conformance dashboard at `conformance.openkarta.org` showing every listed agent's last badge result.
- Three docs site sections live: protocol reference, integrator quickstart, developer quickstart — at `docs.openkarta.org`.

**Bottlenecks now.** SDKs are at 0.x with no compat freeze; no Python SDK; no MCP bridge for LLM-client distribution (Claude Desktop / Cursor / ChatGPT); the dashboard at `registry.openkarta.org` is a submit-and-manage console, not yet positioned as a developer-facing conformance dashboard at `conformance.openkarta.org`; docs are README files in the repo.

### Track C — End users
**Who.** Humans buying stuff via voice or chat.

**v1.0 bar.**
- **Web app** at `app.openkarta.org` — search / cart / checkout / orders + chat tab (BYO LLM key), works for all 5 item types.
- **MCP-host distribution.** `@openkarta/mcp-bridge` published, listed in MCP directories — one-click registry access from inside Claude Desktop / Cursor / ChatGPT MCP. The host's LLM drives the tools; the bridge is pure tool-execution.
- **Real payments live.** Razorpay Routes for INR + Stripe Connect for USD. COD as a fallback path where the agent supports it.
- **GST-compliant invoicing** for INR transactions.

**Bottlenecks now.** No consumer surface ships at all. Payments are mocked in the reference agents. No MCP bridge yet, so users in Claude Desktop / Cursor / ChatGPT MCP can't reach the registry without writing glue code.

---

## 4. Cross-cutting workstreams

These aren't single plans. They thread through several plans.

| Workstream | v1.0 target |
|---|---|
| **Hosted infrastructure** | Registry API, conformance dashboard, demo agents, web app — all on Cloudflare Pages + Workers + D1 (or Fly.io for stateful workloads). |
| **Payments** | Razorpay Routes (India) + Stripe Connect (everywhere else) live in production. Settlement webhooks. GST invoice generation. Merchant-of-Record licence is **out of scope** for v1.0 (per spec §5 — year 2+). |
| **Governance & Foundation handover** | OpenKarta Foundation incorporated (see §4a). Charter, neutrality covenant, registry-operator agreement signed. The project's core maintainers run the registry as interim operators until incorporation; the foundation takes over by v1.1. |
| **Security** | Independent third-party audit of the protocol surface (signing, delegation, quote tokens). Threat model updated. CVE-disclosure process documented. |
| **Docs site** | Migrate from README files to `docs.openkarta.org` (Mintlify or Docusaurus). Versioned per protocol version. |
| **Observability & SLOs** | Hosted registry SLOs published (99.9% uptime, p95 < 200ms). Status page at `status.openkarta.org`. Incident runbook. |
| **SDKs in other languages** | Python (v1.0 must-have). Go is deferred to v1.1. |
| **Hires** (per spec §10) | 1 protocol engineer (full-time on the rails), 1 BD lead (LOIs and platform integrations). Both on payroll by v1.0. (Mobile engineer dropped — no native app on the roadmap.) |

### 4a. Foundation handover model
The neutrality story (spec §2) requires the registry, protocol spec, and conformance suite to eventually live with a neutral entity. **Until v1.0, the OpenKarta project's core maintainers run the registry as interim operators** — we host, we publish, we sign badges, accountable to the project's governance docs. **By v1.1, OpenKarta Foundation either incorporates** as a Section 8 non-profit in India with a Delaware C-corp parent, **or transfers stewardship to an existing neutral host** — candidates: Linux Foundation, OpenJS Foundation, ONDC. The handover contract is part of v1.0 — we do not ship v1.0 without a written succession path.

---

## 5. Plan sequence

Plans are sized for ~2-4 weeks each. They are sequenced by dependency, not by audience track — most plans advance multiple tracks at once.

| # | Plan | Goal | Tracks | Depends on | Status |
|---|---|---|---|---|---|
| 01 | Protocol & Node SDK | Spec, sdk-node, 3 reference agents, conformance harness, demo CLI | A, B | — | ✅ Shipped |
| 02 | Orchestrator & CLI | Consumer-side library, CLI, vendor-neutral chat | B | 01 | ✅ Shipped |
| 03 | Hosted registry & badge service | Registry API, self-serve submission flow, automated badge re-verification, public dashboard | A, B | 02 | ✅ Shipped |
| 04 | MCP bridge | `@openkarta/mcp-bridge` — exposes the 8 orchestrator verbs as MCP tools over a thin protocol shell. The LLM lives in the MCP host (Claude Desktop / Cursor / ChatGPT MCP); the bridge is pure tool-execution, no LLM key on our side. One-click distribution into any MCP host. | B | 02, 03 | ✅ Shipped |
| 05 | Lite tier ingestor | Markdown/CSV catalogue → hosted reception agent for non-eng merchants | A | 03 | Planned |
| 06 | Payments live | Razorpay Routes + Stripe Connect + GST invoicing + settlement webhooks | A, C | 02 | Planned |
| 07 | Web consumer app | `app.openkarta.org` — search / cart / checkout / orders + BYO-key chat | C | 03, 06 | Planned |
| 08 | Python SDK | Parity with Node SDK — server + client + signing primitives | A, B | 01 | Planned |
| 09 | Foundation & docs site | Foundation incorporated, neutrality covenant signed, `docs.openkarta.org` live | All | — | Planned |
| 10 | Hardening | Third-party security audit, observability, SLOs, status page, npm SDKs frozen at 1.0.0 | All | 03, 06, 07 | Planned |
| ⊥ | Protocol v0.4 (parallel track) | Three-block checkout envelope (`user` / `fulfilment` / `payment`), per-item-type fulfilment shapes, `/v0.4/...` URL prefix, consumer-agent identity (Ed25519 + JWT). Three sub-plans: spec, orchestrator wiring, identity RFC. | A, B | 02 | 🟡 Spec landed (sub-plan 1 of 3); implementation plan TBD |

Plans 03-10 are mandatory for v1.0. v1.0 ships with web + MCP host distribution only — no native mobile app on the roadmap. The Protocol v0.4 parallel track is a hard breaking protocol bump that runs alongside the numbered sequence; whether it lands inside v1.0 or v1.1 depends on when sub-plans 2 and 3 are written and shipped.

---

## 6. Definition of "v1.0 done"

Tick this checklist when every box is true. Until then we are pre-v1.0 and shouldn't claim otherwise on the landing page.

**Track A — Merchants**
- [ ] 20 live agents listed in the hosted registry
- [ ] At least 10 of them onboarded via the Lite tier
- [ ] At least 4 of the 5 item types represented across listed agents
- [ ] Self-serve registry submission flow (no PR required)
- [ ] Every listed agent carries a badge re-verified within the last 7 days

**Track B — Developers**
- [ ] Hosted registry API live with documented uptime SLO
- [ ] `@openkarta/spec`, `@openkarta/sdk-node`, `@openkarta/orchestrator` published at semver `1.0.0`
- [ ] `openkarta-py` SDK published at `1.0.0` on PyPI
- [ ] `docs.openkarta.org` live with protocol reference + 2 quickstarts
- [ ] Public conformance dashboard live at `conformance.openkarta.org`

**Track C — End users**
- [ ] `app.openkarta.org` live; end-to-end checkout against listed agents working for all 5 item types
- [x] `@openkarta/mcp-bridge` published, listed in at least one public MCP directory, end-to-end checkout demoed inside Claude Desktop or Cursor
- [ ] Razorpay Routes live for INR transactions (settlement working)
- [ ] Stripe Connect live for USD transactions
- [ ] GST-compliant invoicing for INR

**Cross-cutting**
- [ ] OpenKarta Foundation incorporated, OR a written stewardship-transfer agreement signed with a neutral host
- [ ] Independent third-party security audit complete; findings remediated
- [ ] Status page live at `status.openkarta.org`
- [ ] Both spec §10 hires on payroll (protocol eng + BD)

---

## 7. Out of scope for v1.0

Deliberately deferred. v1.0 ships without these.

- **Heterogeneous carts / cross-merchant atomic checkout.** "Dinner + movie + cab" stays orchestrator-side until v1.1 protocol revision.
- **Merchant of Record licence (RBI Payment Aggregator).** Year 2+ per spec §5. v1.0 stays in payment-orchestration mode.
- **Native mobile apps (iOS / Android).** Not on the roadmap. End users reach OpenKarta via the web app and via MCP-host distribution (Claude Desktop, Cursor, ChatGPT MCP). Will revisit only if a mobile-native distribution gap turns up that the web + MCP surfaces can't close.
- **Voice input.** No first-party voice surface. If voice happens, it's via whatever LLM client the user is in (which already handles voice).
- **Go SDK.** v1.1.
- **Series-A scale work** — registry-as-a-service rebuild for 1K+ brands (spec §4.8 Plan 08-class work). Deferred until traction warrants.
- **Multi-region hosting.** v1.0 is single-region (Mumbai or Singapore). Multi-region is post-v1.0.
- **Feed tier** (signed JSON/CSV dump for 100-100K SKU merchants). Deferred until a real Feed-tier merchant signs an LOI; until then Lite + HTTP cover the spectrum.

---

## 8. Pointers

- **Spec:** [`docs/superpowers/specs/2026-04-24-unified-acp-multivertical-design.md`](superpowers/specs/2026-04-24-unified-acp-multivertical-design.md)
- **Plans index:** [`docs/superpowers/plans/`](superpowers/plans/)
- **Protocol reference:** [`docs/protocol/v0.1.md`](protocol/v0.1.md)
- **Quickstarts:** [integrator](quickstart-integrator.md), [agent author](quickstart-agent-author.md)
- **Governance:** [`docs/governance.md`](governance.md) (foundation, registry operator, neutrality covenant — on `main`)
- **Security:** [`SECURITY.md`](../SECURITY.md), threat model in [`docs/security.md`](security.md) (on `main`)
- **npm:** [`@openkarta/spec`](https://www.npmjs.com/package/@openkarta/spec) · [`@openkarta/sdk-node`](https://www.npmjs.com/package/@openkarta/sdk-node) · [`@openkarta/orchestrator`](https://www.npmjs.com/package/@openkarta/orchestrator) · [`@openkarta/cli`](https://www.npmjs.com/package/@openkarta/cli)
- **Live demo:** [halcyon-shop.fly.dev](https://halcyon-shop.fly.dev)
- **Registry:** [`registry/`](../registry/)
- **Landing page:** [openkarta.org](https://openkarta.org)
