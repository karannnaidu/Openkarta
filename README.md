# OpenKarta

**The open agentic commerce protocol for every category — goods, stays, flights, buses, services.**

OpenKarta is an MIT-licensed protocol that lets any AI agent discover a merchant, browse their catalogue, build a cart, get a signed quote, check out, and track an order — using exactly the same eight verbs across five item types. It is small, typed, and shippable: a v0.1 implementation lives in this monorepo and runs three reference agents to prove every endpoint works end-to-end.

This repository contains the reference protocol, a Node.js SDK, three reference agents, a conformance harness, and a demo CLI that runs end-to-end flows against any conformant agent.

```text
┌─────────────────┐                       ┌──────────────────┐
│  Consumer agent │  ──── 8 verbs ───▶    │   Brand agent    │
│ (orchestrator)  │  ◀── signed quote ──  │  (per merchant)  │
└─────────────────┘                       └──────────────────┘
```

---

## The 8 actions

| Verb       | Method | Path                                  | Purpose                                       |
| ---------- | ------ | ------------------------------------- | --------------------------------------------- |
| `discover` | GET    | `/v0/discover`                        | Returns the merchant's `CapabilitiesManifest` |
| `search`   | POST   | `/v0/search`                          | Discriminated query by item type              |
| `get`      | GET    | `/v0/items/:itemId`                   | Single-item lookup                            |
| `quote`    | POST   | `/v0/quote`                           | Price a homogeneous cart, returns signed quote |
| `checkout` | POST   | `/v0/checkout`                        | Place order against a signed quote            |
| `status`   | GET    | `/v0/orders/:orderId/status`          | Read order + fulfilment state                 |
| `cancel`   | POST   | `/v0/orders/:orderId/cancel`          | Cancel order with reason                      |
| `return`   | POST   | `/v0/orders/:orderId/return`          | Initiate a refund                             |

## The 5 item types

| Type      | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| `product` | Physical or digital goods (instant, same-day, scheduled, pickup, standard) |
| `stay`    | Hotels, homestays, apartments, villas, hostels (multi-night booking) |
| `flight`  | Air travel with carriers, fare classes, baggage                      |
| `bus`     | Inter-city bus with operators, seat classes, boarding/dropping       |
| `service` | Appointments at-customer / at-provider / online / venue              |

A cart must be homogeneous: every line shares the same `itemType`. Mixed carts return `cart_must_be_homogeneous` (HTTP 422).

## Tiers

| Tier      | Surface                                              | Use case                              |
| --------- | ---------------------------------------------------- | ------------------------------------- |
| `lite`    | Markdown table, OpenKarta hosts the static catalogue | Tiny merchants who can't run a server |
| `http`    | The eight HTTP verbs implemented by the merchant     | Most merchants                        |
| `agentic` | MCP-equivalent surface (`mcp` tier) over WebSocket   | Conversational, stateful agents       |

The reference agents in this repo are all `http` tier. The conformance harness auto-detects tier via `discover`.

---

## Packages

| Package                                                                  | Description                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`@openkarta/spec`](packages/spec/)                                      | Zod schemas for all 8 verbs, 5 item types, errors, manifest, user-token delegation |
| [`@openkarta/sdk-node`](packages/sdk-node/)                              | Fastify server + typed client, HMAC-signed quote tokens                            |
| [`@openkarta/reference-agent-shop`](packages/reference-agent-shop/)      | Halcyon Shop — quick-commerce product agent (port 4001)                            |
| [`@openkarta/reference-agent-stays`](packages/reference-agent-stays/)    | Halcyon Stays & Spa — stay + service agent (port 4002)                             |
| [`@openkarta/reference-agent-travel`](packages/reference-agent-travel/)  | Halcyon Travel — flight + bus agent (port 4003)                                    |
| [`@openkarta/conformance-tests`](packages/conformance-tests/)            | CLI + programmatic API; emits a signed conformance badge                           |
| [`@openkarta/demo-cli`](packages/demo-cli/)                              | End-to-end product / stay / flight flows against any agent                         |

## Quickstarts

- [**Integrator quickstart**](docs/quickstart-integrator.md) — install `@openkarta/sdk-node` and call discover → quote → checkout.
- [**Agent author quickstart**](docs/quickstart-agent-author.md) — expose your catalogue with the 1-day HTTP path.
- [**Protocol v0.1 reference**](docs/protocol/v0.1.md) — every endpoint, every field, every error.

## Try the live demo

A reference shop agent is deployed at **<https://halcyon-shop.fly.dev>** so you can probe the protocol without setting anything up:

```bash
curl https://halcyon-shop.fly.dev/v0/discover

npx -y -p @openkarta/conformance-tests openkarta-conformance \
  --target https://halcyon-shop.fly.dev
```

Demo only — in-memory state, scales to zero between requests, do not point real consumer agents at it.

## Registry

Conformant agents are listed in [`registry/agents.json`](registry/) — a static, version-controlled list anyone can submit to via PR. See [`registry/README.md`](registry/README.md) for the submission process. A hosted registry service with search and badge verification is planned for v0.2 (see [Plan 08](docs/superpowers/plans/)).

## Landing page

The marketing site at <https://openkarta.org> is plain HTML/CSS in [`web/`](web/) — Cloudflare Pages, no build step. PRs welcome.

## Conformance badge

Run the harness against any agent and embed the resulting badge in a README:

```bash
npx -y -p @openkarta/conformance-tests openkarta-conformance \
  --target https://your-agent.example.com --json > badge.json
```

```markdown
![OpenKarta v0.1 conformant](https://img.shields.io/badge/openkarta-v0.1%20conformant-brightgreen)
```

The badge JSON is HMAC-signed and includes `agentId`, `protocolVersion`, `tierDetected`, `packsPassed`, `testsPassed`, `testsFailed`, `signedAt`, and a `signature`.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before opening issues or pull requests. Security disclosures: [`SECURITY.md`](SECURITY.md).

## Licence

MIT © 2026 OpenKarta contributors. See [`LICENSE`](LICENSE).
