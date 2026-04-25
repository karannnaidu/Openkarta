# openkarta.org — Landing page & full site design

> **Status:** design brief, ready to hand to a visual designer.
> **Format goal:** Snitch-grade visual punch (full-bleed hero, editorial typography, scroll-driven storytelling) on a Google-grade information spine (clear hierarchy, dense-but-scannable content, no marketing fluff).
> **Today:** `web/index.html` is a single static page on Cloudflare Pages — clean but flat, all CTAs point to GitHub. This brief replaces it with a multi-page site that can stand next to Stripe / Resend / Vercel / Linear without looking like a side project.

---

## 1. North star

A developer or a brand lead lands on `openkarta.org` cold, and within **30 seconds** can answer:

1. *What is this?* — an open protocol that lets any AI agent transact with any merchant, across categories.
2. *Why do I care?* — it's the only neutral alternative before one closed SDK owns agentic commerce.
3. *What do I do next?* — one obvious CTA tailored to which audience I'm in (brand, builder, or curious).

The site should feel **inevitable, not promotional** — like reading the HTTP spec rather than a SaaS landing page. Snitch supplies the visual confidence; Google supplies the information density.

---

## 2. Audience model

Every page resolves to one of three audiences. The landing page must offer all three a clear "this way" within one scroll.

| Audience | Who | Primary intent | Primary CTA |
|---|---|---|---|
| **Brands / merchants** | E-commerce ops, founders, BD leads at retailers, hotels, airlines, bus operators, salons | "How do I get my catalogue into AI agents?" | `/merchants` → quickstart → submit to registry |
| **Consumer-agent developers** | App devs, AI startup engineers, hobbyists building ChatGPT/Claude/Gemini-powered shopping flows | "How do I let my agent buy things?" | `/developers` → SDK install → demo CLI |
| **End users / curious public** | Press, foundation reps, big-AI-lab observers, students | "What is this thing and who runs it?" | `/protocol` overview + `/foundation` story |

Secondary audience: **infrastructure stakeholders** (Linux Foundation, OpenJS, ONDC, Cloudflare, payment processors). They need `/foundation` and `/status`.

---

## 3. Site map

```text
openkarta.org
├── /                       Landing
├── /merchants              Brand / merchant pitch + integration paths
├── /developers             Consumer-agent developer pitch + SDK
├── /protocol               Protocol overview (deep links to docs.openkarta.org)
├── /registry               Browseable, searchable list of conformant agents
├── /conformance            Run the harness, get a signed badge, embed it
├── /foundation             Governance, neutrality, foundation roadmap
├── /blog                   RFCs, release notes, partnership announcements
├── /about                  Story, contributors, contact, press
├── /status                 Uptime + SLO + incident history (auto-generated)
│
├── /legal/terms
├── /legal/privacy
├── /legal/security         Security disclosure policy
├── /press                  Logo, brand assets, screenshots, press contact
├── /changelog              Protocol + SDK version history
└── /404                    Custom 404
```

**Subdomain split:**
- `openkarta.org` — marketing site (this doc)
- `docs.openkarta.org` — versioned protocol + SDK reference (Mintlify or Docusaurus, planned in ROADMAP §4)
- `registry.openkarta.org` — registry API (Plan 03)
- `status.openkarta.org` — status page

The landing site links into all three. We do not duplicate their content.

---

## 4. Landing page — section by section

The landing page is **eight scroll sections** plus header and footer. Every section is full-bleed, with a centred container max-width of **1200px** on desktop, **24px** side-padding on mobile.

```text
┌──────────────────────────────────────────────────────────────────┐
│  HEADER  (sticky, translucent on scroll)                         │
├──────────────────────────────────────────────────────────────────┤
│  1. HERO              full-bleed, large type, dual CTA, code     │
├──────────────────────────────────────────────────────────────────┤
│  2. VIDEO             placeholder 16:9, autoplays muted on enter │
├──────────────────────────────────────────────────────────────────┤
│  3. THE PROBLEM       one-screen statement, animated diagram     │
├──────────────────────────────────────────────────────────────────┤
│  4. HOW IT WORKS      scroll-driven 3-step explainer             │
├──────────────────────────────────────────────────────────────────┤
│  5. THREE AUDIENCES   audience-pivot cards (brand/dev/curious)   │
├──────────────────────────────────────────────────────────────────┤
│  6. LIVE DEMO         interactive — hit a real reference agent   │
├──────────────────────────────────────────────────────────────────┤
│  7. NEUTRALITY        why this isn't a closed SDK; foundation    │
├──────────────────────────────────────────────────────────────────┤
│  8. PROOF + CTA       npm packages, conformance, GitHub stars    │
├──────────────────────────────────────────────────────────────────┤
│  FOOTER                                                          │
└──────────────────────────────────────────────────────────────────┘
```

