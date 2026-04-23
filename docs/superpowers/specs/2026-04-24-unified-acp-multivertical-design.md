# OpenKarta — Unified Multi-Vertical v0.1 Design Spec

**Date:** 2026-04-24
**Status:** Design approved, ready for implementation plan
**Owner:** Karan (Calmosis)
**Supersedes:** `2026-04-23-agentic-commerce-protocol-design.md`
**Brand:** OpenKarta (domain: openkarta.ai) — an open agentic commerce protocol
**Tagline:** The open agentic commerce protocol for every category — goods, stays, flights, buses, services.

---

## 0. What this spec changes vs. 2026-04-23

The 2026-04-23 spec designed a product-only protocol and implied a retail-first wedge. This spec widens v0.1 to cover **five commerce item types** — product, stay, flight, bus, service — so the same vocabulary carries Myntra, Blinkit, Airbnb, Yatra, Urban Company, and the long tail from day one. The business model, positioning, money flow, transport tiers, and 18-month trajectory are unchanged. The schemas, capabilities manifest, reference agents, and conformance suite are widened.

**Bottom line:** we ship a vocabulary that already understands goods, stays, flights, buses, and services. A brand picks the type(s) it operates in. The protocol does not need another major version to onboard each new vertical.

---

## 1. One-line pitch

The global protocol and marketplace for agentic commerce, launched from India. Any AI agent, any brand, any platform, any commerce vertical — we are the rails in between, and we take a small fee per transaction.

Mental model for investors: **Visa for agent-driven commerce.**

---

## 2. Positioning

We are a global infrastructure company that happens to launch from India because that is the fastest path to the first 100 integrations. India is the launchpad, not the identity.

- Protocol spec, brand, and architecture are global from v1. Currency-agnostic. Payment-rail-agnostic. Language-agnostic. Vertical-agnostic. Demonstrated first on UPI / INR / English + Hindi.
- The moat is **neutrality**. Every non-US platform has the same fear as Swiggy: they do not want OpenAI or Google to own their customer relationship. We are the neutral rail for the rest of the world.
- Secondary moat in India: ONDC alignment, UPI handling, GST invoicing, vernacular intent, COD, RBI compliance — things global players will deprioritize.

We are **protocol-first**, not marketplace-first. We do not own inventory, we do not own the user's bank, we do not own the merchant's product. We own the rails and the spec. Every transaction pays a toll.

### Platform commitments (structural, not promissory)

Our consumer app puts us between platforms and their customers, just as ChatGPT would. We cannot claim absolute neutrality. Our defensibility depends on structural commitments that OpenAI, Amazon, and Google cannot credibly match:

1. **No vertical integration.** We never sell products, launch private labels, or compete with integrated platforms. Our only revenue is the take-rate. This is a contractual and charter-level commitment.
2. **Platform-friendly data sharing.** Customer identity, purchase history, and intent signals flow back to the integrated platform within user consent. We do not hoard transaction data for model training or competitive advantage.
3. **Platform identity preserved.** Brand, logo, tone, and loyalty programs of the integrated platform surface through every agent interaction. We never rebrand a Swiggy order as an "our-app order."
4. **Omni-surface distribution per integration.** One integration with our protocol reaches our app + Claude + ChatGPT + Gemini + WhatsApp bots + every future agent. We are distribution-positive for platforms, not distribution-capturing.

---

## 3. Wedge (v1 scope)

Two adopter types, one protocol, **five item types**, on day one:

### Brand concierge (C)
Calmosis customers + 5 friendly D2C brands get reception agents. Each brand becomes shoppable by any AI agent. This is the B2B wedge.

- Covers `product` type.
- Rationale: leverages existing Calmosis customer base; zero cold-start cost.

### Cross-platform quick commerce & delivery (A)
3-5 Indian delivery / quick-commerce platforms (Swiggy, Zomato, Blinkit, Zepto, BigBasket) integrate reception agents. Users can bundle intent: "cheapest biryani near me right now", "10-min grocery top-up", "order my Sunday groceries from whoever has stock fastest".

- Covers `product` type with `DeliveryMode = "instant"` and sub-30-minute `estimatedFulfilmentAt`.
- Rationale: daily-use demo, high frequency.

### Vertical pilots (V)
One lighthouse design partner each in stay (homestay / hotel chain), travel (bus operator or OTA), and service (spa / salon / home service) — shipped in parallel with C and A to prove the protocol holds across verticals.

- Covers `stay`, `flight`, `bus`, `service` types via the three reference-agent shapes we ship in Plan 01.
- Rationale: investors and integrators need to see the protocol work outside retail before they believe it will port globally.

### Why ship all four item categories from v0.1
Every additional vertical later requires either (a) breaking-change rewrites or (b) an uncomfortable "we don't support that yet" conversation with integrators. Unified discriminated unions from day one cost us ~2 weeks of Plan 01 work and save us multiple protocol versions.

---

## 4. Protocol design

Structured vocabulary. Transport-plural. Vertical-plural. Open spec. MIT-licensed on GitHub from day one.

**The key design insight:** the protocol is a *shared commerce vocabulary and registry*, not a specific wire format and not a single vertical. Transport is interchangeable; item type is discriminated. The same 8 actions operate over `product | stay | flight | bus | service`. The moat lives in the vocabulary + registry + payment rail, not in the transport or the vertical.

