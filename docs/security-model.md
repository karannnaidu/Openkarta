# OpenKarta security model

> **Status:** working document. Captures the threat model OpenKarta defends against today, the security primitives already in the v0.1 spec, the gap that needs to close in v0.4 (consumer-agent identity), and operator best practices.
> **Audience:** brand-endpoint operators, consumer-agent operators, security reviewers, the OpenKarta Foundation.
> **Last reviewed:** 2026-04-26.

This is the doc that should be linked from every brand security review and every consumer-agent operator's onboarding flow.

---

## 1. Scope and shape

OpenKarta has two trust boundaries:

```text
   CONSUMER SIDE                                            BRAND SIDE
   ─────────────                                            ──────────

   ┌──────────┐      ┌──────────────────┐         ┌───────────────────┐      ┌──────────┐
   │  User    │ ───▶ │ Consumer agent   │ ──────▶ │  Brand endpoints  │ ───▶ │  Brand   │
   │          │      │ (ChatGPT, your   │  HTTP   │  (eight verbs at  │      │ backend  │
   │          │      │  app, Claude…)   │ + JWT   │   one URL prefix) │      │ + DB     │
   └──────────┘      └──────────────────┘         └───────────────────┘      └──────────┘
                                                            │
                                                            │ verifies signatures
                                                            ▼
                                                  ┌───────────────────┐
                                                  │  OpenKarta        │
                                                  │  Registry         │
                                                  │  (public keys,    │
                                                  │   revocation,     │
                                                  │   directory)      │
                                                  └───────────────────┘
```

This document covers only the **OpenKarta surface** — what travels across those boundaries. Brand-side internal security (database hardening, employee access, payment-processor integration) is out of scope. Consumer-agent-side internal security (model jailbreaks, prompt injection from page content) is also out of scope — those are LLM-platform concerns, not protocol concerns.

---

## 2. Threat model

| # | Threat | Surface | Mitigation in v0.1 | Gap |
|---|---|---|---|---|
| T1 | **Price tampering between quote and checkout** ("the price changed at checkout") | `quote` → `checkout` | HMAC-signed quote tokens, 5-min TTL, brand verifies its own signature | None |
| T2 | **Replay of a successful checkout** | `checkout`, `cancel`, `return` | Idempotency keys required by spec; same key → same outcome | None |
| T3 | **Forged checkout against a stolen quote token** | `checkout` | Quote token is HMAC-signed by brand's secret — unforgeable. Bound to specific cart + currency + total | None |
| T4 | **Catalogue / inventory scraping** | `search`, `get` | No worse than scraping the brand's existing public website | Add rate-limit headers in spec |
| T5 | **Pricing-logic probing via repeated `quote` calls** | `quote` | Quote-token mint cost is real (signing); brands can rate-limit | No spec'd rate-limit envelope |
| T6 | **Information leak via verbose error messages** | All verbs | Closed-enum errors — only allowed strings, no free-form leakage | None |
| T7 | **Order data exposure to wrong party** | `status`, `cancel`, `return` | Spec defines user-delegation tokens (issued at checkout); brand verifies delegation before returning order data | Delegation-token issuance flow needs a stricter RFC |
| T8 | **DDoS / volumetric abuse** | All verbs | Standard ops concern (Cloudflare / WAF / load balancer) — protocol-orthogonal | None |
| T9 | **Unauthenticated caller — anyone can hit `/v0/quote`** | All verbs | **Currently nothing** — the spec doesn't define caller identity | **This is the v0.4 gap.** See §4. |
| T10 | **Misbehaving consumer agent (fraud, scraping, impersonation) cannot be revoked** | All verbs | Brand can IP-block, but no protocol-level revocation | Consumer-agent identity + registry revocation. See §4. |
| T11 | **Compromised brand signing key** | `quote` token | Brand rotates secret; quote tokens carry a `kid` (key id) field so older valid tokens still verify under prior key | Document rotation flow explicitly |
| T12 | **Compromised consumer-agent private key** | All verbs | n/a in v0.1 (no consumer-agent identity yet) | Closed by §4 — registry revocation propagates within cache TTL |
| T13 | **Man-in-the-middle on the wire** | All verbs | TLS required by spec; all OpenKarta URLs must be HTTPS | None |
| T14 | **Quote token leaks via consumer-agent logs** | `quote` → `checkout` | Tokens are short-lived (5 min) and bound to one cart; reuse is constrained by T3 | Document log-redaction guidance |
| T15 | **Cross-site request forgery from a hostile webpage to a brand endpoint** | All verbs | Brand endpoints are pure JSON APIs without browser-cookie auth — CSRF not applicable | None |

