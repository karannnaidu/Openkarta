# Why reception agents

A reception agent is the small server a brand stands up that speaks the eight OpenKarta verbs. People keep asking the same question:

> Why does the brand need a separate server? Can't ChatGPT or Claude just hit the brand's existing API?

This doc is the honest answer — what reception agents are actually for, where the design holds up, and where it doesn't.

---

## The question, sharpened

A modern brand already has APIs. Shopify stores have Storefront APIs. Booking.com has a partner API. Cleartrip has an availability API. AI labs are spending billions on models that can read JSON and figure things out.

So the obvious thing to propose is:

1. The brand publishes its existing OpenAPI spec.
2. The AI agent reads the spec, calls the endpoints, parses the responses.
3. We skip the entire "reception agent" layer.

Or even simpler:

1. The brand writes an MCP server (Anthropic's Model Context Protocol — already shipped, already gaining traction).
2. Any MCP-aware agent connects to it.
3. Done. No new protocol needed.

These are not bad arguments. They're real, and we should answer them straight.

---

## What reception agents are actually for

Strip away the diagrams. There is exactly **one** thing that forces a reception agent to exist: **money has to move deterministically.**

Three concrete pieces of that:

### 1. Signed quotes

When the AI agent says *"the coffee is ₹650, ship to Bangalore"*, the user expects the charge to be ₹650. Not ₹680 because the page got re-fetched. Not ₹650 today and ₹720 at checkout because the cart "expired".

The way OpenKarta does this: the brand returns a **signed quote token** — a short string containing the price, the cart, the expiry, and a cryptographic signature using the brand's private key. The consumer agent passes that token back at checkout. The brand verifies its own signature and *must* honour the price.

For this to work, the brand needs to hold a signing key and use it on every quote. That key sits on a server the brand controls. That server is the reception agent.

You cannot do this with a generic OpenAPI spec. There's no slot in OpenAPI that says "this field is a signature you must verify before honouring the price". The signing behaviour has to be a contract the brand promises to keep — which is what the protocol is.

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

There's a part of the design where the reception agent is **not** strictly necessary, and we should be honest about it: **discovery and search.**

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
- A reception agent built on OpenKarta should be straightforward to expose as an MCP server later. We should not paint ourselves into a transport corner.

---

## What a reception agent actually is, in one sentence

> A small, brand-controlled HTTP server that promises eight specific behaviours, signs its quotes, and guarantees safe retries on the verbs that move money.

Not a new product. Not a heavy lift. Often a few hundred lines of code in front of a backend the brand already has. The work isn't standing up a server — it's making the eight specific commitments the protocol asks for, and signing them.

That signing, that commitment, and the guarantee that every conformant brand makes the *same* commitments — that's the entire reason the layer exists.

---

## Quick decision rule

When someone asks *"do we really need this?"*, the answer is:

- For **read-only / discovery** flows? Strictly, no. You could scrape and hope.
- For **anything that takes payment, books inventory, or modifies an order**? Yes. The reception agent is what makes the operation safe to retry, the price safe to trust, and the brand's behaviour safe to assume.

We are betting OpenKarta on the second category, because that's where the value is — and where doing it wrong is genuinely dangerous.