### 4.1 Core actions (unchanged)

| Action | Purpose |
|---|---|
| `discover()` | Capabilities manifest — what this reception agent sells, where, how, at what volatility, for which item types |
| `search(query, filters, context)` | Find items or services; `query` is discriminated by `type` |
| `get(itemId)` | Item detail; returns a discriminated `Item` |
| `quote(cart, user_context)` | Price with delivery / taxes / fees / offers / ETA; returns short-lived `quoteToken` |
| `checkout(cart, payment, address)` | Commit the transaction; consumes the `quoteToken` |
| `status(orderId)` | Track order; returns a discriminated `FulfilmentStatus` |
| `cancel(orderId, reason)` | Pre-fulfilment cancellation |
| `return(orderId, items, reason)` | Post-fulfilment return / refund |

### 4.2 Transport tiers (unchanged)

| Tier | Transport | Target integrator | Catalogue size | Inventory volatility | Integration effort |
|---|---|---|---|---|---|
| **Lite** | Markdown catalogue we ingest + host | Long-tail brands, zero engineering | < 100 items | Static / daily | < 1 day |
| **Feed** | Signed JSON or CSV dump, daily / hourly | Mid-size catalogues | 100 – 100K items | Hourly / daily | 2–3 days |
| **HTTP** (canonical) | REST + JSON, live endpoints | Platforms / brands with infra | Unlimited | Real-time | 3–10 days |
| **MCP** | MCP server exposing the same handlers | Brands wanting direct reach into Claude Desktop / Cursor / any MCP client | Unlimited | Real-time | ~1 week |

All four tiers share: the same Zod vocabulary, the same capabilities manifest, the same registry, the same conformance suite, the same payment orchestration rail.

### 4.3 Item — discriminated union over five types

`Item` is a Zod discriminated union keyed on `type`. Every type extends a shared `ItemBase`.

```ts
// Shared base — every Item carries these
const ItemBase = z.object({
  id:          z.string().min(1),
  brandId:     z.string().min(1),
  title:       z.string().min(1),
  description: z.string().optional(),
  images:      z.array(z.string().url()).max(10).optional(),
  priceMinor:  z.number().int().nonnegative(),   // integer minor units, no floats
  currency:    z.string().length(3),              // ISO-4217
  metadata:    z.record(z.unknown()).optional(),
});

// product — physical goods, SKU-level, variants
const ProductItem = ItemBase.extend({
  type:            z.literal('product'),
  sku:             z.string().min(1),
  variants:        z.array(Variant).optional(),
  inventoryStatus: z.enum(['in_stock', 'low', 'out']),
  shipsFrom:       Region.optional(),
  category:        z.array(z.string()).optional(),
});

// stay — hotel / homestay / apartment / villa / hostel
const StayItem = ItemBase.extend({
  type:               z.literal('stay'),
  propertyId:         z.string().min(1),
  propertyType:       z.enum(['hotel', 'homestay', 'apartment', 'villa', 'hostel']),
  maxGuests:          z.number().int().positive(),
  minStayNights:      z.number().int().positive(),
  checkInTime:        z.string().regex(/^\d{2}:\d{2}$/),
  checkOutTime:       z.string().regex(/^\d{2}:\d{2}$/),
  amenities:          z.array(z.string()).optional(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
  houseRules:         z.array(z.string()).optional(),
  location:           z.object({ lat: z.number(), lng: z.number(), address: Address }),
});

// flight — scheduled commercial flight
const FlightItem = ItemBase.extend({
  type:            z.literal('flight'),
  carrier:         z.string().length(2),        // IATA code
  flightNumber:    z.string().min(1),
  origin:          z.string().length(3),        // IATA airport code
  destination:     z.string().length(3),
  departure:       z.string().datetime(),
  arrival:         z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  fareClass:       z.enum(['economy', 'premium-economy', 'business', 'first']),
  stops:           z.number().int().nonnegative(),
  baggage:         z.object({
    cabinKg:   z.number().nonnegative(),
    checkedKg: z.number().nonnegative(),
  }).optional(),
  refundable:      z.boolean(),
});

// bus — scheduled intercity bus service
const BusItem = ItemBase.extend({
  type:               z.literal('bus'),
  operator:           z.string().min(1),
  origin:             z.string().min(1),
  destination:        z.string().min(1),
  departure:          z.string().datetime(),
  arrival:            z.string().datetime(),
  durationMinutes:    z.number().int().positive(),
  seatClass:          z.enum(['seater', 'sleeper', 'ac-seater', 'ac-sleeper', 'volvo']),
  amenities:          z.array(z.string()).optional(),
  boardingPoints:     z.array(BoardingPoint).min(1),
  droppingPoints:     z.array(BoardingPoint).min(1),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
});

// service — time-bounded service delivered at a location or online
const ServiceItem = ItemBase.extend({
  type:               z.literal('service'),
  serviceCategory:    z.string().min(1),
  providerName:       z.string().optional(),
  durationMinutes:    z.number().int().positive(),
  location:           z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('at_customer'), serviceRadius: z.number().optional() }),
    z.object({ mode: z.literal('at_provider'), address: Address }),
    z.object({ mode: z.literal('online'),      joinUrl: z.string().url().optional() }),
    z.object({ mode: z.literal('venue'),       venueAddress: Address }),
  ]),
  availableSlots:     z.array(z.string().datetime()).optional(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
});

export const Item = z.discriminatedUnion('type', [
  ProductItem, StayItem, FlightItem, BusItem, ServiceItem,
]);
export type ItemType = Item['type'];
```