### 4.0 Header

- Sticky. Background `transparent` at top, `rgba(255,255,255,0.85)` + `backdrop-filter: blur(12px)` after 64px scroll.
- Left: wordmark "OpenKarta" + small monogram square (currently a black square — keep until brand mark exists).
- Right nav: `Protocol`, `Registry`, `Foundation`, `Docs ↗`, `GitHub ↗`, then a primary pill button **"Get started"** (dark fill on light theme, scrolls to section 5).
- Mobile: hamburger → full-screen overlay menu, same items, plus `hello@openkarta.org`.

### 4.1 Hero

**Goal:** in one screen-height, claim the category and offer two clear next steps.

**Copy:**
> **Eyebrow:** `Protocol v0.1 · MIT licensed · live on npm`
>
> **H1:** The open contract for **agentic commerce.**
> *(`agentic commerce` rendered in accent colour, italic-or-underlined)*
>
> **Lede:** Eight verbs. Five item types. One typed protocol any AI agent and any merchant can speak — across goods, stays, flights, buses, and services. No platform tax. No proprietary SDK. No lock-in.
>
> **Primary CTA:** Expose your catalogue → `/merchants`
> **Secondary CTA:** Build a consumer agent → `/developers`
>
> **Below CTAs (terminal line):**
> `$ npm install @openkarta/sdk-node @openkarta/spec`

**Layout:**
- Single column, centre-aligned on desktop. Headline at **clamp(48px, 7vw, 96px)**. Lede max-width **640px**.
- 96px between H1 and lede, 48px between lede and CTA row.
- Behind everything: subtle grid background OR a slow-moving generative pattern of the 8-verb names sliding past at 3% opacity. Not literal-and-loud — atmospheric.

**Snitch reference:** the way Snitch puts a single huge editorial line + one CTA + a single product photo. We do the same but the "product" is the terminal line.

**Don't do:** floating UI mockups, gradients, hero illustrations of robots. Stripe-style restraint, not Webflow-template energy.

### 4.2 Video

**Goal:** a 90-second walkthrough showing the protocol end-to-end. Placeholder until Karan records it.

**Copy:**
> **Eyebrow:** `Watch · 90 seconds`
> **H2:** See the protocol end to end.
> **Lede:** A consumer agent discovers a merchant, builds a cart, gets a signed quote, checks out, and tracks the order — over the eight verbs, against three reference agents.

**Layout:**
- 16:9 frame, centred, max-width **960px**.
- Border radius **16px**. 1px border `rgba(0,0,0,0.08)`. Drop shadow `0 24px 80px rgba(0,0,0,0.12)`.
- Placeholder state: dark background `#0a0a0a`, centred play button (white circle, 96px diameter, black triangle inside), label below: "Walkthrough video — coming soon".
- When live: muted autoplay-on-enter with `IntersectionObserver` (threshold 0.6), unmute on click. Loop off. Show closed-caption toggle.

**Designer hint for the placeholder:** show *what* the video will be — three faint translucent thumbnails of frames behind the play button (terminal, code, agent UI), so it feels like a real video card, not a missing image.

### 4.3 The problem

**Goal:** one-screen statement of what's at stake. This is the section that converts "interesting" to "I should care".

**Copy:**
> **H2:** Whoever owns the contract owns the economy.
>
> **Body (two paragraphs):**
> In the next five years, AI agents will route a meaningful share of all consumer spend. The question isn't *whether* — it's *over what protocol*.
>
> The default trajectory is one of the big AI labs ships a closed agentic-commerce SDK, and every brand on earth integrates against it. That company collects rent on every transaction, sets the rules, and controls who gets discovered.
>
> **OpenKarta is the alternative:** an open, MIT-licensed contract any agent and any merchant can implement, governed by a neutral foundation. The competition stays on service. The infrastructure stays public.

