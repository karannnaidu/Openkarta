# Why brand endpoints

> **First, the naming.** A brand's "endpoints" in OpenKarta are *not* an AI agent and *not* a separate server you have to stand up. They're a **set of eight HTTP routes** the brand exposes — `/v0/discover`, `/v0/search`, `/v0/get`, `/v0/quote`, `/v0/checkout`, `/v0/orders/:id/status`, `/v0/orders/:id/cancel`, `/v0/orders/:id/return`. They can live on the brand's existing API server, on a thin adapter microservice, on a serverless function — wherever it's convenient. No LLM, no inference, no autonomous reasoning. Just routes that follow a contract. Earlier drafts of this project called this layer a "reception agent" or "brand agent"; that was misleading. The consumer side is where the AI lives. The brand side is just additional endpoints.

People keep asking the same question:

> Why do brands need to expose these *additional* endpoints? Can't ChatGPT or Claude just hit the brand's existing API?

This doc is the honest answer — what the eight brand endpoints are actually for, where the design holds up, and where it doesn't.

---

## The question, sharpened

A modern brand already has APIs. Shopify stores have Storefront APIs. Booking.com has a partner API. Cleartrip has an availability API. AI labs are spending billions on models that can read JSON and figure things out.

So the obvious thing to propose is:

1. The brand publishes its existing OpenAPI spec.
2. The AI agent reads the spec, calls the routes, parses the responses.
3. We skip the OpenKarta brand-endpoints layer entirely.

Or even simpler:

1. The brand writes an MCP server (Anthropic's Model Context Protocol — already shipped, already gaining traction).
2. Any MCP-aware agent connects to it.
3. Done. No new protocol needed.

These are not bad arguments. They're real, and we should answer them straight.

---

## What the brand endpoints are actually for

Strip away the diagrams. There is exactly **one** thing that forces these specific endpoints to exist as a contract: **money has to move deterministically.**

Three concrete pieces of that:

### 1. Signed quotes

When the AI agent says *"the coffee is ₹650, ship to Bangalore"*, the user expects the charge to be ₹650. Not ₹680 because the page got re-fetched. Not ₹650 today and ₹720 at checkout because the cart "expired".

The way OpenKarta does this: the brand's `/v0/quote` endpoint returns a **signed quote token** — a short string containing the price, the cart, the expiry, and a cryptographic signature using the brand's private key. The consumer agent passes that token back to `/v0/checkout`. The brand verifies its own signature and *must* honour the price.

For this to work, the brand's checkout endpoint has to perform that signature verification on every call, and refuse to charge anything other than what the signed quote said. That's a *behaviour*, not just a route shape. You cannot put it in an OpenAPI spec — there's no slot in OpenAPI that says "this field is a signature you must verify before honouring the price". It has to be a contract the brand promises to keep — which is what the protocol is.

### 2. Commerce semantics that JSON schemas can't carry

What does "quote" mean for:

- a flight cart (multiple legs, fare class, baggage rules)?
- a hotel cart (multi-night, taxes inclusive or exclusive, cancellation policy)?
- a salon appointment (provider lock-in, deposit, no-show fee)?

These aren't just data shapes. They're **business rules**. A flight quote that doesn't include baggage is a different product than one that does. A hotel quote that doesn't lock the room for the user during checkout is a different product than one that does.

Generic API specs describe *fields*. They don't describe *behaviours*. The OpenKarta spec says: when you implement `/v0/quote` for `itemType: "flight"`, you do these specific things. That's what makes consumer agents able to integrate against any brand without learning each brand's quirks.

### 3. Safe retries on real money

If a checkout request fails halfway through (network blip, 504 from the brand), the consumer agent has to decide: retry, or don't?

Retry naively → you double-charge.
Don't retry → you frustrate users who legitimately want their order placed.

The OpenKarta protocol forces idempotency on `checkout`, `cancel`, and `return` — same idempotency key, same outcome. The brand has to implement this. There is no way to bolt it onto an arbitrary OpenAPI spec; it's a behavioural contract the brand commits to by being conformant.

---

## Where the "just use the existing API" argument actually wins

There's a part of the design where the dedicated OpenKarta endpoints are **not** strictly necessary, and we should be honest about it: **discovery and search.**

For pure read paths — *"who sells coffee in Bangalore?"*, *"what's in stock?"* — you really could:

- Scrape Schema.org Product / Offer markup (Google has done this for a decade).
- Read the brand's existing Storefront API.
- Have the LLM map fields on the fly.

It would be slower, less reliable, more expensive on inference tokens, and harder to keep in sync — but it would *work*.

So the protocol's defensibility doesn't live in `discover`, `search`, or `get`. It lives in `quote`, `checkout`, `status`, `cancel`, `return` — the verbs where the consequences of getting it wrong are real money or a real broken order.

---

## The MCP risk — said out loud

Anthropic's Model Context Protocol exists. It's growing fast. Brands are starting to ship MCP servers. Any MCP-aware agent (Claude, soon others) can connect to those servers and do things with them.

If MCP ships standard commerce extensions — signed quotes, idempotent checkout, refund flows — *before* OpenKarta gets meaningful brand adoption, then OpenKarta either:

1. **Becomes those extensions** (we contribute the commerce semantics into the MCP ecosystem and OpenKarta is the commerce profile of MCP), or
2. **Gets routed around** (brands write generic MCP servers, agents do their best with no commerce-specific safety, and the industry takes a few painful years to learn what we already designed for).

Outcome 1 is fine. It's even good — neutrality is the goal, not protocol-brand pride. Outcome 2 is the real risk we're working against.

What this means for the design today:

- The eight verbs and their semantics matter more than the transport. If MCP becomes the transport, fine.
- The signed-quote / idempotent-checkout / closed-error-enum behaviours are the actual contribution. Those are protocol-shaped, not transport-shaped.
- The brand endpoints we ask for today should be straightforward to re-expose as MCP tools later. We should not paint ourselves into a transport corner.

---

## What "brand endpoints" actually are, in one sentence

> Eight HTTP routes a brand adds to whatever API surface they already run, that together promise specific behaviours — signed quotes, idempotent writes, closed-enum errors — on the verbs that move money.

Not a new product. Not a separate server unless the brand chooses to deploy them that way. Often a few hundred lines of code wrapping a backend the brand already has. The work isn't standing up infrastructure — it's making eight specific commitments the protocol asks for, and signing them.

That signing, that commitment, and the guarantee that every conformant brand makes the *same* commitments — that's the entire reason the contract exists.

---

## Quick decision rule

When someone asks *"do we really need these endpoints?"*, the answer is:

- For **read-only / discovery** flows? Strictly, no. You could scrape and hope.
- For **anything that takes payment, books inventory, or modifies an order**? Yes. The OpenKarta endpoints are what make the operation safe to retry, the price safe to trust, and the brand's behaviour safe to assume.

We are betting OpenKarta on the second category, because that's where the value is — and where doing it wrong is genuinely dangerous.