**Narrowing helpers** ship with `@openkarta/spec`:
```ts
export const isProduct = (i: Item): i is z.infer<typeof ProductItem> => i.type === 'product';
export const isStay    = (i: Item): i is z.infer<typeof StayItem>    => i.type === 'stay';
export const isFlight  = (i: Item): i is z.infer<typeof FlightItem>  => i.type === 'flight';
export const isBus     = (i: Item): i is z.infer<typeof BusItem>     => i.type === 'bus';
export const isService = (i: Item): i is z.infer<typeof ServiceItem> => i.type === 'service';
```

### 4.4 SearchQuery, Cart, Quote, Order, Refund, FulfilmentStatus

**SearchQuery** is discriminated on `type` so that each vertical accepts its natural search parameters:

- `product`: `q`, `categories`, `priceRange`, `deliverTo`, `deliveryMode`
- `stay`: `location`, `checkIn`, `checkOut`, `guests`, `propertyType`
- `flight`: `origin`, `destination`, `departure`, `return?`, `pax`, `fareClass`, `nonstop`
- `bus`: `origin`, `destination`, `departure`, `pax`, `seatClass`
- `service`: `category`, `location`, `preferredSlot`

**CartLine** is discriminated on `itemType`; each shape carries the booking details that only make sense for its vertical:

- `product`: `quantity`, `variantSku`
- `stay`: `checkIn`, `checkOut`, `guests`, `specialRequests`
- `flight`: `passengers[]`, `seatSelection?`, `addBaggage?`
- `bus`: `passengers[]`, `seatSelection?`, `boardingPointId`, `droppingPointId`
- `service`: `slotStart`, `slotEnd`, `headcount`, `notes`

**Cart** is **homogeneous** — all lines must share `itemType`. Enforced in Zod:

```ts
export const Cart = z.object({
  cartId: z.string().min(1),
  lines:  z.array(CartLine).min(1),
}).refine(
  (c) => c.lines.every((l) => l.itemType === c.lines[0].itemType),
  { message: 'cart_must_be_homogeneous: all lines must share itemType' }
);
```

This is a deliberate v0.1 constraint — a single reception agent is responsible for a single order, and users expressing mixed intent ("dinner + movie + cab") fan out across agents orchestrator-side, not inside one cart. Cross-type bundling is a v0.2 conversation.

**Quote** is type-agnostic in shape, with `itemType` denormalised from the cart for convenience:

```ts
export const Quote = z.object({
  quoteToken:           z.string().min(1),     // opaque, signed, short-lived
  cartId:               z.string(),
  itemType:             z.enum([...]),
  lineItems:            z.array(QuoteLine),
  fees:                 z.array(Fee).optional(),
  taxes:                z.array(Tax).optional(),
  discounts:            z.array(Discount).optional(),
  totalMinor:           z.number().int().nonnegative(),
  currency:             z.string().length(3),
  paymentOptions:       z.array(PaymentOption),
  expiresAt:            z.string().datetime(),           // TTL, typically 10 min
  estimatedFulfilmentAt:z.string().datetime().optional(),// powers quick-commerce ETAs
  cancellationPolicy:   z.enum(['flexible', 'moderate', 'strict', 'non-refundable']).optional(),
});
```

**Order** mirrors `Cart` with `orderId`, `quoteFingerprint`, `itemType`, `lines`, `paymentStatus`, `fulfilmentStatus`, `createdAt`, `trackingRef`.

**FulfilmentStatus** is a discriminated union per `itemType`, with per-vertical state machines:

| itemType | Valid states |
|---|---|
| `product` | `confirmed → packed → shipped → out_for_delivery → delivered → returned` |
| `stay` | `confirmed → checked_in → checked_out → cancelled / no_show` |
| `flight` | `confirmed → checked_in → boarded → flown → cancelled / refunded` |
| `bus` | `confirmed → boarded → completed → cancelled` |
| `service` | `confirmed → en_route → started → completed → cancelled` |

**Refund** is type-agnostic flat:

```ts
export const Refund = z.object({
  refundId:    z.string(),
  orderId:     z.string(),
  reason:      z.enum(['user_cancelled', 'merchant_cancelled', 'failed_fulfilment',
                        'damaged', 'not_as_described', 'other']),
  amountMinor: z.number().int().nonnegative(),
  currency:    z.string().length(3),
  status:      z.enum(['initiated', 'processing', 'refunded', 'failed']),
  processedAt: z.string().datetime().optional(),
});
```

### 4.5 CapabilitiesManifest v0.2 — routing & pre-filtering across verticals

`discover()` returns a manifest that lets the registry (and any orchestrator) pre-filter a universe of 10K reception agents down to 5–20 candidates before any fan-out.