**Visual:**
- Right-side or below-text: an animated "before / after" diagram.
  - **Before:** a closed hub-and-spoke — `[ClosedSDK]` in the centre, every brand and every agent connecting through it. Edges light up red one by one. Counter ticks up: "Transactions routed through one company".
  - **After:** a mesh — many brand agents, many consumer agents, all speaking the same protocol, registry sitting to the side as a neutral lookup. Edges light up green. Counter: "Transactions routed peer-to-peer".
- The animation runs once on scroll-into-view, then loops slowly with low contrast.

### 4.4 How it works

**Goal:** make the protocol concrete in three scroll-snap panels.

**Copy structure (3 cards or 3 scroll panels):**

> **Step 1 — Discover**
> A consumer agent asks the registry "who serves coffee in Bangalore?" and gets a list of conformant brand agents.
> *(visual: terminal + animated DNS-style lookup line)*

> **Step 2 — Quote**
> The agent calls `/v0/search` and `/v0/quote` against each candidate in parallel. Each brand returns a homogeneous cart and an HMAC-signed quote token. Price is locked.
> *(visual: three brand-agent boxes returning JSON snippets in parallel)*

> **Step 3 — Checkout**
> The user picks one. The agent passes the signed token to `/v0/checkout`. Order placed. `/v0/orders/:id/status` polled until fulfilled.
> *(visual: one selected brand box, signed-token chip, order-status timeline)*

**Layout option A (recommended):** horizontal scroll-snap track on desktop, vertical stack on mobile. Each step takes a full viewport, sticky-illustration-on-left + stepping-text-on-right pattern (Stripe / Linear style).

**Layout option B (lighter build):** 3 equal cards in a row, each with the snippet + visual. No scroll-jacking. Falls back gracefully on mobile.

Pick A if budget allows; B is the safe default.

### 4.5 Three audiences

**Goal:** route each visitor into the right next page.

**Copy + layout:** three cards, equal width, on a soft-tint background section.

> **Card 1 — Brands**
> *Eyebrow:* `For merchants`
> *H3:* Get into every AI agent in a day.
> *Body:* Implement eight HTTP verbs. Submit to the registry. Every conformant consumer agent — ChatGPT, Claude, Gemini, anyone building on the SDK — can now discover, quote, and check out against you. No platform fee. You keep the customer.
> *CTA:* See the merchant path → `/merchants`

> **Card 2 — Developers**
> *Eyebrow:* `For consumer-agent builders`
> *H3:* One SDK. Every category. Every brand.
> *Body:* `npm install @openkarta/sdk-node` and your agent can transact across coffee, hotels, flights, buses, and salons — without writing one integration per merchant. Typed schemas, signed quotes, one error model.
> *CTA:* See the developer path → `/developers`

> **Card 3 — Curious**
> *Eyebrow:* `For everyone else`
> *H3:* Read the protocol. Read the politics.
> *Body:* OpenKarta is governed in public, on a path to neutral foundation stewardship. The spec is 60 pages. The repo has 7 packages and 3 reference agents. Nothing is hidden.
> *CTA:* Read the spec → `/protocol`

**Snitch hint:** make these cards feel like product cards on a fashion site — strong typography, big number, generous whitespace, hover lifts the card 4px and bumps the CTA arrow.

### 4.6 Live demo

**Goal:** prove the protocol works *in the browser, right now*, without leaving the page.

**Copy:**
> **H2:** Try it without installing anything.
> **Lede:** This embedded console hits a live reference agent. Try the eight verbs. Watch the signed quote come back. No account, no key, no setup.

**Layout:**
- A two-pane embedded console.
  - **Left pane:** vertical list of clickable verb buttons (`discover`, `search`, `get`, `quote`, `checkout`, `status`, `cancel`, `return`). Each shows a tiny method+path label.
  - **Right pane:** request preview (top 40%) + response preview (bottom 60%), both syntax-highlighted JSON.
- Underneath: target selector dropdown — `Halcyon Shop (product)`, `Halcyon Stays (stay/service)`, `Halcyon Travel (flight/bus)`. Defaults to Halcyon Shop.
- "Open in CodeSandbox" link in top-right of the console.

**Backend:** the console proxies to the deployed reference agents (`https://halcyon-shop.fly.dev` etc). Add a Cloudflare Worker between to rate-limit anonymous traffic.

