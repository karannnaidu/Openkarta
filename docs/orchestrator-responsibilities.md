# Orchestrator responsibilities

> **Status:** working document. Defines what `@openkarta/orchestrator` does for consumer-agent authors so they don't reinvent the same plumbing in every app.
> **Companion docs:** [`security-model.md`](./security-model.md), [`checkout-data-model.md`](./checkout-data-model.md), [`why-brand-endpoints.md`](./why-brand-endpoints.md).
> **Last reviewed:** 2026-04-26.

The orchestrator is the **commerce SDK** for everyone building on the consumer side — startups making ChatGPT shopping plugins, devs wiring up Claude tool-calls, custom CLI tools, future iOS apps. Without it, every consumer-agent author has to learn the protocol, the signing rules, the manifest schema, the per-item-type validation, the idempotency semantics, and the identity-JWT flow. With it, they call three or four functions and the protocol takes care of itself.

This doc is the contract: what the orchestrator does, what it explicitly does *not* do, and where the responsibility line sits.

---

## 1. Why an orchestrator at all

Picture the alternative. A consumer-agent author who wants to support OpenKarta would have to:

1. Read the protocol spec (60 pages).
2. Implement registry lookup with caching and revocation handling.
3. Fetch and cache brand manifests.
4. Mint Ed25519 identity JWTs per request.
5. Generate the per-item-type prompt list from the brand's checkout schema.
6. Validate user input against the schema (different per item type).
7. Call `/v0/quote`, parse signed quote tokens, store them with TTLs.
8. Call `/v0/checkout` with idempotency keys, retry safely on network failures.
9. Poll `/v0/orders/:id/status` with backoff.
10. Cache user profiles for reuse, with consent.

That's 2–3 weeks of work per consumer-agent author. Multiplied across every team that wants to ship — the protocol gets stuck.

The orchestrator does all of it once, in a library, well-tested. The consumer-agent author gets to focus on UX and conversation design. **The fewer things every consumer agent has to get right, the more consumer agents exist.**

---

## 2. Responsibility split

```text
   USER                                                                           BRAND
     │                                                                              │
     │ "Book me a flight BLR → GOA tomorrow"                                        │
     ▼                                                                              │
   ┌──────────────────┐    ┌──────────────────────────┐    ┌──────────────────┐    │
   │ Consumer agent   │    │ @openkarta/orchestrator  │    │ Brand endpoints  │    │
   │ (ChatGPT plugin, │◀──▶│                          │◀──▶│ /v0/discover     │◀───┘
   │  Claude tool,    │    │ - registry lookup        │    │ /v0/search       │
   │  custom app)     │    │ - manifest fetch + cache │    │ /v0/quote        │
   │                  │    │ - schema fetch + cache   │    │ /v0/checkout     │
   │ Owns:            │    │ - identity JWT mint      │    │ /v0/orders/...   │
   │  - prompt UX     │    │ - local validation       │    │                  │
   │  - copy/voice    │    │ - idempotency + retries  │    │                  │
   │  - rendering     │    │ - quote-token storage    │    │                  │
   │  - LLM calls     │    │ - profile cache (opt-in) │    │                  │
   │  - which brand   │    │ - status polling         │    │                  │
   │    to choose     │    │                          │    │                  │
   └──────────────────┘    └──────────────────────────┘    └──────────────────┘

      AGENT AUTHOR              OPENKARTA TEAM                 BRAND OPERATOR
      WRITES THIS               WRITES THIS                    WRITES THIS
```

**The line is sharp:** the orchestrator never talks to the user, never makes UX decisions, never calls an LLM, never decides which brand to choose. The consumer agent never talks to brand endpoints directly, never mints JWTs, never validates schemas, never handles idempotency.

---

## 3. Public API surface

The orchestrator exposes about a dozen functions. Sketch (final shape lives in `@openkarta/orchestrator`):