```ts
export const CapabilitiesManifest = z.object({
  // identity
  agentId:             z.string().min(1),
  displayName:         z.string(),
  protocolVersion:     z.literal('0.1'),
  tier:                z.enum(['http', 'mcp', 'feed', 'lite']),
  baseUrl:             z.string().url(),

  // surface
  actions:             z.array(Action).min(1),
  supportedItemTypes:  z.array(z.enum(['product','stay','flight','bus','service'])).min(1),

  // commerce
  paymentRails:        z.array(z.enum(['razorpay_routes','stripe_connect','upi_direct','cod'])),
  languages:           z.array(z.string()),
  regions:             z.array(Region),
  inventoryVolatility: z.enum(['static','hourly','realtime']),
  catalogSize:         z.enum(['small','medium','large']),
  priceRange:          z.object({ minMinor: z.number(), maxMinor: z.number(), currency: z.string().length(3) }),

  // per-type capability blocks (only required when the type is in supportedItemTypes)
  productCapabilities: ProductCapabilities.optional(),
  stayCapabilities:    StayCapabilities.optional(),
  flightCapabilities:  FlightCapabilities.optional(),
  busCapabilities:     BusCapabilities.optional(),
  serviceCapabilities: ServiceCapabilities.optional(),
});
```

Per-type capability blocks:

- **ProductCapabilities:** `categories`, `serviceAreas[]` (pin codes / radius / country), `deliveryModes[]` (`instant | same_day | scheduled | pickup | standard`), `returnWindow` (days)
- **StayCapabilities:** `locations[]`, `propertyTypes[]`, `priceTierPerNight`
- **FlightCapabilities:** `carriers[]` (IATA codes), `routes` (`'global'` or explicit origin→destination list), `fareClasses[]`
- **BusCapabilities:** `operators[]`, `regions[]`, `seatClasses[]`
- **ServiceCapabilities:** `serviceCategories[]`, `serviceAreas[]`, `locationModes[]` (`at_customer | at_provider | online | venue`)

**Registry pre-filtering flow:**

```
GET /v0/registry/search?type=product&categories=coffee&serviceArea=560001&deliveryMode=instant&tier=http
  → matches agents where:
     - 'product' ∈ supportedItemTypes
     - 'coffee' ∈ productCapabilities.categories
     - 560001 ∈ productCapabilities.serviceAreas
     - 'instant' ∈ productCapabilities.deliveryModes
     - tier in {http, mcp}
  → narrows 10K registered agents to 5–20
  → orchestrator fans out quote() to those 5–20 only
```

### 4.6 Reference agents (Plan 01 ships three, not one)

Three mocks are necessary because one agent cannot prove that the protocol holds across verticals. Each maps to a named real-world shape so Plan 01's conformance output is "this protocol runs Blinkit + Airbnb + Yatra," not "this protocol runs a demo store."

| Agent | Types | Real-world shape it models | What it proves |
|---|---|---|---|
| **Halcyon Shop** | `product` | Blinkit / Zepto (quick-commerce) + Myntra (catalogue retail) | Products, variants, instant delivery, realtime inventory, sub-30-min `estimatedFulfilmentAt`, radius-based `serviceArea` |
| **Halcyon Stays & Spa** | `stay` + `service` | Airbnb (stays) + Urban Company (services) | Mixed-mode agent: availability calendars, cancellation policies, add-on services on top of a stay, `at_customer` / `at_provider` / `online` / `venue` service modes |
| **Halcyon Travel** | `flight` + `bus` | Yatra / MakeMyTrip (flights) + RedBus (buses) | Travel complexity: seat selection, passenger validation, PNR / ticket issuance, fare-class pricing, multi-leg rollback on checkout failure, boarding/dropping points |

All three are seeded with JSON fixtures, boot on separate Fastify ports, share the `@openkarta/sdk-node` server helpers, and pass their respective conformance packs. Halcyon Shop is the quick-commerce proof; Halcyon Travel is the structured-booking proof; Halcyon Stays & Spa is the mixed-type proof.

### 4.7 Conformance suite

`@openkarta/conformance-tests` is structured as one **core pack** plus **five per-type packs**. The CLI auto-detects which packs to run.

**Core pack (8 tests, runs against every agent):**
`auth-and-delegation`, `error-codes`, `quote-token-lifecycle`, `checkout-idempotency`, `status-polling`, `cancel-refund-chain`, `cache-headers`, `manifest-schema`.

**Per-type packs:**

- **product (~4):** `variants`, `delivery-modes` (including `instant`), `inventory-states`, `return-window`
- **stay (~5):** `availability-calendar`, `cancellation-policy-refund`, `checkin-checkout-times`, `service-add-on`, `multi-night-pricing`
- **flight (~5):** `passenger-validation`, `seat-selection`, `pnr-issuance`, `fare-rules-refund`, `multi-leg-rollback`
- **bus (~4):** `boarding-point-selection`, `seat-selection`, `operator-cancellation`, `travel-date-validation`
- **service (~4):** `slot-booking`, `location-mode-variants`, `provider-attribution`, `duration-enforcement`

**CLI behaviour:**
```
$ npx @openkarta/conformance-tests run --target https://halcyon-travel.example.com
  → GETs /v0/discover, reads supportedItemTypes = ['flight','bus']
  → runs core pack (8) + flight pack (5) + bus pack (4) = 17 tests
  → emits signed JSON badge:
    { agentId, protocolVersion, tierDetected, packsPassed: ['core','flight','bus'],
      testsPassed: 17, testsFailed: 0, signedAt, signature }
```

