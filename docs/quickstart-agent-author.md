# Quickstart — Agent Author

How a merchant exposes their catalogue on OpenKarta. Two paths, depending on engineering capacity:

| Path             | Time      | Surface                                      | Outcome                                      |
| ---------------- | --------- | -------------------------------------------- | -------------------------------------------- |
| **Lite**         | ~1 hour   | A markdown table the OpenKarta registry hosts | Discoverable, browsable. **No checkout.**    |
| **HTTP**         | ~1 day    | The 8 verbs implemented over HTTPS           | Full catalogue, quotes, checkout, fulfilment |

Most merchants will start with HTTP from day one. Lite is for tiny merchants with no engineering capacity at all (a single coffee shop with a Google Sheet).

---

## Path A — 1-hour Lite

> *Status:* the Lite registry is operated by OpenKarta and is currently in private beta. Reach out to `partnerships@openkarta.org` for an invite.

The Lite tier expects a markdown table of items at a public URL. OpenKarta's registry crawls it on a schedule and proxies search/get calls. Quotes and checkout aren't supported in this tier — orchestrators will route users to your fulfilment channel of choice (a phone number, a wholesale catalogue, etc.).

A minimal item table:

```markdown
| id            | title                       | priceMinor | currency |
| ------------- | --------------------------- | ---------- | -------- |
| espresso_250g | Halcyon Espresso Blend 250g | 75000      | INR      |
| chai_100g     | Halcyon Masala Chai 100g    | 18000      | INR      |
```

Submit your URL via the OpenKarta dashboard once you have an invite. We will publish a manifest with `tier: "lite"` on your behalf.

---

## Path B — 1-day HTTP

The HTTP path is the supported, production-grade option. The fastest way is to copy a reference agent and replace its fixtures with your real catalogue.

### Step 1 — Clone and pick a template

```bash
git clone https://github.com/openkarta/openkarta.git
cd openkarta
pnpm install
```

Copy the closest reference agent to a new directory:

| You sell…                                | Copy from                                                |
| ---------------------------------------- | -------------------------------------------------------- |
| Goods (instant / same-day / standard)    | [`packages/reference-agent-shop`](../packages/reference-agent-shop/)     |
| Hotels, homestays, services              | [`packages/reference-agent-stays`](../packages/reference-agent-stays/)   |
| Flights, buses                           | [`packages/reference-agent-travel`](../packages/reference-agent-travel/) |

```bash
cp -R packages/reference-agent-shop packages/agent-myshop
cd packages/agent-myshop
# update package.json: name, bin name
```

### Step 2 — Edit the manifest

Replace `src/fixtures/manifest.json` to describe your business:

```jsonc
{
  "agentId": "myshop",
  "displayName": "My Shop",
  "protocolVersion": "0.1",
  "tier": "http",
  "baseUrl": "https://api.myshop.example.com",
  "actions": ["discover","search","get","quote","checkout","status","cancel","return"],
  "supportedItemTypes": ["product"],
  "paymentRails": ["razorpay_routes"],
  "languages": ["en","hi"],
  "regions": [{ "country": "IN", "pincodes": ["110001"] }],
  "inventoryVolatility": "realtime",
  "catalogSize": "small",
  "priceRange": { "minMinor": 10000, "maxMinor": 500000, "currency": "INR" },
  "productCapabilities": {
    "categories": ["apparel"],
    "serviceAreas": [{ "country": "IN", "city": "Delhi", "radiusKm": 10 }],
    "deliveryModes": ["same_day","standard"],
    "returnWindow": 14
  }
}
```

The full schema (and conditional per-type capability bundles) is documented in the [protocol reference — Capabilities Manifest](protocol/v0.1.md#capabilities-manifest).

### Step 3 — Edit the items

Replace `src/fixtures/items.json` with your real catalogue, conforming to the [`ItemBase` + per-type schema](protocol/v0.1.md#the-5-item-types). For a small merchant this is the entire integration; for larger merchants you will replace the in-memory store with a database lookup in `src/agent.ts`.

### Step 4 — Override quote and checkout

The reference agents quote a flat 10000-minor per line. Replace the `quote` and `checkout` handlers in `src/agent.ts` with real pricing and real payment integration. The HMAC quote token (`signQuoteToken` from `@openkarta/sdk-node`) signs `{ cartId, totalMinor, currency, expiresAt }` — you can keep its envelope and only change the inputs.

For a full payment integration:
1. Call your payment provider in `checkout` to authorise the amount captured in the verified quote token.
2. Persist the resulting `orderId` (don't use `Map<string, unknown>` in production).
3. Map your provider's webhooks into `fulfilmentStatus` transitions.

### Step 5 — Run the conformance harness

```bash
node packages/agent-myshop/dist/bin.js &
npx openkarta-conformance --target http://localhost:4001 --json > badge.json
```

Every test must pass before you publish. The harness auto-detects `supportedItemTypes` from your manifest and runs the matching pack(s) plus the core pack. See [`packages/conformance-tests`](../packages/conformance-tests/).

### Step 6 — Deploy

The Fastify server in `@openkarta/sdk-node` is plain Node. Deploy it like any HTTPS service:

- Behind your usual TLS terminator.
- With your usual logging / tracing.
- Behind a rate limiter — the protocol expects `rate_limited` (HTTP 429) on overload.

### Step 7 — Register

Submit your `agentId`, `baseUrl`, public key, and the badge JSON to the OpenKarta registry. Once published, consumer agents can discover you.

---

## Common pitfalls

- **Mixed carts.** Cart lines must all share the same `itemType`. The SDK enforces this; if you bypass the SDK, return `cart_must_be_homogeneous` (HTTP 422).
- **Quote token tampering.** Always verify `quoteToken` on `checkout` (`verifyQuoteToken` from `@openkarta/sdk-node`). Mismatch → `quote_invalid`; expired → `quote_expired`.
- **Money in major units.** Every `*Minor` field is integer paise / cents. Never use floats.
- **Missing `cancellationPolicy`.** Stay, bus, and service items require this field. Set it conservatively if you don't have a real policy yet (`non-refundable` is safer than over-promising).

## Next steps

- Read the [full protocol reference](protocol/v0.1.md).
- Run the demo CLI against your agent: `openkarta-demo --flow product --target http://localhost:4001`.
- Open issues against the spec on [GitHub](https://github.com/openkarta/openkarta/issues).