The threats numbered T9 and T10 — **caller authentication** and **revocation** — are the only structural gaps in the model today. The rest are either solved or are operator-discipline issues. The next four sections close those gaps.

---

## 3. What's already in v0.1

For completeness, the security primitives the protocol already mandates:

1. **HTTPS-only.** All OpenKarta URLs (manifest, verbs, registry) must be served over TLS 1.2+.
2. **HMAC-signed quote tokens.** Every successful `/v0/quote` returns a token signed with the brand's secret; checkout requires the brand to verify its own signature. Tokens carry: `cart`, `currency`, `total`, `expiresAt`, `kid`, `signature`.
3. **Idempotency on writes.** `checkout`, `cancel`, `return` require an idempotency key. Same key + same payload = same response. Different payload + same key = `idempotency_key_conflict`.
4. **Closed enum errors.** Every error from a brand endpoint is one of a defined string set. No free-form error messages — eliminates information leakage and lets clients handle errors deterministically.
5. **User-delegation tokens.** For `status` / `cancel` / `return`, the user (via the consumer agent) presents a delegation token issued by the brand at checkout time, asserting "this user is allowed to act on this order". Verified server-side by the brand.
6. **Integer minor units.** All prices are integers in minor currency units (paise, cents). No floating-point rounding bugs at quote vs charge time.
7. **Cart homogeneity.** Mixed-itemType carts are rejected with `cart_must_be_homogeneous`. Removes a class of integrity bugs at the seam between item types.

These primitives close T1–T8, T11, T13, T14, T15. The unfinished work is T9, T10, T12 — caller identity and revocation.

---

## 4. The v0.4 gap — consumer-agent identity

**The problem.** Today the OpenKarta spec doesn't define how a brand authenticates the *consumer agent* calling its endpoints. Anyone with the URL can hit `/v0/search` or `/v0/quote`. That's fine for read paths in casual demos but it's a gap for production use — brands legitimately want to allowlist agents they trust, rate-limit per agent identity, and revoke a key if an agent misbehaves.

**The solution.** Make the OpenKarta registry act as an identity provider for consumer-agent operators (in addition to its existing role as a directory of brand endpoints). Every consumer-agent operator gets a `consumerAgentId` and an Ed25519 keypair. They sign a short-lived JWT per request. Brands verify the JWT against the operator's public key, which they fetch (and cache) from the registry.

This is additive — no breaking change to the eight verbs. Brands that don't care can ignore the JWT and serve any caller. Brands that do care can require it and allowlist specific issuers.

The four flows below are the canonical reference. They are normative for v0.4.

### 4.1 Onboarding (one-time, per consumer-agent operator)

```text
   ┌──────────────────┐
   │ Consumer-agent   │  "I'm building a shopping app on OpenKarta."
   │ operator         │
   └────────┬─────────┘
            │  1. Sign up at registry.openkarta.org
            ▼
   ┌──────────────────────────────────────────────────────┐
   │  OpenKarta Registry                                  │
   │                                                      │
   │  - Verifies operator email + identity                │
   │  - Generates:                                        │
   │      consumerAgentId  =  "acme-shop-bot-v1"          │
   │      keypair          =  Ed25519                     │
   │      publicKey  →  published at                      │
   │                    /v0/consumer-agents/:id/key.json  │
   │      privateKey →  returned ONCE to operator         │
   │  - Records: operator name, contact, abuse@, ToS      │
   └────────┬─────────────────────────────────────────────┘
            │  2. operator stores privateKey in HSM / KMS
            ▼
   ┌──────────────────┐
   │ Consumer agent   │  Ready to call brand endpoints.
   │ runtime          │
   └──────────────────┘
```

**Notes**
- `consumerAgentId` is human-readable, lowercase, kebab-case, globally unique. Examples: `acme-shop-bot-v1`, `anthropic-claude-shop`, `openai-chatgpt-commerce`.
- The private key is returned to the operator **exactly once**. The registry does not retain it. Re-issuance requires generating a new keypair and rotating.
- Operators must store the private key in an HSM, KMS, or equivalent — never in plaintext, never in environment variables checked into source control.
- ToS acceptance includes an abuse-handling commitment: the operator agrees to respond to abuse reports within an SLA (proposed: 72h).