A single-type agent runs in <2 minutes. A maximally broad agent (all 5 types) runs in <5 minutes.

### 4.8 Scale model — federation, not central indexing

1. **Federation.** Each reception agent owns its catalogue, runs its own search, serves its own inventory. We do not warehouse. 1M SKUs on the platform side works identically to 40 SKUs on a D2C — they bear the load they already bear.
2. **Pre-filtering at the registry.** Orchestrators narrow from "every reception agent" → "5–20 relevant candidates" using `supportedItemTypes` + per-type capability blocks + geo reachability + operational tier.
3. **Caching conventions in the protocol.** Every response carries `Cache-Control`, `ETag`, `Last-Modified`. Orchestrators honour them. Agents declare `inventoryVolatility` so orchestrators know how aggressively to cache.

| Scale | Behaviour | Where handled |
|---|---|---|
| 1 brand × 2K SKUs | Trivial | Today |
| 20 brands × mixed verticals | Trivial | Today |
| 100 brands | Orchestrator fan-out gets slow | Pre-filter via manifest |
| 1K brands | Registry becomes a query service | Plan 08 registry-as-service |
| 10K brands | Long tail cannot self-serve HTTP | ACP-Feed + ACP-Lite tiers |
| 1 platform × 1M SKUs | Platform hosts its own search | No protocol changes |
| 100 concurrent orchestrators vs one agent | Inventory amplification | Caching + conditional GETs |
| 1M concurrent users | Orchestration service bottleneck | Plan 04 orchestration |

Nothing here requires changing the 8 core actions. Every scale concern is handled at registry, transport, caching, or orchestrator layers.

### 4.9 Design principles

- **Structured on the wire, conversational at the orchestrator.** The orchestrator (Claude, ChatGPT, our app) is an LLM — conversation, nuance, disambiguation live there. The reception agent's job is to expose truth: catalogue, inventory, pricing, availability, state transitions. Same split as HTTP vs. the browser.
- **Vocabulary first, transport plural, vertical plural.** Zod schemas are the single source of truth. Wire formats (HTTP, MCP, Feed, Lite) and item types (product/stay/flight/bus/service) are wrappers over the same vocabulary.
- **Integration friction kills protocols.** A merchant must be able to implement v0.1 in a single sprint — or drop a markdown file if they have no engineering.
- **Deterministic.** Calls must be fast (100–200ms p50), cacheable, retryable, testable.
- **Federated by design.** We never own the catalogue.
- **ONDC-aligned where possible.** Where our patterns align with ONDC search/select/init/confirm/status, we say so; we do not fight existing rails.

### 4.10 Agent-native primitives

- **Quote tokens** — short-lived opaque signed strings (10-min TTL). Freeze a price so the agent can commit without racing or hallucinating.
- **User delegation header** (`x-openkarta-user-token`) — OAuth-style delegation from human → agent, separate from the agent's own platform credential.
- **Closed-enum error codes** — `item_not_found`, `quote_expired`, `payment_declined`, `cart_must_be_homogeneous`, etc. Each maps deterministically to an HTTP status. Agents retry on known semantics, not parsed prose.
- **Integer minor units** — all amounts in the smallest unit of the currency. No floats. LLMs hallucinate decimals; we remove the possibility.
- **First-class `cancel` and `return`** — 25% of the action surface. Unattended transactions make post-purchase machinery first-class.
- **`discover` for dynamic capability negotiation** — an orchestrator can integrate with any agent at runtime by inspecting the manifest.

### 4.11 What does NOT belong in the protocol

- Conversation — orchestrator layer.
- UI — consumer surface.
- Ranking / disambiguation across multiple agents — our (closed) orchestration infra.
- Cross-type bundled carts — v0.2 conversation; v0.1 uses one homogeneous cart per agent.
- Central product indexing — never.

---

## 5. Money flow

**v0 (months 0-12): Payment orchestration.**
User pays the platform via a payment gateway we have configured (Razorpay Routes in India, Stripe Connect globally). Our fee is split at settlement automatically. No Payment Aggregator licence needed. Fastest to ship.

**v1 (year 2+): Merchant of record.**
Pursue RBI Payment Aggregator licence in parallel starting in year one. When we hit 50+ platform integrations and sufficient GMV, upgrade to MoR. Unlocks BNPL, credit, FX, embedded insurance as additional revenue lines — where the Stripe-style financial services moat appears.

**Explicitly rejected:**
- "Routing only, no money touched" — weak attribution, easy-to-bypass fees.
- "Merchant of record from day one" — 6–12 months of compliance before we ship anything.

---

## 6. Consumer surface

**Voice-first standalone iOS app.** Flagship surface. Brand-bearing. Not WhatsApp.

- Voice-first agentic commerce is net-new behaviour; we own it end-to-end.
- App feels like a company; a WhatsApp bot feels like a feature.
- Full UX control; long-term defensibility; not dependent on Meta API.
- Tradeoff: higher capital intensity ($5–10M), gated distribution, higher CAC.

**App design principles:**