**If this section is too expensive to build:** swap for a static GIF/MP4 of the demo CLI running through the same flow, with a "Run it locally" code block underneath. Mark the swap clearly with the engineer.

### 4.7 Neutrality

**Goal:** the political pitch. This is what makes brands and AI labs willing to adopt — *and* it's the section the foundation/press will quote.

**Copy:**
> **H2:** The contract is open. The competition is on service.
>
> **Three-column body:**
>
> **MIT, forever.** The spec, the SDK, the reference agents, the conformance harness — all MIT. Fork it. Embed it. Ship it.
>
> **Federated, not platformed.** No gatekeeper. No "preferred partner" tier. Submit to the public registry, get listed.
>
> **On a path to a foundation.** The OpenKarta project's core maintainers run the registry today. By v1.1, stewardship transfers to the OpenKarta Foundation or to an established neutral host (Linux Foundation, OpenJS, ONDC). The handover contract is part of v1.0 — we don't ship v1.0 without a written succession path.
>
> **CTA:** Read the foundation roadmap → `/foundation`

**Visual:** the BRAND SIDE / CONSUMER SIDE diagram from the README (registry as neutral entity in the middle, brand agents on left, consumer agents on right). Render it as an SVG with subtle hover-tooltips on each node ("brand agent — runs on the merchant's own infrastructure", etc.).

### 4.8 Proof + final CTA

**Goal:** social proof + close.

**Copy:**
> **Eyebrow:** `Ready to ship`
> **H2:** Seven npm packages. Three reference agents. One signed conformance badge.
> **Lede:** v0.3.0 is live today. The protocol is stable enough to integrate against. Help shape v0.2 of the spec.

**Layout:**
- Stat row across the top:
  - `7` — npm packages published
  - `3` — reference agents deployed
  - `5` — item types covered
  - `★ <live count>` — GitHub stars (fetched at build time from the GitHub API — see §7)
- Below stats: two install snippets side by side (agent author / consumer dev), as in current `web/index.html` §4.
- Below snippets: big closing CTA card on dark background (`#0a0a0a`), white text:
  > **The contract should be open. The competition should be on service.**
  > [Star on GitHub] [hello@openkarta.org]

**Snitch hint:** the stat row should be *editorial-large* — numbers at 96px, labels at 14px caps. Like a fashion brand showing "100+ stores · 5M customers".

### 4.9 Footer

Three columns + brand block:

| Column 1 — Spec | Column 2 — Code | Column 3 — Community |
|---|---|---|
| Protocol v0.1 | GitHub | Contribute |
| Agent author quickstart | npm packages | Foundation |
| Integrator quickstart | Registry | Security disclosure |
| Conformance | Status | hello@openkarta.org |

Bottom strip: wordmark, "MIT © 2026 OpenKarta contributors", small links to `/legal/terms`, `/legal/privacy`, `/press`, `/changelog`.

---

## 5. Subpage briefs

Each subpage is shorter than the landing page — designer can extend them later. Spec the **structure** here so the visual system stays consistent.

### 5.1 `/merchants`

**Hero:** "Sell on every AI agent. In a day." + screenshot of the conformance harness passing.

**Sections:**
1. The three integration paths (Lite / HTTP / Agentic) — same content as current `web/index.html` §6, but each tier links to its own quickstart.
2. "What you give us, what you get back" — table:
   - You give: a manifest URL, eight HTTP endpoints, a signing secret.
   - You get: a registry listing, a conformance badge, traffic from any agent that knows the protocol.
3. Step-by-step flow with screenshots: clone reference agent → swap fixtures → run conformance → submit to registry → done.
4. "What it costs you" — explicit pricing block. **OpenKarta itself: free.** Payment processor fees passed through (Razorpay/Stripe). No platform fee.
5. FAQ accordion: 8–10 merchant-specific questions (data ownership, refund handling, GST invoices, rate limits, region restrictions, customer-of-record rules).
6. Final CTA: "Submit your agent" → registry submission flow (Plan 03).

### 5.2 `/developers`

**Hero:** "Your agent can transact, today." + animated terminal showing search → quote → checkout in 6 lines of code.

**Sections:**
1. Why one SDK beats N integrations — the N×M vs N+M argument with a small visual.
2. Install + first call (with language tabs — Node today, Python in 6 months per ROADMAP).
3. Concept tour: registry → orchestrator → brand agent. Link to full docs.
4. Recipes (3 cards):
   - "Buy me coffee" — simple product flow.
   - "Plan my Goa weekend" — multi-item-type flow (stay + flight).
   - "Book a haircut" — service flow with delegation token.
