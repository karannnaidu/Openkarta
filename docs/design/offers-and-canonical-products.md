# Offers and Canonical Products

**Status:** design note for a future spec revision (post-v0.1)
**Why now:** as soon as more than one merchant lists the same physical product (Nike on `nike.karta` and on `amazon.karta` reselling Nike), the v0.1 model breaks down. This note captures the design before we hit that wall, so v0.2 isn't a forced rewrite.

## The current shape (v0.1)

In v0.1, `ItemBase` carries seller identity and price together:

```
ItemBase {
  id, brandId, title, description, images,
  priceMinor, currency, metadata
}
```

Each `*Item` (`ProductItem`, `StayItem`, `FlightItem`, `BusItem`, `ServiceItem`) extends `ItemBase`. Search returns `Item[]` from one agent at a time. The consumer agent merges results across agents.

This works while every product has exactly one seller. It does not give the consumer agent a way to say "these two `ProductItem` records from two agents are the same Nike Pegasus 41."

## The split (proposed for v0.2)

Two primitives instead of one. The seller-bound shape becomes `Offer`; a new seller-independent `Product` carries canonical identity.

```
Product (canonical, shared across sellers)   Offer (per seller)
──────────────────────────────────────       ─────────────────────────
productId          (stable)                  offerId
productIdScheme    (gtin / iata-route / …)   productId        ← join key
aliases[]          (other valid IDs)         sellerId         (= brandId today)
title, description, images                   priceMinor + currency
attributes {}                                inventoryStatus
category[]                                   shipsFrom
                                             deliveryPromise
                                             returnPolicy
                                             reviewAttestations[]
                                             validUntil
```

### Canonical product ID schemes

| Vertical | Preferred scheme              | Fallback                                                       |
| -------- | ----------------------------- | -------------------------------------------------------------- |
| Goods    | `gtin:<14-digit>`             | `sku-hash:<sha256(brand|model|variant)>`                       |
| Flights  | `iata-route:<carrier>:<flightNo>:<depDate>` | n/a                                              |
| Stays    | `property:<brand>:<propertyCode>` (brand-scoped) | n/a                                         |
| Buses    | `bus-route:<operator>:<routeId>:<date>:<departure>` | n/a                                       |
| Services | (skip — services are inherently per-provider; keep flat as today)         |

A product MAY publish `aliases[]` so the same physical SKU resolves identically when one seller has only an internal SKU and another has the GTIN.

### Offer fields beyond what's already in v0.1

- **`deliveryPromise`** — replaces today's loose ETA notion with a binding SLA:
  ```
  deliveryPromise: {
    mode: 'instant' | 'same_day' | 'scheduled' | 'pickup' | 'standard',
    etaFrom: ISO-8601, etaTo: ISO-8601,
    confidence: 'guaranteed' | 'best_effort',
    sla: { onLateRefundMinor: number, onMissRefundMinor: number }
  }
  ```
  When `confidence = 'guaranteed'`, the seller's signature on the offer commits them to the SLA refund terms on miss. Consumer agents SHOULD visibly derank `best_effort`.

- **`reviewAttestations[]`** — see below.

- **`validUntil`** — offer carries an expiry (similar to today's quote `expiresAt`, but at the offer level). Past expiry, the consumer agent re-fetches.

### Reviews via attestations (not self-served)

Offers do **not** carry their own review scores. They carry attestations — signed bundles from independent review operators:

```
reviewAttestation: {
  attesterId:    string,        // e.g. 'trustpilot.karta'
  attesterKeyId: string,        // registry-resolvable
  scope:         { productId? , sellerId? },
  score:         number (0..5),
  count:         number,
  window:        { from, to },
  methodology:   URL,
  issuedAt:      ISO-8601,
  signature:     string
}
```

The consumer agent decides which attesters it trusts. The registry publishes attester pubkeys but does not endorse them. This keeps review competition open and prevents a single review monopoly from replicating itself on the protocol.

### Search response shape

Today: `{ "items": Item[] }` per agent.
Proposed: `{ "products": Product[], "offers": Offer[] }` per agent — `offers[i].productId` joins to `products[j].productId`.

The orchestrator (`packages/orchestrator/src/rank.ts` today) groups offers across agents by product and ranks within each group per the user's stated preferences (price, speed, trust, sustainability). The registry stays out of ranking entirely.

## Migration impact

| Module                                  | Change                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `packages/spec/src/items/base.ts`       | Rename `ItemBase` → `OfferBase`; keep field set but rename `brandId` → `sellerId`. |
| `packages/spec/src/items/{product,…}.ts`| Each becomes a per-vertical `Offer` shape. Add per-vertical `Product` shape alongside. |
| `packages/spec/src/search.ts`           | `SearchResponse` returns `{ products, offers }` instead of `items`.     |
| `packages/spec/src/quote.ts`            | `Quote.lineItems[].itemId` → `offerId` (join still works through `offers`). |
| `packages/spec/src/manifest.ts`         | `CapabilitiesManifest` gains `supportedProductIdSchemes: string[]`.     |
| `packages/orchestrator/src/rank.ts`     | Group by `productId` before applying user preferences.                  |
| `packages/orchestrator/src/search.ts`   | Merge `offers[]` across agents, dedupe by `productId`.                  |
| `packages/conformance-tests/`           | New pack: canonical-ID resolution + cross-seller dedupe.                |
| `docs/protocol/v0.1.md`                 | Successor doc `docs/protocol/v0.2.md` for the new shape; v0.1 stays frozen. |

The `Order` and `Refund` shapes don't need changes — they're per-seller already.

## Open questions

1. **Canonical authority when no GTIN exists.** Three options:
   1. First seller wins (timestamp-based).
   2. Registry-side canonicalisation service (centralisation pressure).
   3. Tolerate duplicates — consumer agent fuzzy-matches.
   Lean: (3) for v0.2, revisit if it becomes a UX pain.

2. **Cross-seller carts.** Today, a cart binds to one agent. Should v0.2 allow a consumer-agent-orchestrated multi-seller cart with per-seller sub-orders? Lean: defer to v0.3 — v0.2 keeps the one-cart-one-seller invariant so the migration stays bounded.

3. **Attestation discovery.** Does the registry index attestations by product/seller, or do attesters expose their own endpoint? Lean: attesters expose endpoints; registry only resolves their identity. Keeps the registry minimal.