- **Voice-first, not chat-first.** Text is a fallback.
- **Hook: bundled agentic intent.** "Plan my weekend." "Dinner + movie + cab at 8." "Book my Goa trip — stay, flight, spa." Single-platform orders are table stakes.
- **Protocol stays open.** The app is one surface. Claude, ChatGPT, custom bots call the same protocol.
- **Closed beta in 90 days. Public in 6 months.** iOS-first. Android later.

**Architecture:**
```
Consumer App (voice, flagship)
       |
       v
Open Protocol (MIT, callable by any agent; 5 item types)
       |
       v
Reception Agents (brands via Calmosis + platforms via BD + vertical pilots)
       |
       v
Payment Orchestration (Razorpay Routes / Stripe Connect)
```

---

## 7. Pricing

**Platforms pay. Users do not.**

- 1.5–2.5% of GMV charged to the merchant / platform at settlement.
- Users pay nothing extra. Zero onboarding friction.
- User subscriptions deferred to year 2+, only after sticky power users.

Visa model. Defensible. Zero onboarding tax.

---

## 8. Open-source strategy

| Component | License | Rationale |
|---|---|---|
| Protocol spec | MIT, GitHub | Openness is the whole defensibility story |
| Reference SDKs (Node, Python, Go) | MIT, GitHub | Lower friction for integrators; community contributions are a moat |
| Reference agents (Halcyon × 3) | MIT, GitHub | Living examples of the five item types |
| Conformance suite | MIT, GitHub | Self-service quality bar |
| Consumer app | Closed, proprietary | Our UX, our brand, our differentiation |
| Orchestration infra (ranking, disambiguation, fraud, multi-agent routing) | Closed, proprietary | Where our engineering edge lives |

"Open protocol" ≠ "free product." Stripe's API is public; the business is the service, the trust, the network.

---

## 9. Revenue math

**India (by 2028):**
- Voice / agentic commerce TAM across product + quick-commerce + stay + travel + services: ~$50–80B GMV (multi-vertical expansion vs product-only).
- 5% capture → $2.5–4B GMV through us.
- At 2% take-rate → **$50–80M ARR**.

**Global (year 3+):**
- 10–20× as we port to SEA, LatAm, MENA, EU.

**Unit economics:**
- Gross margin: 70–80% (payment orchestration cost deducted).
- Capital intensity: medium (app + protocol eng + BD, no logistics, no inventory).

---

## 10. 90-day execution plan

1. **Ship protocol spec v0.1 on GitHub** — MIT, documented, unified over 5 item types, with 3 reference reception agents (Halcyon Shop, Halcyon Stays & Spa, Halcyon Travel).
2. **Sign 5 LOIs** — one quick-commerce platform (Swiggy / Zomato / Blinkit / Zepto / BigBasket), two D2C brands (one Calmosis customer + one friendly D2C founder), one stay/service lighthouse (homestay or Urban Company–style), one travel lighthouse (bus operator or OTA).
3. **Build SDKs in Node + Python.** Open-source.
4. **Prototype iOS app** — voice input, one end-to-end flow per vertical (product, stay, travel), TestFlight-ready.
5. **Hire:** 1 protocol engineer, 1 mobile engineer, 1 BD lead.

**Capital:** raise $2–3M pre-seed (AJVC + 1–2 other angels / seed funds). Covers 18 months to:

- 100 brand reception agents live across product + stay + service
- 3–5 platform integrations live (incl. ≥1 quick-commerce + ≥1 travel/stay)
- Closed beta iOS app with voice + bundled multi-vertical intent demo
- Series A metrics: GMV flowing, weekly active voice users, integration count, conformance-certified agent count

---

## 11. Plan 01 impact — what the engineering plan must rewrite

### 11.1 Package-by-package impact

| Package | Change vs. product-only design |
|---|---|
| `@openkarta/spec` | `Item` = discriminated union over 5 types; `SearchQuery` + `CartLine` + `FulfilmentStatus` discriminated; `Cart` `.refine()` for homogeneity; `CapabilitiesManifest` v0.2 with `supportedItemTypes` + per-type capability blocks; narrowing helpers (`isProduct`, `isStay`, …) |
| `@openkarta/sdk-node` | Shape unchanged; type inference propagates through the union |
| `@openkarta/reference-agent` | 1 → **3 servers**: Halcyon Shop (product, quick-commerce), Halcyon Stays & Spa (stay + service), Halcyon Travel (flight + bus). Shared fixture loader, shared Fastify boot, separate data files per agent |
| `@openkarta/conformance-tests` | ~12 → **~30 tests**: core (8) + per-type packs (product 4, stay 5, flight 5, bus 4, service 4). CLI auto-detects `supportedItemTypes` and runs matching packs only |
| `@openkarta/demo-cli` | 1 → **3 flows**: product buy, stay booking, flight-seat-select booking — selectable via `--flow` flag |

### 11.2 Timeline impact

| Milestone | Product-only | Unified v0.1 |
|---|---|---|
| `@openkarta/spec` complete | Week 1 end | **Week 2 end** |
| `@openkarta/sdk-node` complete | Week 2 end | Week 2 end |
| 1st reference agent e2e | Week 2 end | **Week 3 end** (Halcyon Shop) |
| All 3 reference agents e2e | — | Week 4 end |
| Conformance suite complete | Week 3 end | **Week 4–5** |
| demo-cli + docs shipped | Week 3 end | Week 5 end |