5. The chat command: `openkarta chat` — show the screenshot, link to the orchestrator README.
6. Conformance: how to test your *consumer* agent (separate from the brand-agent harness). Currently optional; flag as planned.
7. Final CTA: "Read the SDK reference" → `docs.openkarta.org`.

### 5.3 `/protocol`

**Hero:** "Eight verbs. Five item types. One contract." + the verbs/types table.

**Sections:**
1. Design principles (closed enums, integer minor units, signed quotes, no MoR — pulled from spec §3).
2. The verbs in detail (link to docs.openkarta.org for each).
3. The item types in detail (link to docs.openkarta.org for each).
4. Versioning policy + deprecation policy.
5. RFC process — how new verbs / item types get proposed.
6. Compliance & legal posture — neutrality covenant link.

This page is information-dense, not visual. Treat as a long-read; designer should focus on typography + table styling.

### 5.4 `/registry`

**Hero:** search box with filters — `category`, `region`, `tier`, `verified`.

**Sections:**
1. Live result grid of agents — card per agent with: name, logo, item types served, regions, last-verified-at, tier badge, "verified" or "stale" pill.
2. Empty/zero-result state designed.
3. "Submit your agent" CTA top-right (only visible if user is logged in *or* a generic mailto + GitHub PR fallback pre-Plan-03).
4. Per-agent detail page (`/registry/:agentId`): full manifest, capability summary, badge JSON, last 30 days of verification runs, contact link.

This page is the **public face of Plan 03** — design must support both pre-Plan-03 (static, GitHub-PR submission) and post-Plan-03 (DB-backed, self-serve dashboard).

### 5.5 `/conformance`

**Hero:** "Run the harness. Get a signed badge. Embed it."

**Sections:**
1. The harness explained — what it tests, how scoring works.
2. Live runner (post-Plan-03): paste your agent URL, run all packs in the browser, get a downloadable badge JSON.
3. Pre-Plan-03 fallback: "Run locally" code block.
4. Badge gallery — show 5–10 conformant agents with their badges embedded inline.
5. Embed code generator — paste the badge JSON, copy the markdown line.
6. FAQ: badge revocation, re-verification cadence, scoring breakdown.

### 5.6 `/foundation`

**Hero:** "Why this is structured to outlast its founders."