### 4.2 Per-request (every call to a brand endpoint)

```text
 USER             CONSUMER AGENT                        BRAND ENDPOINT                       REGISTRY
 ────             ──────────────                        ──────────────                       ────────
   │                    │                                       │                                 │
   │ "buy me coffee"    │                                       │                                 │
   │───────────────────▶│                                       │                                 │
   │                    │                                       │                                 │
   │                    │  1. Mint identity JWT                 │                                 │
   │                    │     (sign with privateKey)            │                                 │
   │                    │                                       │                                 │
   │                    │     payload = {                       │                                 │
   │                    │       iss: "acme-shop-bot-v1",        │                                 │
   │                    │       aud: "halcyon-shop",            │                                 │
   │                    │       iat: 1714128000,                │                                 │
   │                    │       exp: 1714128060,    ← 60s TTL   │                                 │
   │                    │       jti: "<random nonce>"           │                                 │
   │                    │     }                                 │                                 │
   │                    │     signature: <Ed25519>              │                                 │
   │                    │                                       │                                 │
   │                    │  2. POST /v0/quote                    │                                 │
   │                    │     Authorization: Bearer <jwt>       │                                 │
   │                    │──────────────────────────────────────▶│                                 │
   │                    │                                       │                                 │
   │                    │                                       │  3. Decode JWT.                 │
   │                    │                                       │     publicKey for iss cached?   │
   │                    │                                       │                                 │
   │                    │                                       │       ┌─ NO ─────────────────▶ │
   │                    │                                       │       │  GET /v0/consumer-     │
   │                    │                                       │       │  agents/<iss>/key.json │
   │                    │                                       │       │◀────────────────────── │
   │                    │                                       │       │  { publicKey,          │
   │                    │                                       │       │    status: "active" }  │
   │                    │                                       │       │  → cache 24h           │
   │                    │                                       │       └────────                │
   │                    │                                       │                                 │
   │                    │                                       │  4. Run all checks:             │
   │                    │                                       │     ✓ signature valid           │
   │                    │                                       │     ✓ exp not stale             │
   │                    │                                       │     ✓ aud == self               │
   │                    │                                       │     ✓ status == "active"        │
   │                    │                                       │     ✓ jti not replayed (5-min   │
   │                    │                                       │       LRU per iss)              │
   │                    │                                       │     ✓ iss in brand allowlist    │
   │                    │                                       │       (if brand opted in)       │
   │                    │                                       │     ✓ rate-limit per iss        │
   │                    │                                       │                                 │
   │                    │                                       │  5. Serve the quote             │
   │                    │  ◀───────────────────────────────────│  HMAC-signed quote token        │
   │                    │                                       │                                 │
   │                    │                                       │  ── OR ──                       │
   │                    │                                       │                                 │
   │                    │  ◀───────────────────────────────────│  401 / 403 with closed-enum     │
   │                    │                                       │  error:                         │
   │                    │                                       │   - consumer_agent_unknown      │
   │                    │                                       │   - consumer_agent_revoked      │
   │                    │                                       │   - consumer_agent_not_allowed  │
   │                    │                                       │   - identity_token_expired      │
   │                    │                                       │   - identity_token_replayed     │
   │                    │                                       │   - rate_limited                │
```

**JWT envelope (canonical fields).** Header is `{ "alg": "EdDSA", "typ": "JWT" }`. Payload required fields:

