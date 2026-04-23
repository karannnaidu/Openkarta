# OpenKarta

**The open agentic commerce protocol for every category — goods, stays, flights, buses, services.**

OpenKarta is a neutral, open-source protocol that lets AI agents discover, quote, and transact across every commerce vertical through a single contract. One protocol. Five item types. Eight HTTP actions. Any agent. Any merchant. Any category.

> Status: `v0.1` under active development. First public release targeted at end of Week 5.
> License: [MIT](./LICENSE).

---

## Why OpenKarta exists

AI agents are about to do the shopping, the booking, and the ordering on behalf of their humans. But every large platform is racing to ship its own captive protocol — OpenAI's ACP routes to ChatGPT, Google's UCP routes to Google Shopping, each payment network is building its own agent token standard.

**Open is table stakes. Neutral and multi-vertical is the wedge.** OpenKarta is deliberately not a marketplace and deliberately not owned by any single buyer-side agent. One protocol that covers products *and* stays *and* flights *and* buses *and* services — so an agent integrates once and can transact anywhere.

---

## Who is this for?

### 🤖 If you are building an AI agent

You want your agent to *do things* — book a trip, refill the groceries, grab a last-minute hotel, renew the home cleaner. You do not want to write a separate integration for Amazon, Booking, MakeMyTrip, Urban Company, Redbus, and ten other APIs.

OpenKarta gives you **one typed client** that speaks to every compliant merchant:

```ts
import { OpenKartaClient } from '@openkarta/sdk-node';

const client = new OpenKartaClient({ baseUrl: 'https://shop.example.com' });
const results = await client.search({ itemType: 'product', q: 'running shoes size 10' });
const quote   = await client.quote({ cartId: results.items[0].id, quantity: 1 });
const order   = await client.checkout({ quoteToken: quote.quoteToken, payment: {...} });
```

Same eight methods whether the merchant sells sneakers, hotel rooms, flights, or haircuts.

### 🏪 If you are a merchant or marketplace

You want to be *reachable* by the new generation of AI shopping agents without tying yourself to a single buyer platform. You want a standard that does not force you to rebuild for every new agent ecosystem.

OpenKarta gives you **one server implementation** that every compliant agent can transact with:

```ts
import { createOpenKartaServer } from '@openkarta/sdk-node';

const server = createOpenKartaServer({
  manifest: { supportedItemTypes: ['product'], ... },
  handlers: { discover, search, getItem, quote, checkout, status, cancel, return: doReturn },
});
await server.listen({ port: 4001 });
```

Implement the eight handlers, run the conformance suite, ship the signed badge. Done.

### 🌐 If you are an infrastructure or payments provider

You want agent-to-merchant traffic to flow through standardized, neutral rails. You do not want to be a captive payment layer for one buyer-side ecosystem.

OpenKarta defines a payment-agnostic `quote → checkout` handshake with signed quote tokens, delegation via `x-openkarta-user-token`, and a closed-enum error contract — so any payment rail (UPI, cards, wallets, credits, BNPL) can be the execution layer without owning the protocol.

### 🧑‍💻 If you are evaluating protocols

You are deciding whether to implement OpenAI's ACP, Google's UCP, Deeplumen's OCP, or something neutral.

OpenKarta's pitch is simple:

| Dimension | Captive protocols | **OpenKarta** |
|---|---|---|
| Governance | Controlled by one large buyer-side platform | Open, no single vendor |
| Categories | Products first, everything else later | Goods, stays, flights, buses, services — day one |
| Marketplace lock-in | Traffic funneled to the protocol's host | Federated registry, any agent can call any merchant |
| Payment rails | Bundled with the protocol | Payment-agnostic by design |
| Conformance | Self-attested | Signed conformance badge from an open test suite |

---

## The protocol in 60 seconds

**Eight actions** — every compliant agent supports all of them:
`discover`, `search`, `get`, `quote`, `checkout`, `status`, `cancel`, `return`.

**Five item types** — each with its own discriminated schema:
`product` · `stay` · `flight` · `bus` · `service`.
(Quick commerce is `product` + `DeliveryMode="instant"` + a sub-30-minute fulfilment estimate — not a sixth type.)

**Four transport tiers** — pick what fits:
- **HTTP** — canonical REST+JSON contract (recommended).
- **MCP** — Model Context Protocol wrapper for agent runtimes.
- **Feed** — static JSON drop for low-frequency catalogs.
- **Lite** — minimal subset for constrained environments.

**Strong contract** — Zod schemas, homogeneous carts, HMAC-signed 10-minute quote tokens, closed-enum error codes with deterministic HTTP status mapping, per-type capability manifests.

Full spec: [`docs/superpowers/specs/2026-04-24-unified-acp-multivertical-design.md`](./docs/superpowers/specs/2026-04-24-unified-acp-multivertical-design.md).

---

## Repository layout

This is a pnpm + Turborepo monorepo. Packages land in `packages/` as development progresses:

| Package | Purpose |
|---|---|
| `@openkarta/spec` | Zod schemas + TypeScript types for the full protocol |
| `@openkarta/sdk-node` | Fastify server helpers + typed client + HMAC quote tokens |
| `@openkarta/reference-agent-shop` | Halcyon Shop — product + quick-commerce reference agent |
| `@openkarta/reference-agent-stays` | Halcyon Stays & Spa — stay + service reference agent |
| `@openkarta/reference-agent-travel` | Halcyon Travel — flight + bus reference agent |
| `@openkarta/conformance-tests` | CLI + six test packs + signed-badge emission |
| `@openkarta/demo-cli` | End-to-end flow runner for each vertical |

---

## Quickstart (once v0.1 lands)

```bash
pnpm install
pnpm build
pnpm test

# Run a reference agent
pnpm --filter @openkarta/reference-agent-shop dev

# Run the conformance suite against it
pnpm --filter @openkarta/conformance-tests run -- --target http://localhost:4001
```

---

## Roadmap

- **v0.1 (now)** — Protocol, SDK, three reference agents, conformance suite, demo CLI.
- **v0.2** — Merchant of Record payment flow, extended capability manifest, streaming status.
- **v0.3** — MCP transport reference, federated registry, additional item types behind feature flag.
- **v1.0** — Stable protocol, signed-badge directory, governance model, production deployments.

---

## Contributing

Early-stage project, RFC-driven. Before large PRs, open a discussion. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) (lands with v0.1).

---

## License

MIT © 2026 OpenKarta contributors.