Net: **~3-week Plan 01 → ~5-week Plan 01**. Roughly +2 weeks, concentrated in spec discrimination and the two extra reference agents.

### 11.3 Downstream doc migration (after this spec lands)

| Doc | Path | Change |
|---|---|---|
| Old design spec | `docs/superpowers/specs/2026-04-23-agentic-commerce-protocol-design.md` | Mark superseded; keep for history |
| Plan 01 (eng) | `docs/superpowers/plans/2026-04-23-plan-01-protocol-and-node-sdk.md` | Rewrite via `writing-plans` with unified shape |
| Architecture overview | `docs/superpowers/plans/2026-04-23-plan-01-architecture-overview.md` | Update diagrams (Item shape, reference-agent count 1→3, conformance ~12→~30) |
| Pitch deck | `docs/investor/2026-04-23-agentic-commerce-pitch-deck.md` | Update Slide 3 (schema), Slide 7 (TAM), Slide 9 (reference agents) |
| Stitch brief | `docs/investor/2026-04-23-visual-design-brief-for-stitch.md` | Update Visual 3, Visual 6, Visual 11 |

### 11.4 What does NOT change

- 8 core actions
- 4 transport tiers
- Federated registry model
- Integer minor units, closed enums, quote tokens, `x-openkarta-user-token`
- Payment orchestration plan (Razorpay Routes v0 → MoR v1)
- Business model, positioning, 18-month Series A trajectory
- MIT license, open-source stance

### 11.5 Risk register for expanded v0.1

| Risk | Mitigation |
|---|---|
| Discriminated union creates TS/Zod ergonomics pain | Ship narrowing helpers + thorough per-type README examples |
| 5 packs × conformance = long test runs | Per-type packs gated by `supportedItemTypes`; single-type agent <2 min |
| Scope creep eats BD time | Hard cap Plan 01 at 5 weeks; fallback is 2 reference agents (Shop + Stays), defer Halcyon Travel to Plan 01b |
| Airbnb/Myntra/Yatra-style platforms don't map cleanly | Reference agents explicitly model those shapes; if Halcyon Travel proves flight+bus, Yatra fits |
| Quick-commerce edge cases (Blinkit/Zepto) | Halcyon Shop models it: `DeliveryMode: instant`, radius `serviceArea`, realtime inventory, sub-30-min `estimatedFulfilmentAt` |

---

## 12. Open questions / TBDs

- **First quick-commerce platform contact.** Named exec / founder at Swiggy / Zomato / Blinkit / Zepto / BigBasket.
- **First brand integrations.** 2–3 named Calmosis customers + 1–2 non-Calmosis D2C founders.
- **Stay / service lighthouse.** One homestay operator or Urban Company–style services brand willing to integrate.
- **Travel lighthouse.** One bus operator or OTA willing to integrate (RedBus contact? Yatra? ixigo?).
- **User identity model.** OAuth + own identity service vs. Sign-in-with-Apple/Google + delegate context per agent — to be designed in implementation plan.
- **Orchestration infra architecture.** How the consumer app and third-party orchestrators route intent across agents, rank, disambiguate, fallback — implementation-plan phase.

---

## 13. Competitive landscape and differentiation

As of April 2026, the agentic commerce protocol space has three named competitors, all announced within the last 90 days. OpenKarta is the only one that is (a) genuinely vendor-neutral (not tied to one AI surface), (b) multi-vertical on day one (not product-only), and (c) purpose-built for non-US payment rails and emerging markets.

| Protocol | Owner | Launched | Vertical coverage | Primary surface | Neutrality |
|---|---|---|---|---|---|
| **ACP** (Agentic Commerce Protocol) | OpenAI + Stripe | Oct 2025 | Product only | ChatGPT checkout | Captive to ChatGPT; Stripe is the payment rail by design |
| **UCP** (Universal Commerce Protocol) | Google + Shopify/Etsy/Wayfair/Target/Walmart (20 partners) | Jan 2026 | Product only | Google Shopping / Gemini | Captive to Google's retail partners; US/Western catalogue |
| **OCP** (Open Commerce Protocol) | Deeplumen | Mar 2026 | Product only | OpenClaw consumer agent | Single-vendor governance; vendor-authored spec |
| **Trusted Agent Protocol** | Visa | Oct 2025 | Payment auth layer only (not full commerce) | Any — it is a framework | Neutral but narrow: auth only, not catalogue / quote / fulfilment |
| **Agentic tokens framework** | Mastercard | 2025 | Payment auth layer only | Any — it is a framework | Neutral but narrow: tokens, not a commerce protocol |
| **OpenKarta** | Us | v0.1 ships 2026-Q2 | `product` + `stay` + `flight` + `bus` + `service` + quick-commerce | Neutral (our app + Claude + ChatGPT + Gemini + any MCP client + WhatsApp) | Structurally neutral: no vertical integration, India-first rails (UPI, COD, GST, ONDC), data sharing with platforms, multi-MoR |

### 13.1 Where OpenKarta wins