| Field | Type | Meaning |
|---|---|---|
| `iss` | string | Consumer-agent ID issued by the registry |
| `aud` | string | Brand-endpoint ID being called (from the brand's manifest) |
| `iat` | int | Issued-at timestamp (seconds since epoch) |
| `exp` | int | Expiry timestamp. Must be ≤ `iat + 60`. Brands MUST reject `exp - iat > 60`. |
| `jti` | string | Random nonce, ≥ 16 bytes of entropy. Brand maintains a per-`iss` LRU of seen `jti`s for the duration of `exp`'s window |

Brands MAY add custom checks but MUST NOT relax these.

### 4.3 Revocation (when an operator misbehaves)

```text
   ┌─────────────────────────────────┐
   │  Abuse reported / fraud caught  │
   └────────────┬────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │  Registry sets                      │
   │    consumer-agents/<id>/status =    │
   │    "revoked"                        │
   │                                     │
   │  /v0/consumer-agents/<id>/key.json  │
   │  now returns status: "revoked"      │
   └────────────┬────────────────────────┘
                │
                ▼  (within cache TTL — usually ≤ 24h)
   ┌─────────────────────────────────────┐
   │  Brand endpoints reject all         │
   │  requests with iss = that id        │
   │  → 403 consumer_agent_revoked       │
   └─────────────────────────────────────┘
```

For brands that need faster propagation than 24 hours, the registry serves `key.json` with `Cache-Control: max-age=300` (5 minutes) at the cost of more registry traffic. Brands choose their cache window per operational risk tolerance.

A future enhancement (post-v0.4) could add a CRL-style streaming endpoint at `/v0/consumer-agents/revocations.ndjson` that brands tail for instant propagation. Not required for v0.4.

### 4.4 User-delegation, layered on top

For `status` / `cancel` / `return` — the verbs that act on a *specific user's* order — the consumer agent attaches **two** tokens:

```text
   POST /v0/orders/:orderId/cancel
   Authorization: Bearer <consumer-agent JWT>      ← who the agent is
   X-User-Delegation: <user delegation token>      ← user authorised this action
```

The brand verifies both:

| Token | Asserts | Verified against |
|---|---|---|
| Consumer-agent JWT | "I am ChatGPT, and I'm allowed to call your endpoints" | Registry-published public key of the consumer agent |
| User delegation token | "User U authorised consumer agent X to cancel order O on my behalf" | Brand's own record of what was delegated to whom (issued at checkout time) |

The two tokens are independent. The agent token can be valid while the delegation token is missing or expired — that's the case where the user logged out but the agent is still calling. The brand returns `delegation_required` and the consumer agent re-prompts the user.

---

## 5. Why JWT-per-request, not a static API key

Static keys are simpler — but they get stolen, leak in logs, and replay forever. A 60-second signed JWT solves all three:

| Concern | Static API key | Signed JWT (60s TTL) |
|---|---|---|
| Steal it from a TLS-terminated proxy log | Reusable forever | Useless after 60s |
| Steal it from an application log | Reusable forever | Useless after 60s |
| Replay it to bypass per-call auth | Always works | Blocked by brand's `jti` LRU |
| Operator key rotation | Manual, painful | Operator publishes new public key; old keypair retires naturally |
| Detect compromise | Hard — looks like normal use | Anomalies in `jti` patterns or key-fetch traffic surface compromise |

The cost of JWT-per-request: the consumer-agent runtime must mint a token per call. Ed25519 signing is microseconds — operationally trivial.

The only argument for static API keys would be developer convenience in local testing. Spec accommodates that with a `dev` mode where brands MAY accept an unsigned `Authorization: Bearer test-<id>` header — but only when the brand's manifest declares `acceptDevKeys: true`. Production brands must not.

---

## 6. Closed-enum security errors

All security-related rejections from a brand endpoint MUST use one of these error strings. No free-form error messages.

| Error | HTTP | Meaning |
|---|---|---|
| `identity_token_missing` | 401 | No `Authorization` header present and brand requires identity |
| `identity_token_malformed` | 401 | Header present but not a parseable JWT |
| `identity_token_expired` | 401 | `exp` is in the past |
| `identity_token_replayed` | 401 | `jti` seen before within the TTL window |
| `identity_token_audience_mismatch` | 401 | `aud` doesn't match this brand |
| `identity_token_signature_invalid` | 401 | Signature failed verification |
| `consumer_agent_unknown` | 403 | `iss` not present in the registry |
| `consumer_agent_revoked` | 403 | `iss` present but `status: "revoked"` |
| `consumer_agent_not_allowed` | 403 | Brand has an allowlist and `iss` is not on it |
| `delegation_required` | 401 | The verb requires a user-delegation token and none was attached |
| `delegation_invalid` | 401 | Delegation token failed verification (signature, expiry, scope) |
| `rate_limited` | 429 | Per-`iss` rate limit exceeded. Response MUST include `Retry-After` header |

Consumer agents MUST handle these deterministically and SHOULD surface a useful, non-technical message to end users (e.g., `consumer_agent_revoked` → "This shopping assistant has been suspended. Please contact your provider.").

---

## 7. Operator best-practice checklists

### For brand-endpoint operators

- [ ] All endpoints served over HTTPS with TLS 1.2+ (1.3 preferred).
- [ ] HMAC signing key stored in HSM or KMS, never in environment variables checked into source control.
- [ ] Signing key rotated at least annually; quote tokens carry `kid` for grace-period verification.
- [ ] Quote-token expiry ≤ 5 minutes.
- [ ] Idempotency-key store retains keys for at least the duration of any retry window (24h recommended).
- [ ] Rate limits per source IP and per `iss` (when v0.4 lands).
- [ ] WAF / DDoS protection in front of the endpoint (Cloudflare, Fastly, AWS WAF, Akamai — operator's choice).
- [ ] Application logs redact: `Authorization` headers, raw JWTs, quote tokens, payment-processor responses.
- [ ] Abuse contact email published in the manifest (`abuse@brand.example.com`).
- [ ] Conformance harness re-run on every protocol-version bump, before going live.
- [ ] On revocation of own brand from the registry: stop serving immediately, do not attempt to re-list without resolving the cause.

### For consumer-agent operators

- [ ] Private key generated by registry, never re-uploaded; stored in HSM/KMS.
- [ ] Identity JWT minted per request; never reused, never logged.
- [ ] `jti` generated from a CSPRNG with ≥ 128 bits of entropy.
- [ ] User-delegation tokens stored with the same care as session tokens; never logged.
- [ ] Abuse contact monitored; SLA on responses ≤ 72 hours.
- [ ] On compromise of private key: rotate via registry immediately, mark old key as revoked, audit logs for misuse window.
- [ ] On user revocation (user said "stop using my data"): drop delegation tokens, do not retry.
- [ ] Logs redact: payment details, delegation tokens, JWTs, full quote tokens (a 6-char prefix is fine for debugging).

---

## 8. v0.4 RFC roadmap

The work to get §4 into the spec, sequenced for minimal disruption:

1. **RFC-0001: Consumer-agent identity primitive.** Defines the JWT envelope, the registry's `/v0/consumer-agents/*` surface, and the brand-side verification rules. Additive only — brands can ignore it.
2. **RFC-0002: Standard rate-limit envelope.** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, plus the `rate_limited` error and `Retry-After`. Additive.
3. **RFC-0003: Delegation-token issuance flow.** Tighten what's already in v0.1 — define the canonical shape, scope grammar, and revocation flow for user delegations. Backward-compatible with v0.1 implementations.
4. **RFC-0004: Brand signing-key rotation.** Document `kid` semantics, grace-period verification, the `key.json` published at the manifest's `/.well-known/openkarta-signing-keys.json`. Mostly already implicit — RFC makes it explicit.
5. **RFC-0005 (post-v0.4): Streaming revocation feed.** Optional NDJSON tail at `/v0/consumer-agents/revocations.ndjson` for brands needing < 5-minute propagation.

RFCs 0001–0004 ship as v0.4 of the protocol. RFC-0005 is a v0.5 candidate.

---

## 9. Out of scope for OpenKarta

For clarity, these are *not* protocol concerns:

- **Payment-processor security.** Stripe, Razorpay, and equivalents handle PCI scope. OpenKarta does not transit raw card data.
- **LLM prompt-injection from page content.** A consumer agent built on an LLM can be tricked by hostile pages; that's an LLM-platform problem, not a protocol problem.
- **Brand-internal authentication / RBAC.** How the brand controls its own employees is the brand's problem.
- **End-user identity assertions ("is this user really Karan?").** Brands and consumer agents handle KYC / phone-OTP / 3DS through the user's existing auth flow. OpenKarta carries the *delegation* once that's established.

---

## 10. Open questions

These need a decision before v0.4 ships.

1. **Is the registry the right identity issuer, or should consumer-agent operators self-host their public keys?** Option A (registry-issued) is simpler and supports revocation. Option B (self-hosted, like ACME) is more federated. Recommendation: A for v0.4, design Option B as a future federation path.
2. **Should brands be required to support identity, or is it optional?** Recommendation: optional in v0.4, recommended-by-default in v1.0, mandatory in v2.0.
3. **What happens if the registry is down?** Brands' caches keep working until TTL. Recommendation: 24h cache + a documented degraded-mode where brands fall back to a stale-but-valid cache up to 7 days.
4. **Are nation-state-level operator threats (subpoena of registry private keys) in scope?** Recommendation: yes, document the threat and the operator's commitment to a transparency report. The foundation handover (ROADMAP §4a) is load-bearing here — a single founder-controlled registry is a weaker guarantee than a foundation-controlled one.

These resolve into RFC-0001's text. Once answered, the RFC is ready to draft.