```typescript
import { createOrchestrator } from '@openkarta/orchestrator';

const orch = createOrchestrator({
  consumerAgentId:    'acme-shop-bot-v1',
  privateKeyPath:     '/secure/path/key.pem',          // or KMS reference
  registryUrl:        'https://registry.openkarta.org',
  cacheTtl:           { manifest: '24h', schema: '24h', publicKey: '24h' },
  userProfile:        loadCachedProfile(),              // optional
});

// 1. DISCOVERY — find brands serving an itemType
const brands = await orch.discover({
  itemType:  'flight',
  region:    'IN',
  filters:   { date: '2026-05-15', from: 'BLR', to: 'GOA' },
});

// 2. SEARCH — fan out to candidate brands in parallel
const offers = await orch.search({
  brands,
  query:    { itemType: 'flight', from: 'BLR', to: 'GOA', date: '2026-05-15', passengers: 1 },
  parallel: true,
});

// 3. INSPECT REQUIREMENTS — what does the agent need to ask the user?
const requirements = await orch.getCheckoutRequirements({
  brandId:        offers[0].brandId,
  itemType:       'flight',
  fulfilmentMode: 'standard',
});
// → { alwaysRequired: ['user.name','user.phone','user.email'],
//     itemSpecific:   [ { field: 'passengers[].title', enum: [...] }, ... ],
//     cachedFromProfile: ['user.name','user.email','user.phone',
//                          'passengers[0].passport.*'] }

// 4. QUOTE — once user has chosen, lock the price
const quote = await orch.quote({
  brandId:    offers[0].brandId,
  cart:       offers[0].cart,
});

// 5. VALIDATE — orchestrator runs the schema locally
const validation = orch.validateCheckoutPayload({
  brandId:     offers[0].brandId,
  itemType:    'flight',
  user:        { name, phone, email },
  fulfilment:  { /* per item type */ },
  payment:     { processorRef, methodToken },
});
if (!validation.ok) return showFieldErrors(validation.errors);

// 6. CHECKOUT — orchestrator handles idempotency, JWT mint, retry
const order = await orch.checkout({
  brandId:    offers[0].brandId,
  quoteToken: quote.token,
  user, fulfilment, payment,
  userIdentityAssertion,                                // optional
});

// 7. STATUS — poll with backoff
for await (const status of orch.watchStatus({ orderId: order.id })) {
  agent.notifyUser(status);
  if (status.terminal) break;
}
```

That's the full happy path, end-to-end, in seven calls. Cancel and return work the same way (`orch.cancel`, `orch.return` — both with idempotency built in).

---

## 4. What the orchestrator does internally

### 4.1 Registry interactions

- Resolves `brandId` → `manifest URL` via the registry.
- Caches the directory locally with TTL (default 1 hour) and revalidates on cache miss.
- Handles registry-side revocation: if a brand's status flips to `revoked` or `delisted`, the orchestrator marks subsequent calls as failed with `brand_unavailable` and does not retry against the same brand.

### 4.2 Manifest + schema fetch

- On first contact with a brand, fetches `/v0/discover`, validates the manifest against `@openkarta/spec`, and caches it (default 24h, configurable).
- Fetches the per-item-type `checkoutSchema` URLs declared in the manifest, caches them.
- On schema-version bump (manifest declares `checkoutSchemaVersion`), invalidates the cached schema and re-fetches.

### 4.3 Identity JWT minting

- Loads the consumer-agent's Ed25519 private key from configured storage (filesystem path, KMS, HSM — pluggable).
- Mints a fresh JWT for every outbound request to a brand endpoint with: `iss` (consumer agent ID), `aud` (target brand), `iat`, `exp` (≤ 60s), `jti` (random nonce).
- Signs with EdDSA. Microseconds.
- Attaches as `Authorization: Bearer <jwt>`.

### 4.4 Local validation

- Generates a Zod schema from the fetched `checkoutSchema` JSON Schema.
- Validates the assembled payload before submission.
- Returns structured field-level errors the agent can render.
- Catches: missing required fields, wrong formats, IATA character violations, expired passports, country-code mismatches, malformed phone numbers, etc.

