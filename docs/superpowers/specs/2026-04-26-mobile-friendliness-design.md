# Mobile-friendliness pass — OpenKarta landing site

**Date:** 2026-04-26
**Owner:** karan
**Surface:** `packages/landing-web/` (Astro static site, deployed to Cloudflare Pages project `openkarta-landing`)

## Goal

Make the OpenKarta landing site usable, legible, and visually correct on mobile (≤ 768px), then verify with a Lighthouse mobile audit and target ≥ 90 across all four categories on the landing page.

## Context

Built and deployed across the previous session: a 24-page Astro landing site with Tailwind via Play CDN, Motion One microinteractions, scenario rotator on the hero, hero video reel, loop-diagram image. Desktop layout is solid. Mobile state was never audited. A source-only audit found six layout-breaking issues below 768px (no mobile nav, multiple grids without `grid-cols-1` baseline) plus a handful of polish gaps.

Reference: source audit punch list in conversation, Cloudflare Pages preview at `https://<hash>.openkarta-landing.pages.dev/`.

## Architecture

Three-phase fix-and-test cycle. Each phase ends with a build + deploy. Phase ordering is deliberate: Phase 1 clears layout breakage so the Phase 2 Lighthouse signal reflects polish-grade issues rather than known-broken layout.

```
Phase 1 (P0 layout) → deploy → Phase 2 (Lighthouse audit) → Phase 3 (P1 + findings) → deploy → final Lighthouse re-run
```

## Phase 1 — P0 fixes (broken below 768px)

### 1a. Mobile nav drawer

**File:** `packages/landing-web/src/components/Header.astro`

The current header uses `hidden md:flex` on the nav with no mobile alternative. Below 768px the user has zero way to navigate to Protocol, Merchants, Developers, Governance, or Manifesto.

Fix:
- Add a hamburger `<button>` visible only below `md` (`md:hidden`), 44×44 tap target, with `aria-expanded`, `aria-controls="mobile-nav"`, `aria-label="Open navigation"`. Icon swaps between `menu` and `close` via the open state.
- Add a `<nav id="mobile-nav">` panel positioned absolutely under the header. Full-viewport-width, surface-container-lowest background, top border, py-6 px-8. Contains: 5 primary nav links (Protocol / Merchants / Developers / Governance / Manifesto), a divider, Login and Install SDK CTAs.
- State: `data-open="true|false"` attribute on the panel; matching `aria-expanded` on the button.
- JS (inline `<script is:inline>` at the bottom of `Header.astro`): toggle on click, close on (a) link tap, (b) outside tap, (c) Escape key, (d) viewport resize ≥ 768px.
- Body scroll-lock while open: toggle `overflow-hidden` on `<body>`.
- Animation: use Motion One `animate()` for a 240ms slide-down + fade. Reduced-motion → instant.

### 1b. Grid mobile baselines

Each of the following pages has a multi-column grid with no `grid-cols-1` baseline, so cells stack as a hardcoded 2 or 3 columns even on a 360px viewport. Add an explicit single-column floor.

| File | Current | Fix |
|---|---|---|
| `pages/index.astro` (stats grid) | `grid grid-cols-3` | `grid grid-cols-1 sm:grid-cols-3` |
| `pages/about.astro` | `grid md:grid-cols-3` | `grid grid-cols-1 md:grid-cols-3` |
| `pages/developers.astro` (two tracks) | `grid md:grid-cols-2` | `grid grid-cols-1 md:grid-cols-2` |
| `pages/manifest.astro` (ops telemetry) | `grid grid-cols-2` | `grid grid-cols-1 sm:grid-cols-2` |
| `pages/press.astro` (factsheet) | `grid grid-cols-2` | `grid grid-cols-1 sm:grid-cols-2` |

### Phase 1 deliverable

Clean layout at 360, 414, 768. Build, deploy, manual sweep in Chrome DevTools mobile emulation.

## Phase 2 — Lighthouse mobile audit