1. **Category breadth.** Every named competitor is product-only. OpenKarta is the only protocol where booking a hotel, a bus ticket, a salon appointment, and ordering groceries use the same 8 verbs. A platform integrating us gets stay + service + travel for free; integrating OpenAI ACP gets only retail checkout.
2. **Neutrality.** OpenAI owns ChatGPT, Google owns Shopping, Deeplumen owns OpenClaw — each protocol's adoption surface is its owner's AI product. We do not own an AI surface; our incentive is to route the merchant's transaction wherever the user's orchestrator lives.
3. **Emerging-market rails.** UPI, COD, GST invoicing, vernacular intent, ONDC alignment, RBI compliance, data residency. Global players will reach this in year 2–3 at best; we ship it v0.1.
4. **Payment orchestration that works globally.** Razorpay Routes (India) + Stripe Connect (everywhere else) via the same `paymentOptions` schema. Merchants can accept USD, INR, IDR, BRL from day one. OpenAI ACP is Stripe-captive; Google UCP uses partner rails.
5. **Merchant trust.** An integrator asking "will my customer data / private label / margin eventually be used against me?" gets a contractual and charter-level no from us and a plausible-but-unprovable no from OpenAI/Amazon. This is not a small moat — Swiggy / Zomato / Myntra will not integrate with ChatGPT on any terms short of structural commitments.

### 13.2 Where we do not compete head-to-head

We do not win at US retail checkout volume in year 1. OpenAI ACP has Shopify + Stripe distribution on tap. Google UCP has Target + Walmart + Shopify. We win at (a) non-US markets the incumbents are deprioritising, (b) verticals the incumbents don't cover, (c) platforms who specifically distrust OpenAI/Google's neutrality.

### 13.3 Open-source posture given the landscape

All three named competitors ship open specs (OpenAI ACP on GitHub, Google UCP is an "open standard", Deeplumen OCP is branded "open"). Closed is not viable — it would mean zero adoption. Our openness is table stakes; our defensibility is the structural commitments above plus execution speed on verticals + EM rails.

---

## 14. What investors will hammer us on, and our answer

**Q: Why will a platform (Swiggy, Yatra, Airbnb) not build its own reception agent and expose it directly to ChatGPT? And aren't *you* also putting yourself between them and the customer via your app?**

A: The second half is fair. We are not non-mediators — when a user transacts via our iOS app, we mediate the relationship, like ChatGPT would. Our defence is that we are a **structurally different kind of mediator** because of commitments OpenAI and Amazon structurally cannot match:

1. **One integration, every surface.** Our protocol routes through our app + Claude + ChatGPT + Gemini + WhatsApp bots + every future agent. A direct ChatGPT integration gives them one surface; ours gives N.
2. **No vertical integration. Ever.** Contractual commitment never to sell products, launch private labels, or compete with integrators. OpenAI and Amazon will eventually prefer their own SKUs — our charter forbids it.
3. **Platform-friendly data sharing.** Identity, purchase history, intent signals flow back within user consent. OpenAI hoards for training.
4. **India-first regulatory posture.** ONDC-aligned, UPI-native, data residency in India, RBI-compliant. Platform identity preserved everywhere.
5. **SDK leverage.** Voice, disambiguation, multilingual, fraud, returns — out of the box. A platform would spend 12–18 months rebuilding this per AI surface.

**Q: Why will users adopt a new app when they have Swiggy / Zomato / Amazon / MakeMyTrip installed?**
A: We do not try to beat single-platform apps. We win at **bundled intent across verticals** — "plan my weekend", "book my Goa trip — flight + stay + spa", "order my Sunday groceries from whoever has stock fastest". No existing app owns multi-vertical bundled intent. This is our consumer wedge.

**Q: OpenAI, Google, and Deeplumen have already shipped commerce protocols. Isn't that game over?**
A: No — see Section 13 for full comparison. Short version: all three are product-only and captive to their owner's AI surface. OpenKarta is the only multi-vertical, vendor-neutral protocol. Their existence validates the category without foreclosing the neutral-rail position. The three structurally cannot match our commitments (no vertical integration, no data hoarding, platform identity preserved) without cannibalising their own core business. This is the Stripe-vs-PayPal dynamic: neutral infrastructure coexists with platform-captive payments because merchants need both and trust them differently.

**Q: Why ship 5 item types in v0.1? Isn't that scope creep?**
A: The alternative is shipping product-only, then rewriting the schema when stay or travel becomes real — which forces v0.2 breaking changes and makes us look like a retail-only company. Adding 4 item types to discriminated unions costs ~2 weeks of Plan 01. Converting a product-only protocol to multi-vertical later costs a quarter and loses us the "global infrastructure" positioning.

---

## 15. What this spec explicitly rejects

- Marketplace-first / consumer-app-as-identity positioning.
- Conversational (LLM-per-merchant) protocol shape.
- Free-for-platforms / paid-for-users model.
- Closed protocol.
- WhatsApp-first consumer surface.
- Merchant-of-record from day one.
- **Product-only v0.1.** Expanded from the 2026-04-23 spec to cover five item types on day one.
- **Heterogeneous carts in v0.1.** One `itemType` per cart; cross-type bundling is orchestrator-side.
- **Freeform JSON with brand-side LLMs.** Considered and rejected: money movement requires a structured core with closed error vocabulary, signed quote tokens, and deterministic state machines. LLM mediation lives at the orchestrator edge, not inside the payment rail.