### 4.5 Quote-token round-tripping

- Stores quote tokens in memory with their declared `expiresAt`.
- Refuses to call `/v0/checkout` against an expired token (avoids a useless network round-trip).
- Re-quotes on expiry if the consumer agent asks to retry.

### 4.6 Idempotency + retries

- Generates a UUID v4 idempotency key per `checkout` / `cancel` / `return` call.
- Persists the key + payload hash for at least 24h (in-memory by default, pluggable to Redis/SQLite for long-running agents).
- On network failure: retries with exponential backoff (250ms, 500ms, 1s, 2s, 4s — capped at 5 retries) using the *same* idempotency key. The brand's idempotency contract guarantees this is safe.
- On `idempotency_key_conflict` from brand: surfaces a hard error; consumer agent should not retry.

### 4.7 Profile caching (opt-in)

- The consumer agent can pass a `userProfile` blob at initialisation time.
- The orchestrator pre-fills payload fields from the profile during `getCheckoutRequirements()`, so the agent only prompts for what's missing.
- Profile schema is intentionally small: `name`, `phone`, `email`, optionally `passport`, `addresses[]`, `paymentMethods[]` (tokens only, no raw cards).
- The consumer agent is responsible for storing the profile securely on its side. The orchestrator never persists it across instantiations.

### 4.8 Status polling

- `watchStatus()` returns an async iterator.
- Backoff schedule: 5s, 10s, 15s, 30s, 60s — then steady at 60s until terminal.
- Stops on terminal states: `delivered`, `cancelled`, `returned`, `failed`.
- Surfaces brand-side webhook delivery if the agent is long-running and has a webhook URL configured (advanced mode; not required for v0.4).

---

## 5. What the orchestrator does NOT do

This list is as important as §4. Drift here is what makes libraries bloated.

- **No LLM calls.** The orchestrator never invokes a language model. The consumer agent's chat loop does that.
- **No prompt generation.** Returns *structured requirements*, not prompt strings. The agent author writes the prompts (because tone, voice, locale, modality all differ per app).
- **No UI rendering.** No React components, no terminal UI, no voice synthesis. The agent renders.
- **No payment-method tokenisation.** The agent calls Stripe/Razorpay directly to get the `methodToken`. Orchestrator just carries the token to the brand.
- **No user authentication.** The agent's auth flow (Sign in with Google, phone OTP, etc.) is the agent's job. Orchestrator just attaches the resulting `userIdentityAssertion` if the agent provides one.
- **No "which brand should I pick" decision.** Returns ranked candidates with raw signals (price, ETA, badges); the agent (or its LLM) decides.
- **No persistent storage by default.** Idempotency-key store, manifest cache, schema cache are all in-memory unless a backend is plugged in. Long-running agents configure SQLite/Redis adapters.
- **No fraud detection.** That's a brand-side and processor-side concern.
- **No fallback to scraping or generic APIs.** If a brand isn't OpenKarta-conformant, the orchestrator surfaces `brand_not_supported`. It doesn't try to be clever.

---

## 6. Caching strategy

| Resource | Default TTL | Invalidation trigger |
|---|---|---|
| Registry directory | 1h | Cache miss; explicit `orch.refreshRegistry()` |
| Brand manifest | 24h | Cache miss; manifest version bump |
| Checkout schema | 24h | Cache miss; manifest declares new `checkoutSchemaVersion` |
| Brand HMAC public-key (for verifying webhook payloads, when applicable) | 24h | Cache miss |
| Consumer-agent's own private key | persistent | Manual rotation only |
| Quote tokens | per token's `expiresAt` (typically 5 min) | TTL |
| Idempotency-key records | 24h | TTL |
| User profile | session-lifetime (in-process) | Agent reload |

All caches are per-orchestrator-instance unless an external store is plugged in. Multi-process consumer agents that want shared cache (e.g., a fleet of containers) plug in Redis via a configured adapter.