Run on the freshly-deployed Phase 1 build, against five high-traffic pages.

```bash
npx lighthouse <DEPLOY_URL>/ \
  --form-factor=mobile \
  --throttling-method=simulate \
  --output=json \
  --output-path=./lighthouse-<page>.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo
```

Pages: `/`, `/protocol`, `/developers`, `/merchant`, `/registry`.

Categorize findings as perf / a11y / SEO / best-practices, with severity (red < 50, amber 50–89, green ≥ 90). The output of Phase 2 is a punch list that drives Phase 3.

### Likely findings (informed predictions; not commitments)

- **Performance:** render-blocking Tailwind Play CDN script (~80kB JS for runtime tailwind), hero video LCP cost on slow 4G, missing dimensions on images causing CLS.
- **Accessibility:** `text-on-surface-variant` (#737688 on white) is borderline AA at body sizes; small tap targets in scenario-rotator tabs and refresh buttons; possibly missing `aria-label` on icon-only buttons.
- **SEO:** missing `<meta description>` on some pages, missing `og:image`, missing `lang` (already set in BaseLayout to `en`).
- **Best practices:** mixed-content if any HTTP asset; deprecated APIs (none expected); console errors (none expected).

### Out of scope for Phase 2 fixes

- Replacing Tailwind Play CDN with a compiled stylesheet (separate refactor — flag and defer).
- Adopting a CDN image pipeline (Cloudflare Images) for the loop diagram.

## Phase 3 — P1 polish + Lighthouse findings

### 3a. Static P1 (known up front)

- **Hero typography floor.** `pages/index.astro` H1 currently `[font-size:clamp(48px,8vw,108px)]`. Drop the floor: `clamp(40px,8vw,108px)`.
- **Hero video section.** Wrap `<section>` containing `<video src="/hero.mp4">` with `class="... hidden md:block"`. Skips a 5MB asset on mobile.
- **Footer collapse.** `components/Footer.astro` outer grid `grid-cols-2 md:grid-cols-4 lg:grid-cols-6` → add an explicit `grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6` so the smallest screens stack to one column.
- **Image dimensions.** Add `width="1024" height="1024"` (the source PNG's natural dimensions, verified via `file`) to `<img src="/loop-diagram.png">` in `pages/index.astro` to eliminate CLS.

### 3b. Lighthouse-driven (scoped from Phase 2 punch list)

For each Phase 2 finding above the threshold for fix:

- **Contrast** — if `text-on-surface-variant` fails AA at body size, swap the color token to a darker neutral (target #5b5e6e or stronger) site-wide via the Tailwind config in `BaseLayout.astro`.
- **Tap targets** — bump small inline buttons (`.ok-scene-tab`, the registry refresh button, blog "← All posts" link) to a minimum 44px tap area. Use `py-3` padding rather than icon-only sizing.
- **Meta descriptions** — audit each page's `<BaseLayout description={...}>` prop. Add a one-sentence `description` prop to any page that omits it.
- **Font preload** — add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the Inter regular cut in `BaseLayout.astro` head.

Phase 3 ends with a final Lighthouse mobile re-run on `/`. Target: all four scores ≥ 90.

## Components & file inventory

| Component | File | Phase | Action |
|---|---|---|---|
| Mobile nav drawer | `src/components/Header.astro` | 1a | Modify (add hamburger + drawer panel + JS) |
| Stats grid | `src/pages/index.astro` | 1b | Modify (`grid-cols-1 sm:grid-cols-3`) |
| About 3-col grid | `src/pages/about.astro` | 1b | Modify (`grid-cols-1 md:grid-cols-3`) |
| Developers tracks | `src/pages/developers.astro` | 1b | Modify (`grid-cols-1 md:grid-cols-2`) |
| Manifest telemetry | `src/pages/manifest.astro` | 1b | Modify (`grid-cols-1 sm:grid-cols-2`) |
| Press factsheet | `src/pages/press.astro` | 1b | Modify (`grid-cols-1 sm:grid-cols-2`) |
| Hero typography | `src/pages/index.astro` | 3a | Modify (clamp floor 40px) |
| Hero video section | `src/pages/index.astro` | 3a | Modify (`hidden md:block`) |
| Footer | `src/components/Footer.astro` | 3a | Modify (`grid-cols-1 sm:grid-cols-2 ...`) |
| Loop diagram dims | `src/pages/index.astro` | 3a | Modify (add width/height) |
| Color tokens | `src/layouts/BaseLayout.astro` | 3b | Conditional (only if Phase 2 surfaces contrast fail) |
| Font preload | `src/layouts/BaseLayout.astro` | 3b | Modify (add preload `<link>`) |
| Page descriptions | per-page `BaseLayout` props | 3b | Conditional per page |
| Tap target padding | scenario tabs, refresh buttons | 3b | Conditional per element |

## Testing

After **each** phase:

1. **Manual viewport sweep** — Chrome DevTools device emulation at 360 (iPhone SE), 414 (Pixel 7), 768 (iPad Mini portrait), 1024 (iPad Pro portrait). Navigate every primary page (`/`, `/protocol`, `/merchant`, `/developers`, `/conformance`, `/registry`, `/manifest`, `/blog`, `/governance`, `/changelog`, `/status`).
2. **Mobile drawer** (Phase 1+) — open, tap each link, verify navigation. Open, hit Escape, verify close. Open, tap outside the panel, verify close. Open and resize past 768px, verify auto-close. Tab through with keyboard.
3. **Reduced-motion** — toggle DevTools Rendering panel "prefers-reduced-motion: reduce". Verify drawer animates instantly and scenario rotator does not auto-advance.
4. **Lighthouse mobile** (Phase 2 + final Phase 3) — run against `/` and at least one inner page. Compare deltas.

## Error handling & edge cases

- **JS disabled.** Hamburger button does nothing without JS. Acceptable degradation: render the nav links as a visible vertical list below 768px when `<noscript>` is active. Out of scope unless we hear it's an actual user constraint.
- **Keyboard.** Drawer must be reachable via Tab. Open state should focus-trap inside the drawer until closed. On close, return focus to the hamburger.
- **iOS safe area.** Drawer respects `env(safe-area-inset-top)` to avoid the notch.
- **Backdrop scroll.** Body `overflow-hidden` while drawer open prevents background scroll-bleed on iOS.
- **Lighthouse run failures.** If `npx lighthouse` fails on Windows due to Chrome path resolution, fall back to PageSpeed Insights API or run via the Chrome DevTools UI manually and capture the JSON.
- **Phase 3 scope.** If Phase 2 surfaces a finding that requires structural change (e.g., replacing Tailwind CDN to fix LCP), document it as a follow-up and skip from this pass — do not let the audit balloon scope.

## Phase 2 audit results (2026-04-26)

Lighthouse v12.8.2, mobile form factor, simulate throttling, headless Chrome. Run against the Phase 1 deploy `https://3261fcf1.openkarta-landing.pages.dev`.

### Scores

| Page | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 56 | 99 | 96 | 66 |
| `/protocol` | 56 | 99 | 96 | 66 |
| `/developers` | 57 | 99 | 96 | 66 |
| `/merchant` | 57 | 99 | 96 | 66 |
| `/registry` | 57 | 99 | 93 | 66 |

A11y and Best Practices already clear the ≥ 90 bar. Performance (≈ 57) and SEO (66) miss.

### Findings classification

| Audit | Pages | Action | Rationale |
|---|---|---|---|
| `is-crawlable` | all 5 | **defer (out of scope)** | Cloudflare Pages preview deploys auto-add `X-Robots-Tag: noindex`. Production domain will not. SEO score on prod will be ≥ 90 once this lifts. |
| `render-blocking-resources`, `unused-javascript`, `mainthread-work-breakdown`, `bootup-time`, `network-dependency-tree-insight`, `render-blocking-insight` | all 5 | **defer (out of scope per spec)** | All trace back to the Tailwind Play CDN runtime. Spec §"Out of scope for Phase 2 fixes" defers compiled-stylesheet refactor to a separate pass. |
| `modern-image-formats`, `uses-responsive-images`, `image-delivery-insight` | all 5 | **defer (out of scope per spec)** | Spec §"Out of scope for Phase 2 fixes" defers Cloudflare Images pipeline. |
| `unsized-images`, `image-aspect-ratio`, `largest-contentful-paint-element` | all 5 | **fix in Phase 3a** | Already covered by plan Task 9 (add `width="1024" height="1024"` to `/loop-diagram.png`). |
| `image-redundant-alt` | all 5 | **fix in Phase 3b** | Header logo `<img alt="OpenKarta">` sits next to `<span>OpenKarta</span>` wordmark — the alt text duplicates adjacent visible text. Fix: change to `alt=""` (decorative) since the wordmark already announces the brand. |
| `redirects` | `/protocol`, `/developers`, `/merchant`, `/registry` | **defer (out of scope)** | Cloudflare Pages adds a trailing-slash redirect on inner pages. Acceptable; can be tuned via `_redirects` later. |
| `errors-in-console` | `/registry` | **investigate in Phase 3b** | Likely the registry test-fetch hitting a non-existent backend on the preview deploy. If so, suppress the console.error in `prefers-reduced-motion`-style fallback or guard the fetch behind a host check. |
| `uses-long-cache-ttl`, `cache-insight`, `offscreen-images` | `/` | **defer (out of scope)** | Cache TTLs require `_headers` config, image deferral requires loading attribute work — both outside spec scope. |
| `first-contentful-paint`, `largest-contentful-paint`, `speed-index`, `interactive` | all 5 | **partially mitigated by image dims fix** | These are downstream metrics that improve marginally once images have intrinsic dimensions; the rest is Tailwind-CDN-bound and deferred. |
| `document-latency-insight` | `/protocol`, `/developers`, `/merchant`, `/registry` | **defer (out of scope)** | Edge → user TTFB on Cloudflare Pages preview region; production geography differs. |

### Phase 3 scope (revised)

Phase 3a (static, already in plan):
- Hero H1 clamp floor → 40px (Task 6)
- Hero video `hidden md:block` (Task 7)
- Footer `grid-cols-1` baseline (Task 8)
- Loop diagram `width`/`height` (Task 9) — also satisfies `unsized-images`, `image-aspect-ratio`, `largest-contentful-paint-element`

Phase 3b (Lighthouse-driven):
- Header logo `alt=""` to clear `image-redundant-alt` site-wide.
- Investigate `/registry` console errors; silence or guard.

No contrast fix required (a11y = 99 already). No tap-target fix required (a11y = 99). No meta-description fix surfaced. Font preload deferred — adding it without compiling Tailwind first delivers limited benefit.

### Success-criterion realism note

The "≥ 90 across all four categories on `/`" target on the **preview deploy** is unattainable without the deferred Tailwind compile. We expect:
- A11y, Best Practices: ≥ 90 already, will hold.
- SEO: 66 → ≥ 90 only on the production domain (no `noindex`).
- Performance: 56 → likely 65–75 after Phase 3 fixes; ≥ 90 requires the deferred Tailwind compile.

Recommend re-targeting Performance ≥ 90 to a follow-up pass that ships the compiled stylesheet, and accepting Phase 3 success at "all preventable issues fixed; structural deferrals documented".

## Success criteria

1. No layout overflow or hidden content at 360px on any of the 11 primary pages.
2. Every primary page is reachable from the mobile drawer.
3. Drawer passes the keyboard / Escape / outside-tap / resize tests.
4. Final Lighthouse mobile audit on `/` reports ≥ 90 in all four categories.
5. Hero video does not load on mobile (verified via DevTools Network panel).
