# Competitive landscape — OpenKarta in the agentic-commerce stack

> **Status:** strategic positioning memo. Internal-facing. Update as the landscape moves.
> **Last reviewed:** 2026-04-26.
> **Audience:** founder, prospective foundation board, BD conversations, investor diligence.

This doc addresses the question every serious conversation about OpenKarta will now lead with: *"Google launched UCP in January with Shopify, Stripe, and Visa. What are you doing that's different?"*

The honest answer is in three parts: the landscape today, where OpenKarta is still defensible, and the structural question of whether OpenKarta should be a parallel protocol or a profile on top of what's emerging.

---

## 1. The landscape, as of April 2026

| Layer | What it is | Who owns it | Stance toward OpenKarta |
|---|---|---|---|
| **Google UCP** | Universal Commerce Protocol — agent-to-merchant contract for discovery, checkout, order management. Launched Jan 2026. | Google + 25+ partners (Shopify, Stripe, Visa, Etsy, Wayfair, Target, Walmart, Mastercard, Amex, Adyen, Flipkart, Best Buy, Macy's, Home Depot, Zalando, …) | Direct competitor on retail |
| **AP2** | Agent Payments Protocol — bundled with UCP. Standardises how AI agents authorise and execute payments. | Google | Adjacent — covers the payment leg we deliberately left to Razorpay/Stripe |
| **MCP** | Model Context Protocol — generic transport for AI agents to call tools. Now used by Anthropic, OpenAI, Google. | Anthropic, but multi-vendor adoption | Transport candidate — not a competitor, a substrate |
| **A2A** | Agent2Agent — Google's protocol for agent-to-agent comms. | Google | Tangential; could become substrate if it wins beyond Google |
| **OpenAI Apps / GPT Actions** | OpenAPI-spec-driven brand integrations into ChatGPT. | OpenAI | Competitor on consumer surface; not a protocol play |
| **Shopify Agentic Commerce** | Shopify's platform for connecting any Shopify merchant to any AI conversation. UCP partner. | Shopify | Routes Shopify merchants directly into UCP. Bypasses us for that segment |
| **Schema.org Product/Offer** | Legacy structured-data markup for products/prices. Crawled by Google + others. | W3C / community | Pre-existing read layer; not transactional |
| **ONDC** | Open Network for Digital Commerce — India's open commerce protocol, govt-backed. | DPIIT (India Govt) | Indirect — interesting parallel for the "neutral protocol" pitch in India |
| **Deeplumen, et al.** | Vendor SDKs and integrators on top of UCP / MCP / etc. | Private companies | Service layer, not protocol layer |

The picture: **the protocol war is mostly over for retail.** Google + Shopify + Stripe + Visa landed an "open" standard with the partner list to make it stick. MCP is the de facto generic transport. AP2 is the de facto payments contract on agent-initiated transactions.

What is *not* yet settled:
- Travel, stays, transit, services — not in UCP's announced scope.
- Geographies where Google's discovery surface is weaker (India, parts of Southeast Asia, parts of LATAM, the EU under DMA).
- The neutrality of UCP itself — it is "open" the way Android is open. Whether that's neutral enough for foundations, governments, and competing AI labs is an open question.

---

## 2. OpenKarta vs UCP — what's actually different

| Dimension | OpenKarta | Google UCP |
|---|---|---|
| **Owner** | Project core maintainers → OpenKarta Foundation by v1.1 | Google, with industry steering committee |
| **Discovery surface** | Federated registry — anyone reads it without going through any single vendor | Native to Gemini, Google Search, Google Shopping. AP2 + Identity Linking for the rest of the journey |
| **Categories** | 5 item types: `product`, `stay`, `flight`, `bus`, `service` (cart-homogeneity per type) | Retail-first; travel/services not visibly covered as of April 2026 |
| **Payments** | Pass-through to Razorpay (India) / Stripe (rest). No MoR. Out of scope to be the rail | Bundled with AP2. Google is positioned to be the payments contract |
| **Identity / loyalty** | Out of scope | Identity Linking ships with UCP — logged-in pricing, member benefits, loyalty |
| **Transport** | HTTP, with planned MCP-equivalent surface | HTTP + MCP + A2A as siblings |
| **Languages** | Node SDK; Python in roadmap | Java first via Deeplumen; partner SDKs across stacks |
| **Stage (Apr 2026)** | v0.3.0, three reference agents, registry as static file | Launched Jan 2026, Catalog + Identity Linking shipping, multiple partner SDKs live |
| **Distribution to merchants** | Self-serve registry submission | Shopify and other major platforms ship UCP support to their merchant base by default |
| **Distribution to consumer agents** | Any consumer agent can install the SDK and read the registry | Native on Gemini; partner integrations with other AI surfaces likely |
| **Neutrality posture** | MIT, foundation handover written into v1.0 | "Open standard" authored and convened by Google |

Three things this table does *not* show, which matter:

1. **Momentum.** UCP has it. OpenKarta has packages on npm and three demo agents. We have to be honest that a brand evaluating "which protocol do I integrate against?" today has an obvious answer if they're a US retailer.
2. **Integration cost asymmetry.** A Shopify merchant gets UCP for free via Shopify. They have to actively choose to *also* integrate OpenKarta. That's a steep ask without a distribution counter.
3. **Trust asymmetry on neutrality.** Google says "open"; many AI labs and foundations will not trust that long-term, because Google also owns the discovery surface UCP feeds. That distrust is the only thing OpenKarta can credibly compound on.

---

## 3. Where OpenKarta is still defensible

Three pockets, in priority order.

### 3.1 Non-retail verticals — travel, stays, services, transit

UCP, as announced, is products-and-checkout. The OpenKarta spec covers `stay`, `flight`, `bus`, `service` as first-class item types with their own cart semantics. These verticals have:

- Different quote semantics (multi-night, fare class, baggage, provider lock-in, deposit)
- Different fulfilment lifecycles (no-show, cancellation policy windows, refundability rules)
- Different discovery patterns (date-and-location-bound, not catalogue-bound)

The big retail consortium has every reason to leave these out of v1 of UCP — they aren't retail problems. That's our gap. We should narrow the public pitch to "the open commerce protocol for **everything UCP doesn't cover** — travel, stays, transit, services" rather than continuing to pitch breadth as a marketing line.

### 3.2 Geographies where Google discovery isn't dominant

India is the obvious one — ONDC already exists, Razorpay is dominant, Flipkart is a UCP partner but the rest of the e-commerce stack has its own gravity. EU under DMA is another (Google's surface dominance is being actively constrained). Parts of LATAM and SEA where local commerce platforms outweigh Google.

The pitch in these markets isn't "we're better than UCP". It's "we're an alternative protocol that doesn't depend on Google's discovery surface, fits ONDC-style payment flows natively, and is governed by a neutral foundation rather than a US ad company." That is a real argument in those rooms.

### 3.3 The pure-neutrality buyer

There is a class of consumer-side buyers — competing AI labs (Anthropic, Mistral, Cohere, the open-weights ecosystem), governments, foundations, large platforms uneasy about depending on Google — who structurally cannot or will not commit to a Google-authored protocol as their primary commerce contract. They are a small audience but a high-leverage one. A genuinely neutral, foundation-governed alternative is the only thing that serves them.

This pocket is the reason the foundation handover (ROADMAP §4a) has gone from "nice governance story" to **the load-bearing strategic asset of the project.** If we don't actually transfer to a neutral host on schedule, this audience disappears.

---

## 4. Where OpenKarta should not fight

- **"We're the better commerce protocol for big US retail."** Lost. Don't pitch this. Don't build for this.
- **"We're the discovery layer for Gemini."** Not happening. Gemini will use UCP.
- **"We compete with AP2."** Don't. We were never going to be the payments rail; AP2 makes that explicit. Stay pass-through.
- **"We're the cross-vendor transport."** That's MCP's job. We're a contract, not a transport.

Spending engineering or BD energy on these directly costs us focus that should go to the three defensible pockets.

---

## 5. The structural question — parallel protocol, or profile?

This is the hardest call and the one that should be made deliberately, not by drift.

### Option A — Stay parallel

OpenKarta remains a standalone protocol with its own SDK, registry, and conformance suite. We compete with UCP in the pockets above. The bet is that neutrality + non-retail breadth + non-Google geographies is a viable market segment over a 5-year horizon.

- *Pro:* protects the "open alternative" narrative absolutely. Doesn't depend on Google's goodwill.
- *Con:* every brand integration is "and also OpenKarta" on top of UCP. Adoption fight is constant.

### Option B — Reposition as a UCP profile / extension

OpenKarta becomes the **multi-vertical extension** of UCP — `UCP-travel`, `UCP-services` — contributed back to the UCP working group. We stop maintaining a parallel transport and adopt UCP's wire format. We keep our own conformance suite for the verticals.

- *Pro:* immediate distribution. Brands and consumer agents that already do UCP get our verticals for free.
- *Con:* dependent on Google accepting the contributions. Even if they do, we lose the neutrality story — we're a feature of a Google-authored standard.

### Option C — Reposition as an MCP commerce profile

OpenKarta becomes the **commerce semantics layer on top of MCP** — MCP carries the calls; OpenKarta defines the commerce-specific behaviours (signed quotes, idempotent checkout, item-type cart semantics). We bet on MCP being the cross-vendor transport that everyone, including Google, eventually treats as substrate.

- *Pro:* MCP is multi-vendor; it's the closest thing to a neutral substrate. We layer commerce semantics on top without fighting transport battles.
- *Con:* MCP commerce extensions don't exist yet; if Anthropic or the MCP working group ships their own, we're in the same UCP situation a year later.

### Recommended

**Hybrid: A as the primary positioning, with C as the planned migration path.**

Concretely:
1. Keep the standalone protocol and registry — this is what protects neutrality and serves the three defensible pockets.
2. Re-author the wire format so the same eight verbs can ride **HTTP, MCP, or UCP transport** with no semantic change. Make the protocol explicitly transport-agnostic.
3. Begin a working-group conversation with the MCP project about commerce extensions, contributing OpenKarta's signed-quote / idempotency / cart-homogeneity primitives. If the MCP ecosystem accepts these, we become the commerce profile of MCP.
4. Make a separate, friendly approach to the UCP working group offering travel/stay/service item types as candidate extensions. If accepted, great. If not, we still have our own protocol.
5. Update the public positioning to lead with **multi-vertical** and **neutral** — not "open contract for agentic commerce" (which now describes UCP too).

---

## 6. Concrete next moves (not a plan, just the list)

- **Reposition the landing page** — `/` should explicitly answer "how is this different from UCP?" above the fold. Update the design brief at `docs/superpowers/specs/2026-04-25-openkarta-org-landing-page-design.md` accordingly.
- **Re-write the README hero** — current line "the open contract for agentic commerce" is now indistinguishable from UCP marketing. New hero should foreground multi-vertical + neutral.
- **Tighten the spec to be transport-agnostic** — Plan 03 already separates contract from transport, but the public docs still imply HTTP-only. Fix.
- **Open a UCP comparison page** — `docs/vs-ucp.md` — public, factual, generous to UCP. Brands and BD prospects will ask this question on every call; have a written answer.
- **Accelerate foundation handover conversations** — Linux Foundation, OpenJS, ONDC. Neutrality is the asset; we cannot afford to look interim for long.
- **MCP working group outreach** — informal first. See whether commerce extensions are on anyone's radar, and whether OpenKarta's primitives are interesting to them.
- **India-first BD push** — given §3.2, India is the highest-leverage early market. Razorpay + ONDC + non-Flipkart retailers + travel platforms (MakeMyTrip, Cleartrip, RedBus) are the rooms to be in.

---

## 7. Open questions for the founder

1. Are we comfortable narrowing the public pitch to "multi-vertical + non-Google-discovery"? It's a smaller story than "the open contract for agentic commerce" — but it's a defensible one.
2. How aggressive should we be about contributing primitives upstream to MCP / UCP working groups? There's a real risk of strengthening competitors with our best ideas. There's also a real reward of becoming the de facto commerce profile.
3. Does the foundation handover need to happen earlier than v1.1? The neutrality argument compounds faster the sooner we are visibly out of any single company's control.
4. India-first or India-among-many for the BD push? India alone could carry the business; betting on it explicitly changes hiring and investor framing.
5. Are we willing to deprecate OpenKarta-as-its-own-transport in favour of riding MCP if MCP ships commerce extensions in 2027? That decision changes how much we invest in the SDK vs the conformance suite this year.

These are the questions that will steer the next 12 months. They should be answered explicitly, not by drift.