---

## 7. Error surface

The orchestrator translates protocol-level closed-enum errors into typed exceptions the agent can `instanceof`-check:

```typescript
try {
  await orch.checkout({ ... });
} catch (e) {
  if (e instanceof OrchestratorError) {
    switch (e.code) {
      case 'quote_token_expired':         return askToReQuote();
      case 'fulfilment_schema_violation': return showFieldErrors(e.errors);
      case 'payment_authorisation_failed': return askForDifferentCard();
      case 'inventory_unavailable':       return showOutOfStockMessage();
      case 'brand_unavailable':           return tryNextCandidate();
      // ...
    }
  }
  throw e;  // unknown — bubble up
}
```

Error codes are the same closed enum as the protocol (see [`security-model.md`](./security-model.md) §6 and [`checkout-data-model.md`](./checkout-data-model.md) §7). The orchestrator adds a small set of client-side ones (`brand_unavailable`, `network_failure_after_retries`, `local_validation_failed`) that never reach the wire.

---

## 8. Implementation notes

### 8.1 Cross-runtime targeting

The orchestrator should compile to:

- **Node.js** (today — already shipped in `@openkarta/orchestrator`).
- **Browser / edge runtimes** (next — for client-side agents and Cloudflare-Workers-based agents). Requires WebCrypto for Ed25519 instead of Node's `crypto`.
- **Python** (per ROADMAP — for AI/data teams who don't write Node).
- **Go and Java** (later, demand-driven — likely community contributions).

The wire protocol and contract are language-agnostic. Each implementation re-derives the same surface from `@openkarta/spec`.

### 8.2 Bundling for browsers

The Node version pulls in too much (filesystem-based key storage, Node's HTTP agent). The browser build:

- Replaces filesystem key storage with WebCrypto + IndexedDB (encrypted at rest with a passphrase).
- Replaces Node `http` with `fetch`.
- Drops the Redis adapter (browsers don't need it).

Target ≤ 30KB gzipped for the browser build. No runtime LLM calls; that stays the agent's responsibility.

### 8.3 Test surface

Every orchestrator implementation MUST pass the consumer-side conformance pack: a fixture set that exercises every verb against a known set of reference brand endpoints, with negative cases for every closed-enum error. Lives in `@openkarta/conformance-tests` under the `consumer-side/` namespace.

### 8.4 Versioning

The orchestrator's major version tracks the protocol's major version. `@openkarta/orchestrator@0.4.x` speaks protocol v0.4. Mixed-version sessions are not supported; the orchestrator refuses to talk to a brand whose `protocolVersion` doesn't match its own major.

---

## 9. Open questions

These should be resolved before v0.4 of the orchestrator ships.

1. **Should the orchestrator handle the OAuth/OIDC flow for `userIdentityAssertion`, or is that always the agent's job?** Recommendation: agent's job — too many provider-specific quirks (Google's PKCE, Apple's nonce semantics, ONDC's session model). Orchestrator just *carries* the resulting assertion.
2. **Is the per-call JWT minting fast enough on browser/edge runtimes (WebCrypto Ed25519)?** Needs benchmarking. Acceptable budget: ≤ 5ms per call. Below that, ship as-is.
3. **Should `getCheckoutRequirements()` inline a default prompt-string set (in English, with placeholders), so agent authors can ship a prototype without writing copy?** Recommendation: yes for v0.4, marked clearly as "prototype-only — write your own copy for production". Reduces time-to-first-checkout.
4. **Should the orchestrator support webhook receivers for status updates instead of polling?** Recommendation: yes — separate adapter (`createWebhookReceiver`) so polling stays the default and webhooks are an opt-in for long-running agents with public URLs. Defer to v0.5 if scope-pressed.
5. **Multi-brand parallel search: how many brands to fan out to by default?** Currently unlimited. Probably want a sensible cap (e.g., 8) with an opt-out, to avoid amplifying agent traffic against the registry on broad queries.