**Sections:**
1. The neutrality covenant — short, plain-English document, with a link to the full markdown source on GitHub.
2. Current governance — who runs it today (the OpenKarta project's core maintainers), how decisions get made, where to find the meeting notes.
3. The handover roadmap — milestone-by-milestone path to foundation incorporation OR transfer to neutral host. (Pull from ROADMAP.md §4a.)
4. How to get involved — three tiers: comment on RFCs (low), join a working group (medium), become a maintainer (high).
5. Contact: `foundation@openkarta.org`.

This page is a *trust artefact*. Do not market it. Make it read like a charter, not a product page.

### 5.7 `/blog`

Standard editorial blog. Categories: `release`, `RFC`, `partnership`, `essay`. Reverse-chronological list. Each post is a standalone page with permalink, share metadata, and a "subscribe to release notes" inline form (RSS + email).

Initial seed posts to write:
- "Announcing OpenKarta v0.1"
- "Why we wrote the protocol before writing the SDK"
- "The N×M problem and why agentic commerce needs a contract"
- (Plan 03 launch) "Hosted registry & verified badges"

### 5.8 `/about`

**Sections:**
1. Origin story — short, factual. (Karan to write.)
2. Contributors grid — pulled from `git shortlog -sn` + GitHub avatars.
3. Press coverage list — blockquote per outlet.
4. Contact: `hello@openkarta.org`, `press@openkarta.org`, `security@openkarta.org`.

### 5.9 `/status`

External: embed `status.openkarta.org` (Better Stack / Statuspage / Cronitor) or render directly from the underlying provider. Show: registry uptime, badge service uptime, p95 latency, last 90 days incident history. **Do not build this from scratch** — buy it.

### 5.10 `/press`

Logo downloads (SVG, PNG, dark, light), brand colour codes, screenshots of harness + dashboard, headshots if any, one-paragraph boilerplate, press contact. Standard.

### 5.11 `/changelog`

Auto-generated from package CHANGELOG.md files + protocol RFCs. Each entry: version, date, summary, link to GitHub release. Subscribe via RSS.

### 5.12 `/legal/*`

Standard. Use a plain template (Tailwind UI / shadcn) — do not over-design.

### 5.13 `/404`

One sentence + brand. Include a search box that hits the docs site and a "report a broken link" mailto.

---

## 6. Visual system

### Typography

- **Display + body:** Inter (already in use). Weights 400, 500, 600, 700, 800.
- **Mono:** JetBrains Mono (already in use). Weights 400, 500.
- **Optional editorial accent:** consider a serif (e.g., Söhne Mono, GT Sectra, Times Now) for the H1 only — gives the Snitch editorial feel without committing the whole page to a serif. Designer's call.
- **Scale:**
  - H1 hero: clamp(48px, 7vw, 96px), weight 700, line-height 1.05, letter-spacing -0.03em
  - H2 section: clamp(32px, 4vw, 56px), weight 700, line-height 1.1, letter-spacing -0.02em
  - H3 card: 24px, weight 600, line-height 1.25
  - Body: 17px on desktop, 16px on mobile, line-height 1.6, max width 65ch
  - Lede / large body: 20px, weight 400, line-height 1.5
  - Eyebrow: 13px, weight 500, letter-spacing 0.08em, uppercase, muted colour
  - Code: 14–15px JetBrains Mono

### Colour

Designed for both light (default) and dark mode. Use CSS variables.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0a0a0a` | page background |
| `--bg-soft` | `#f6f6f5` | `#141414` | alternating section background |
| `--fg` | `#0a0a0a` | `#f5f5f4` | primary text |
| `--fg-muted` | `#6b6b68` | `#a0a09c` | secondary text |
| `--accent` | `#1a5fff` | `#5b8cff` | links, accents, primary CTA |
| `--accent-soft` | `#eaf0ff` | `#1a2540` | accent backgrounds |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | hairlines |
| `--success` | `#0a7a3a` | `#2bd47a` | conformance green |
| `--danger` | `#b3261e` | `#ff6b5e` | error states |

The accent blue is a placeholder — designer should pick the final brand accent. Avoid green-as-primary (clashes with conformance-pass green).

### Spacing & layout

- Container max-width: 1200px (1320px for `/registry` grid).
- Side padding: 24px mobile, 48px tablet, 64px desktop.
- Section vertical padding: 96px desktop, 64px tablet, 48px mobile.
- Grid gutter: 24px desktop, 16px mobile.
- Border radius scale: 8px (inputs), 12px (cards), 16px (panels), 24px (hero blocks).

### Components (reusable across all pages)

1. **Button — primary** (filled dark on light, filled light on dark)
2. **Button — ghost** (outlined)
3. **Button — link** (text + arrow, animates 4px right on hover)
4. **Code block** (mono, dark background even in light mode, copy-to-clipboard button top-right)
5. **Inline code** (rounded pill, `--bg-soft` background)
6. **Eyebrow label** (small caps, muted)
7. **Section title** (H2 + lede pair, max-width 720px, left-aligned)
8. **Stat block** (96px number + 14px caps label)
9. **Card** (white in light, `#1a1a1a` in dark, 1px border, 12px radius, hover lifts 4px)
10. **Pill / badge** (status indicators — verified, stale, conformant, beta)
11. **Tabbed code block** (language switcher)
12. **Live console** (verbs left rail + JSON right pane — `/` and `/registry`)
13. **Footer column**

### Motion

- Default ease: `cubic-bezier(0.22, 1, 0.36, 1)` (Snitch-style soft snap), duration 240ms.
- Scroll-driven entrance: fade + 16px slide-up, triggered at 0.2 viewport threshold, runs once per element.
- Hover: cards lift 4px, buttons darken 8%, links underline-grow.
- Avoid: parallax (overdone), confetti (cringe), skeleton-loaders longer than 600ms.

### Imagery

- **Photography:** none in v1. Avoid stock.
- **Illustrations:** monochrome line diagrams only. No 3D renders, no robot mascots.
- **Logos:** brand logos used in §4.4 demo *only* with permission. Until then, render as monogram tiles.

---

## 7. Technical constraints (for the engineer who builds this)

- **Stack:** stay on Cloudflare Pages. Either keep static HTML/CSS *or* migrate to Astro (recommended — best static-output framework, supports MDX for blog/changelog, zero JS by default). Do **not** ship a Next.js or Vite-React app — it's overkill for a marketing site and we already pay for Cloudflare Workers separately for the registry.
- **No build step is fine for v1.** Astro adds one but pays back via MDX + content collections.
- **Performance budget:** Lighthouse 95+ on every page. Hero image (if any) ≤ 80KB. No JS in hero. Total page JS budget ≤ 50KB gzipped.
- **Fonts:** self-host via `unicode-range` subsets. Drop the `fonts.googleapis.com` preconnect — slower than self-host.
- **Analytics:** Plausible or Cloudflare Web Analytics (cookie-less). No GA.
- **GitHub stars counter:** fetch at *build* time, not runtime — no client-side API calls.
- **Demo console (§4.6):** the only interactive piece. Build as an isolated island (`<script type="module">`) so the rest stays JS-free.
- **Dark mode:** respect `prefers-color-scheme`, plus a manual toggle in the footer.
- **Accessibility:** WCAG 2.2 AA. Keyboard-navigable demo console. All interactive elements ≥ 44×44px on mobile. Captions on the hero video.
- **Open Graph / Twitter cards:** every page has a custom OG image (1200×630). Generate via Satori at build time from a template.
- **`llms.txt`:** publish at root — a markdown summary of the site for AI crawlers (this is itself an OpenKarta-credibility signal).

---

## 8. Inspiration references

Hand these to the designer with the brief.

| Site | What to take from it |
|---|---|
| **snitch.co.in** | Editorial hero confidence, the way a single huge line + one CTA carries the page; product-card grid styling for §4.5 |
| **stripe.com** | Restraint; the way technical claims get headline weight; the "live demo" embedded console pattern |
| **resend.com** | Code-block prominence; how a developer tool sells itself with terminal lines instead of screenshots |
| **linear.app** | Scroll-driven section transitions; the way motion adds polish without showing off |
| **vercel.com** | Stat row treatment in the proof section |
| **cloudflare.com** | Information density on `/protocol` and `/registry` without feeling crowded |
| **letsencrypt.org** | Tone for `/foundation` — neutral, calm, charter-like |
| **httpie.io** | The "try it without installing" pattern for §4.6 |

**Anti-references:** any AI-startup landing page from 2024–2025 with a gradient hero and a floating dashboard mockup. We are not that.

---

## 9. Build order (for the engineer)

1. Migrate current `web/` to Astro. Port existing landing as-is to verify parity.
2. Build the visual system as `src/styles/` tokens + `src/components/`.
3. Rebuild the landing page section by section against §4.
4. Build `/merchants`, `/developers`, `/protocol` (these reuse landing components).
5. Stub `/registry`, `/conformance`, `/foundation` with the right structure but minimal content — flesh out as Plan 03 / Plan 04 / governance work lands.
6. `/blog`, `/changelog` via Astro content collections.
7. `/status`, `/press`, `/legal/*` last.

Each step ships independently to Pages.

---

## 10. Open questions for Karan

These need a decision before the designer starts. Listed in priority order.

1. **Brand mark:** the current monogram is a black square. Do you want a real mark designed (suggest commissioning a logo designer alongside the site), or stay with type-only treatment for v1?
2. **Accent colour:** stick with blue (default) or pick a more distinctive brand colour? The conformance-pass green takes "green" off the table.
3. **Editorial serif for H1?** Adds Snitch character but commits to a second font family. Yes / no.
4. **Live demo (§4.6) — build it or fake it for v1?** Build cost is real (proxy worker, rate limiting, error UX). Fake = animated GIF. Recommend building it because it's the single most powerful credibility moment on the page.
5. **Foundation page tone:** charter / legal-document feel, or product-page feel? (Recommend charter.)
6. **Blog: launch with seed posts on day one, or empty until the first release announcement?** Recommend seed posts — empty `/blog` looks abandoned.
7. **Press kit assets:** do you have any logo files, or does this need to be commissioned alongside?
8. **Custom domain on `docs.openkarta.org` and `registry.openkarta.org`:** purchased + DNS-controlled today, or part of this build?

Once these are answered, the designer can start mocking. The engineer can start porting in parallel.
