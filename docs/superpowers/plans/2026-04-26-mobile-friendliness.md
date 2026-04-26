# Mobile-friendliness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the OpenKarta landing site (`packages/landing-web/`) usable, legible, and visually correct on mobile (≤ 768px), and verify with a Lighthouse mobile audit at ≥ 90 across all four categories on `/`.

**Architecture:** Three-phase fix-and-test cycle. Phase 1 clears P0 layout breakage (mobile drawer + `grid-cols-1` baselines) so the Phase 2 Lighthouse signal reflects polish-grade issues, not known-broken layout. Phase 3 applies static P1 fixes plus any finding from Phase 2 above the threshold for fix.

**Tech Stack:** Astro v4.16.0 (static), Tailwind via Play CDN with inline config, Motion One via ESM CDN (already loaded by `BaseLayout.astro` on `window.__ok.motion`), Cloudflare Pages deploy via `npx wrangler pages deploy`. No test framework — verification is manual viewport sweep in Chrome DevTools + Lighthouse JSON output.

**Spec:** `docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md`

---

## File map

| File | Phase | Responsibility |
|---|---|---|
| `packages/landing-web/src/components/Header.astro` | 1a | Hamburger button, mobile drawer panel, drawer JS (toggle, ESC, outside-tap, resize, body scroll-lock, focus trap, Motion One animation) |
| `packages/landing-web/src/pages/index.astro` | 1b, 3a | Stats grid `grid-cols-1` baseline; hero H1 clamp floor; hero video `hidden md:block`; loop diagram width/height |
| `packages/landing-web/src/pages/about.astro` | 1b | 3-col grid `grid-cols-1` baseline |
| `packages/landing-web/src/pages/developers.astro` | 1b | Tracks 2-col grid `grid-cols-1` baseline |
| `packages/landing-web/src/pages/manifest.astro` | 1b | Operations telemetry 2-col grid `grid-cols-1` baseline |
| `packages/landing-web/src/pages/press.astro` | 1b | Factsheet 2-col grid `grid-cols-1` baseline |
| `packages/landing-web/src/components/Footer.astro` | 3a | Outer grid `grid-cols-1 sm:grid-cols-2` baseline |
| `packages/landing-web/src/layouts/BaseLayout.astro` | 3b (conditional) | Color token contrast fix, font preload — only if Phase 2 surfaces these |
| `docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md` | reference only | Source of truth — do not modify |

Test artefacts (not committed):
- `lighthouse-<page>.json` — Phase 2 audit output, generated locally and deleted after summarizing into Task 6.
- `lighthouse-final-home.json` — Phase 3 final re-run on `/`, retained until Task 16 verification.

---

## Phase 1 — P0 layout fixes

### Task 1: Mobile nav drawer in `Header.astro`

**Files:**
- Modify: `packages/landing-web/src/components/Header.astro` (whole file)

**Context:** The current header has `<nav class="hidden md:flex …">` (line 18). Below 768px the user has zero way to navigate to Protocol, Merchants, Developers, Governance, or Manifesto. We add a hamburger button visible only below `md`, plus a slide-down drawer panel.

- [ ] **Step 1: Reproduce the breakage**

Run the local dev server: `pnpm --filter @openkarta/landing-web run dev`. Open Chrome DevTools, switch to device emulation (iPhone SE / 375×667). Confirm there is no visible nav and no way to reach inner pages from the header. Note this as the baseline.

- [ ] **Step 2: Replace the entire `Header.astro` file with the drawer-aware version**

Open `packages/landing-web/src/components/Header.astro` and replace the entire contents with:

```astro
---
interface Props {
  activeNav?: 'protocol' | 'merchant' | 'developers' | 'governance' | 'manifesto' | null;
}
const { activeNav = null } = Astro.props;
const item = (key: string, base: string) =>
  key === activeNav
    ? `${base} text-on-background border-b border-on-background pb-1`
    : `${base} text-on-surface-variant hover:text-on-background pb-1 border-b border-transparent`;
const linkBase = 'transition-colors duration-240 font-body-main text-sm';
const mobileItem = (key: string) =>
  key === activeNav
    ? 'block py-3 text-on-background font-medium'
    : 'block py-3 text-on-surface-variant hover:text-on-background transition-colors duration-240';
---
<header data-ok-header class="fixed top-0 w-full z-50 bg-surface-container-lowest/90 backdrop-blur-md border-b border-on-background/10 transition-all duration-240">
  <div class="flex justify-between items-center px-8 md:px-16 h-20 w-full max-w-[1440px] mx-auto">
    <a href="/" class="flex items-center gap-3 group">
      <img src="/logo.png" alt="OpenKarta" class="ok-logo-img h-11 w-11 group-hover:rotate-[8deg]" />
      <span class="font-hero-h1 text-2xl tracking-tight text-on-background">OpenKarta</span>
    </a>
    <nav class="hidden md:flex gap-8">
      <a class={`${item('protocol', linkBase)} ok-link`} href="/protocol">Protocol</a>
      <a class={`${item('merchant', linkBase)} ok-link`} href="/merchant">Merchants</a>
      <a class={`${item('developers', linkBase)} ok-link`} href="/developers">Developers</a>
      <a class={`${item('governance', linkBase)} ok-link`} href="/governance">Governance</a>
      <a class={`${item('manifesto', linkBase)} ok-link`} href="/manifesto">Manifesto</a>
    </nav>
    <div class="hidden md:flex items-center gap-4">
      <a class="ok-link text-on-surface-variant hover:text-on-background transition-colors duration-240 text-sm font-medium" href="https://registry.openkarta.org/sign-in">Login</a>
      <a class="group bg-on-background text-surface-container-lowest px-4 py-2 text-sm font-medium border border-on-background hover:bg-surface-container-lowest hover:text-on-background transition-colors duration-240" href="/developers#install">Install SDK <span class="ok-arrow inline-block">↗</span></a>
    </div>
    <button
      id="ok-mobile-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="ok-mobile-nav"
      aria-label="Open navigation"
      class="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 text-on-background"
    >
      <span class="material-symbols-outlined" data-ok-mobile-icon aria-hidden="true">menu</span>
    </button>
  </div>
  <nav
    id="ok-mobile-nav"
    data-open="false"
    aria-hidden="true"
    class="md:hidden absolute left-0 right-0 top-full bg-surface-container-lowest border-t border-on-background/10 px-8 py-6 [padding-top:max(1.5rem,env(safe-area-inset-top))] hidden"
  >
    <a class={mobileItem('protocol')} href="/protocol">Protocol</a>
    <a class={mobileItem('merchant')} href="/merchant">Merchants</a>
    <a class={mobileItem('developers')} href="/developers">Developers</a>
    <a class={mobileItem('governance')} href="/governance">Governance</a>
    <a class={mobileItem('manifesto')} href="/manifesto">Manifesto</a>
    <div class="my-4 h-px bg-on-background/10"></div>
    <a class="block py-3 text-on-surface-variant hover:text-on-background transition-colors duration-240" href="https://registry.openkarta.org/sign-in">Login</a>
    <a class="mt-2 inline-flex bg-on-background text-surface-container-lowest px-4 py-3 text-sm font-medium border border-on-background hover:bg-surface-container-lowest hover:text-on-background transition-colors duration-240" href="/developers#install">Install SDK <span class="ok-arrow inline-block">↗</span></a>
  </nav>
</header>
<script is:inline>
  (function () {
    const btn = document.getElementById('ok-mobile-toggle');
    const panel = document.getElementById('ok-mobile-nav');
    if (!btn || !panel) return;
    const icon = btn.querySelector('[data-ok-mobile-icon]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastFocused = null;

    function focusables() {
      return panel.querySelectorAll('a, button');
    }

    function open() {
      lastFocused = document.activeElement;
      panel.classList.remove('hidden');
      panel.setAttribute('data-open', 'true');
      panel.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close navigation');
      if (icon) icon.textContent = 'close';
      document.body.classList.add('overflow-hidden');
      const m = window.__ok && window.__ok.motion;
      if (!reduced && m) {
        m.animate(panel, { opacity: [0, 1], transform: ['translateY(-8px)', 'translateY(0px)'] }, { duration: 0.24, easing: [0.2, 0, 0, 1] });
      }
      const first = focusables()[0];
      if (first) first.focus();
    }

    function close() {
      panel.setAttribute('data-open', 'false');
      panel.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open navigation');
      if (icon) icon.textContent = 'menu';
      document.body.classList.remove('overflow-hidden');
      const m = window.__ok && window.__ok.motion;
      if (!reduced && m) {
        m.animate(panel, { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(-8px)'] }, { duration: 0.18, easing: [0.2, 0, 0, 1] }).finished.then(() => {
          panel.classList.add('hidden');
          panel.style.opacity = '';
          panel.style.transform = '';
        });
      } else {
        panel.classList.add('hidden');
      }
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function isOpen() { return panel.getAttribute('data-open') === 'true'; }

    btn.addEventListener('click', () => { isOpen() ? close() : open(); });

    panel.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.tagName === 'A') close();
    });

    document.addEventListener('click', (e) => {
      if (!isOpen()) return;
      const t = e.target;
      if (panel.contains(t) || btn.contains(t)) return;
      close();
    });

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        const list = Array.from(focusables());
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = () => { if (mql.matches && isOpen()) close(); };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
  })();
</script>
```

- [ ] **Step 3: Build the site**

Run: `pnpm --filter @openkarta/landing-web run build`
Expected: `✓ Completed in <1s.` and `[build] 24 page(s) built`. No type errors.

- [ ] **Step 4: Manually verify the drawer in DevTools mobile emulation**

Run: `pnpm --filter @openkarta/landing-web run dev` (or `npx wrangler pages dev packages/landing-web/dist` if dev script not present).

DevTools → device emulation → iPhone SE (375×667). On any page (`/`):

1. Hamburger icon visible top-right; nav links and CTAs hidden.
2. Tap hamburger → drawer slides down with all 5 nav links + divider + Login + Install SDK.
3. Tap a nav link → navigates and drawer is closed on the new page.
4. Reopen drawer, hit Escape → closes; focus returns to hamburger.
5. Reopen, tap outside the panel → closes.
6. Reopen, then resize viewport to 1024 → drawer auto-closes; desktop nav reappears.
7. Tab through with keyboard while open → focus stays trapped inside the panel; Shift+Tab from first link wraps to last.
8. DevTools Rendering panel → enable "prefers-reduced-motion: reduce". Reopen → drawer appears instantly with no animation.

If any of 1–8 fails, fix and re-test before committing.

- [ ] **Step 5: Commit**

```bash
git add packages/landing-web/src/components/Header.astro
git commit -m "feat(landing-web): mobile nav drawer with focus trap and reduced-motion support"
```

---

### Task 2: `grid-cols-1` baselines on five pages

**Files:**
- Modify: `packages/landing-web/src/pages/index.astro:143`
- Modify: `packages/landing-web/src/pages/about.astro:14`
- Modify: `packages/landing-web/src/pages/developers.astro:30`
- Modify: `packages/landing-web/src/pages/manifest.astro:117`
- Modify: `packages/landing-web/src/pages/press.astro:49`

**Context:** Each of these grids has no `grid-cols-1` baseline, so cells try to stack as 2 or 3 columns even at 360px. Adding an explicit single-column floor makes them stack on small screens and keep their existing wider layout above the breakpoint.

- [ ] **Step 1: Reproduce the breakage**

In DevTools mobile emulation at 360px, navigate to `/`, `/about`, `/developers`, `/manifest`, `/press`. Confirm cells in the named grids overflow / squash into unreadable 2- or 3-col layouts.

- [ ] **Step 2: Edit `index.astro` stats grid**

In `packages/landing-web/src/pages/index.astro` line 143, change:

```html
<div class="grid grid-cols-3 gap-8 mb-16 border-t border-b border-on-background/10 py-8" data-ok-stagger=":scope > div">
```

to:

```html
<div class="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-16 border-t border-b border-on-background/10 py-8" data-ok-stagger=":scope > div">
```

- [ ] **Step 3: Edit `about.astro` 3-col grid**

In `packages/landing-web/src/pages/about.astro` line 14, change:

```html
<div class="grid md:grid-cols-3 gap-16">
```

to:

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-16">
```

- [ ] **Step 4: Edit `developers.astro` tracks grid**

In `packages/landing-web/src/pages/developers.astro` line 30, change:

```html
<div class="grid md:grid-cols-2 gap-px bg-on-background/10" data-ok-stagger=":scope > div">
```

to:

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-px bg-on-background/10" data-ok-stagger=":scope > div">
```

- [ ] **Step 5: Edit `manifest.astro` operations telemetry grid**

In `packages/landing-web/src/pages/manifest.astro` line 117, change:

```html
<div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-on-background/10 border border-on-background/10">
```

to:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px bg-on-background/10 border border-on-background/10">
```

- [ ] **Step 6: Edit `press.astro` factsheet grid**

In `packages/landing-web/src/pages/press.astro` line 49, change:

```html
<div class="grid grid-cols-2 md:grid-cols-3 gap-px bg-on-background/10 border border-on-background/10">
```

to:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-on-background/10 border border-on-background/10">
```

Leave the `aspect-square grid grid-cols-2` at line 90 (logo lockup) unchanged — that's a decorative 2×2 mark.

- [ ] **Step 7: Build the site**

Run: `pnpm --filter @openkarta/landing-web run build`
Expected: clean build, 24 pages.

- [ ] **Step 8: Re-verify in DevTools at 360px**

Reload `/`, `/about`, `/developers`, `/manifest`, `/press` at 375×667. Confirm each previously-broken grid now stacks one cell per row, and that at 768px (iPad Mini) the original multi-column layouts reappear.

- [ ] **Step 9: Commit**

```bash
git add packages/landing-web/src/pages/index.astro packages/landing-web/src/pages/about.astro packages/landing-web/src/pages/developers.astro packages/landing-web/src/pages/manifest.astro packages/landing-web/src/pages/press.astro
git commit -m "fix(landing-web): grid-cols-1 baseline on five pages so cells stack below sm/md"
```

---

### Task 3: Deploy Phase 1 to Cloudflare Pages

**Files:** none modified — deploy artefacts only.

- [ ] **Step 1: Build**

Run: `pnpm --filter @openkarta/landing-web run build`
Expected: clean build, 24 pages.

- [ ] **Step 2: Deploy to the `openkarta-landing` project on the `main` branch**

Run: `npx wrangler pages deploy packages/landing-web/dist --project-name openkarta-landing --branch main --commit-dirty=true`
Expected output ends with `✨ Deployment complete! Take a peek over at https://<hash>.openkarta-landing.pages.dev`. Capture the URL — it is needed for Task 5.

- [ ] **Step 3: Smoke-test the deploy URL on mobile**

Open the captured deploy URL in Chrome with DevTools mobile emulation (375×667). Walk through `/`, `/about`, `/developers`, `/merchant`, `/protocol`, `/registry`, `/manifest`, `/press`, `/conformance`, `/blog`, `/governance`, `/changelog`, `/status`. For each:
- Hamburger reachable, drawer opens, all 5 nav links present.
- No horizontal overflow.
- All grids stack to one column at 360px.

If any page regresses, return to Task 1 or Task 2 and fix before proceeding.

---

## Phase 2 — Lighthouse mobile audit

### Task 4: Run Lighthouse on five pages

**Files:** generates local `lighthouse-<slug>.json` artefacts (not committed).

- [ ] **Step 1: Verify Lighthouse is installed and Chrome is on the PATH**

Run: `npx --yes lighthouse --version`
Expected: a version number (e.g. `12.x.x`). If it fails on Windows because Chrome cannot be located, set `CHROME_PATH` to the local Chrome install (e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe`) and retry.

- [ ] **Step 2: Run Lighthouse against `/`**

Replace `<DEPLOY_URL>` with the URL captured in Task 3 Step 2. From the repo root:

```bash
npx lighthouse <DEPLOY_URL>/ \
  --form-factor=mobile \
  --throttling-method=simulate \
  --output=json \
  --output-path=./lighthouse-home.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo
```

Expected: a `lighthouse-home.json` file in repo root.

- [ ] **Step 3: Run Lighthouse against the four inner pages**

Run the same command four more times, swapping the URL path and `--output-path`:

```bash
npx lighthouse <DEPLOY_URL>/protocol --form-factor=mobile --throttling-method=simulate --output=json --output-path=./lighthouse-protocol.json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
npx lighthouse <DEPLOY_URL>/developers --form-factor=mobile --throttling-method=simulate --output=json --output-path=./lighthouse-developers.json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
npx lighthouse <DEPLOY_URL>/merchant --form-factor=mobile --throttling-method=simulate --output=json --output-path=./lighthouse-merchant.json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
npx lighthouse <DEPLOY_URL>/registry --form-factor=mobile --throttling-method=simulate --output=json --output-path=./lighthouse-registry.json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices,seo
```

Expected: five JSON files at the repo root, each with a top-level `categories` object with four entries.

- [ ] **Step 4: Fallback if local Lighthouse fails**

If `npx lighthouse` fails repeatedly on Windows due to Chrome path resolution: open <https://pagespeed.web.dev/>, run each of the five URLs with the "Mobile" tab selected, click "Download report" on each, and save the JSON to the same five filenames. The remaining steps treat the JSON as the source of truth, regardless of how it was produced.

---

### Task 5: Categorise Lighthouse findings into a Phase 3 punch list

**Files:**
- Create: `docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md` — append a "## Phase 2 audit results (2026-04-26)" section. Do not modify earlier sections.

- [ ] **Step 1: Extract category scores from each JSON**

For each of the 5 lighthouse JSON files, read `categories.performance.score`, `categories.accessibility.score`, `categories.best-practices.score`, `categories.seo.score`. Each is in `[0, 1]`; multiply by 100 to get the conventional 0–100 score.

Example (using Node):
```bash
node -e "const j=require('./lighthouse-home.json'); for (const k of ['performance','accessibility','best-practices','seo']) console.log(k, Math.round(j.categories[k].score*100))"
```

Capture the 5×4 = 20 scores in a markdown table.

- [ ] **Step 2: Extract failing audits per page**

For each JSON, iterate `audits` and collect entries where `score !== null && score < 0.9`. For each such audit, capture: `id`, `title`, `score`, `displayValue` (if any). These are the candidate findings.

```bash
node -e "const j=require('./lighthouse-home.json'); for (const a of Object.values(j.audits)) if (a.score!==null && a.score < 0.9) console.log(a.score.toFixed(2), a.id, '—', a.title)"
```

- [ ] **Step 3: Categorise each finding**

For every candidate finding, classify as:
- **Severity:** red (< 0.5), amber (0.5–0.89), green (≥ 0.9 — drop).
- **Category:** perf / a11y / SEO / best-practices.
- **Action:** one of `fix-in-phase-3a` (matches a static P1 item), `fix-in-phase-3b` (new — needs a dedicated task below), `defer-out-of-scope` (would require structural change such as replacing Tailwind Play CDN), `false-positive` (e.g., third-party CDN warnings we cannot influence).

- [ ] **Step 4: Append the audit results section to the spec**

Open `docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md` and append the following section verbatim, filling the placeholders with real data from Steps 1–3:

```markdown
## Phase 2 audit results (2026-04-26)

### Scores

| Page | Perf | A11y | BP | SEO |
|---|---|---|---|---|
| / | <n> | <n> | <n> | <n> |
| /protocol | <n> | <n> | <n> | <n> |
| /developers | <n> | <n> | <n> | <n> |
| /merchant | <n> | <n> | <n> | <n> |
| /registry | <n> | <n> | <n> | <n> |

### Findings classified for Phase 3

| ID | Title | Pages | Severity | Category | Action |
|---|---|---|---|---|---|
| <audit-id> | <title> | / · /protocol | amber | a11y | fix-in-phase-3b |
| … | … | … | … | … | … |
```

Concrete data only — no `<…>` placeholders. If a finding repeats across multiple pages, list them comma-separated in the Pages column.

- [ ] **Step 5: Commit the audit results**

```bash
git add docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md
git commit -m "docs(spec): append Phase 2 Lighthouse audit results to mobile-friendliness spec"
```

- [ ] **Step 6: Delete the local lighthouse JSON files**

```bash
rm lighthouse-home.json lighthouse-protocol.json lighthouse-developers.json lighthouse-merchant.json lighthouse-registry.json
```

(They are large, page-state-specific, and now superseded by the summary in the spec.)

---

## Phase 3 — P1 polish + Lighthouse-driven fixes

### Task 6: Hero typography floor

**Files:**
- Modify: `packages/landing-web/src/pages/index.astro:13`

**Context:** The hero H1 floor is currently `48px` at 360px viewport — `clamp(48px,8vw,108px)` resolves to `48px` because `8vw` of 360 is 28.8. Drop the floor to `40px` so the line wraps cleanly without overflow.

- [ ] **Step 1: Edit the H1 clamp**

In `packages/landing-web/src/pages/index.astro` line 13, change:

```html
<h1 class="font-hero-h1 text-on-background [font-size:clamp(48px,8vw,108px)] leading-[1.05] tracking-tight mb-8">
```

to:

```html
<h1 class="font-hero-h1 text-on-background [font-size:clamp(40px,8vw,108px)] leading-[1.05] tracking-tight mb-8">
```

- [ ] **Step 2: Verify in DevTools at 360 and 414**

Run dev server. At 375×667 and 414×896, the hero H1 should fit on three lines without horizontal overflow and without word-breaks mid-letter. At 768px and above, the size should be unchanged.

- [ ] **Step 3: Commit**

```bash
git add packages/landing-web/src/pages/index.astro
git commit -m "fix(landing-web): drop hero H1 clamp floor to 40px so it fits on 360px"
```

---

### Task 7: Skip the hero video on mobile

**Files:**
- Modify: `packages/landing-web/src/pages/index.astro:28`

**Context:** The hero video reel section is ~5MB. Loading it on a 4G mobile connection blows the LCP budget. Hide the section below `md` so the asset is never requested.

- [ ] **Step 1: Edit the hero video section**

In `packages/landing-web/src/pages/index.astro` line 28, change:

```html
<section class="px-8 md:px-16 max-w-[1440px] mx-auto mb-[160px]">
```

to:

```html
<section class="hidden md:block px-8 md:px-16 max-w-[1440px] mx-auto mb-[160px]">
```

- [ ] **Step 2: Verify the video does not load on mobile**

Run dev server, open `/` in DevTools at 375×667 with Network tab open and "Disable cache" checked. Hard-reload. Filter Network for `hero.mp4`. Expected: zero requests for `hero.mp4`. Then resize to 1024×768, hard-reload again — expected: one request for `hero.mp4`.

- [ ] **Step 3: Commit**

```bash
git add packages/landing-web/src/pages/index.astro
git commit -m "perf(landing-web): hide hero video section below md to skip 5MB asset on mobile"
```

---

### Task 8: Footer mobile grid baseline

**Files:**
- Modify: `packages/landing-web/src/components/Footer.astro:5`

**Context:** Footer outer grid is `grid-cols-2 md:grid-cols-4 lg:grid-cols-6`. At 360px the two-column layout squashes the long brand+copyright cell. Add an explicit single-column floor for narrowest screens.

- [ ] **Step 1: Edit the Footer grid**

In `packages/landing-web/src/components/Footer.astro` line 5, change:

```html
<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 max-w-[1440px] mx-auto w-full py-20 px-8 md:px-16">
```

to:

```html
<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 max-w-[1440px] mx-auto w-full py-20 px-8 md:px-16">
```

The brand cell uses `col-span-2 lg:col-span-2` (line 6). At `grid-cols-1`, `col-span-2` clamps to the available column count — verify in Step 2.

- [ ] **Step 2: Verify in DevTools at 360, 640, and 768**

At 375×667 the footer should stack as one column per cell. At 640×1080 (sm breakpoint) it should be two columns with the brand cell spanning both. At 768×1024 it should be four columns with brand spanning two.

- [ ] **Step 3: Commit**

```bash
git add packages/landing-web/src/components/Footer.astro
git commit -m "fix(landing-web): footer grid-cols-1 baseline so smallest screens stack to one column"
```

---

### Task 9: Loop diagram intrinsic dimensions

**Files:**
- Modify: `packages/landing-web/src/pages/index.astro:136`

**Context:** The loop diagram `<img>` has no `width`/`height`, which causes Cumulative Layout Shift on first render. The PNG is verified-1024×1024 — set those as intrinsic dimensions; CSS `w-full max-w-md h-auto` already controls the rendered size, the attributes only inform the browser of aspect ratio.

- [ ] **Step 1: Edit the img tag**

In `packages/landing-web/src/pages/index.astro` line 136, change:

```html
<img src="/loop-diagram.png" alt="OpenKarta core execution loop diagram" class="w-full max-w-md h-auto border border-on-background/10 bg-surface-container-lowest" />
```

to:

```html
<img src="/loop-diagram.png" alt="OpenKarta core execution loop diagram" width="1024" height="1024" class="w-full max-w-md h-auto border border-on-background/10 bg-surface-container-lowest" />
```

- [ ] **Step 2: Verify CLS is reduced**

Run dev server. Open `/` in DevTools mobile, throttle to "Slow 4G", hard-reload. In the Performance panel (or Performance Insights), confirm the loop diagram does not produce a layout shift event when it loads. (It should reserve its 1:1 aspect-ratio box from first paint.)

- [ ] **Step 3: Commit**

```bash
git add packages/landing-web/src/pages/index.astro
git commit -m "perf(landing-web): add width/height to loop diagram img to eliminate CLS"
```

---

### Task 10: Apply Phase 2 conditional fixes (driven by audit punch list)

**Files:** depends on punch list — likely subset of:
- `packages/landing-web/src/layouts/BaseLayout.astro` (color tokens, font preload)
- `packages/landing-web/src/pages/*.astro` (per-page `description` props)
- `packages/landing-web/src/pages/index.astro` (scenario rotator tab `py-3`)
- `packages/landing-web/src/pages/registry.astro` (refresh button `py-3`)
- `packages/landing-web/src/pages/blog/*.astro` (← All posts link `py-3`)

**Context:** This task is gated on Task 5's punch list. For each finding the punch list classified as `fix-in-phase-3b`, perform the matching sub-step below. Skip any sub-step whose finding does not appear in the punch list.

- [ ] **Step 1: Contrast — only if `color-contrast` audit fails**

The current `text-on-surface-variant` token is `#434656` (BaseLayout.astro line 77). If Lighthouse reports `color-contrast` failures whose root token is `text-on-surface-variant`, darken it to `#373a48`. In `packages/landing-web/src/layouts/BaseLayout.astro` line 77, change:

```javascript
'on-surface-variant': '#434656',
```

to:

```javascript
'on-surface-variant': '#373a48',
```

(`#434656` is the existing value — verified before the plan was written. If the value has drifted, target an OK delta-E that pushes it darker, not lighter, so it still reads as a muted secondary tone.)

Verify by re-running Lighthouse against `/` after this single change. The `color-contrast` audit should pass.

- [ ] **Step 2: Tap targets — only if `tap-targets` audit fails**

Identify the offending elements from the audit's `details.items`. The most likely candidates and their fixes:

In `packages/landing-web/src/pages/index.astro` lines 41–45 (scenario tabs), each button currently has `pb-1`. Wrap the padding to `py-3 px-1` so the tap area meets 44px:

Change every line like:
```html
<button type="button" data-ok-scene-tab="0" class="ok-scene-tab text-on-background border-b border-on-background pb-1 transition-colors duration-240">Product</button>
```

to:
```html
<button type="button" data-ok-scene-tab="0" class="ok-scene-tab text-on-background border-b border-on-background py-3 px-1 transition-colors duration-240">Product</button>
```

(Apply to all five tabs — Product, Stay, Flight, Bus, Service.)

In `packages/landing-web/src/pages/status.astro` line 58 and `packages/landing-web/src/pages/registry.astro` (refresh / submit buttons that the audit flags), change the inline padding from any `py-{1,2}` to `py-3`.

In `packages/landing-web/src/pages/blog/*.astro` (or wherever the "← All posts" link lives — find via `grep -rn "All posts" packages/landing-web/src`), change the `<a>` to include `py-3 inline-block`.

For each fix, re-emulate at 375×667 and confirm the tap area is at least 44×44 by inspecting the bounding box in DevTools.

- [ ] **Step 3: Meta descriptions — only if `meta-description` audit fails**

For each page flagged: open the page (e.g. `packages/landing-web/src/pages/protocol.astro`) and confirm the `<BaseLayout>` invocation passes a `description` prop. If missing, add one:

```astro
<BaseLayout title="Protocol — OpenKarta" description="The OpenKarta protocol: eight verbs, five item types, and the wire format every conformant agent speaks." activeNav="protocol">
```

Keep descriptions to one sentence, ≤ 160 chars, page-specific.

- [ ] **Step 4: Font preload — only if `unused-css-rules` or `render-blocking-resources` flag the Google Fonts request**

In `packages/landing-web/src/layouts/BaseLayout.astro`, between line 26 (`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`) and line 27 (the existing Google Fonts stylesheet `<link>`), insert one preload for the most-used cut (Inter 400 woff2). Get the exact woff2 URL from the Network panel after a fresh page load (it's a `gstatic.com/s/inter/...woff2` URL). Then add:

```html
<link rel="preload" as="font" type="font/woff2" href="<exact-woff2-url-from-network-panel>" crossorigin />
```

Re-run Lighthouse on `/`. The audit should improve. If it does not, revert this change — preloading the wrong cut can hurt more than it helps.

- [ ] **Step 5: Commit**

After all applicable sub-steps land:

```bash
git add packages/landing-web/src/
git commit -m "fix(landing-web): Lighthouse-driven mobile polish (contrast / tap targets / meta / preload)"
```

(If only some sub-steps applied, narrow the commit message accordingly. If none applied because Phase 2 had no `fix-in-phase-3b` findings, skip Task 10 entirely.)

---

### Task 11: Deploy Phase 3 to Cloudflare Pages

**Files:** none modified — deploy artefacts only.

- [ ] **Step 1: Build**

Run: `pnpm --filter @openkarta/landing-web run build`
Expected: clean build, 24 pages.

- [ ] **Step 2: Deploy**

Run: `npx wrangler pages deploy packages/landing-web/dist --project-name openkarta-landing --branch main --commit-dirty=true`
Expected: a fresh deploy URL, e.g. `https://<hash>.openkarta-landing.pages.dev`. Capture this URL — Task 12 needs it.

---

### Task 12: Final Lighthouse mobile re-run on `/`

**Files:** generates `lighthouse-final-home.json` (not committed — the score is the deliverable).

- [ ] **Step 1: Re-run Lighthouse on the Phase 3 deploy URL**

Replace `<DEPLOY_URL>` with the URL from Task 11 Step 2:

```bash
npx lighthouse <DEPLOY_URL>/ \
  --form-factor=mobile \
  --throttling-method=simulate \
  --output=json \
  --output-path=./lighthouse-final-home.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo
```

- [ ] **Step 2: Read out the four scores**

```bash
node -e "const j=require('./lighthouse-final-home.json'); for (const k of ['performance','accessibility','best-practices','seo']) console.log(k, Math.round(j.categories[k].score*100))"
```

Expected: every score ≥ 90.

- [ ] **Step 3: If any score is < 90, decide**

For each below-threshold score: identify the dominant audit failures (re-run the categorisation script from Task 5 Step 2 on `lighthouse-final-home.json`). For each, decide:
- **In-scope retry:** small fix (token tweak, attribute add, etc.) — patch and redeploy, then re-run.
- **Out of scope:** a structural finding (e.g., LCP needs Tailwind Play CDN replaced; Best Practices needs HTTPS-only third-party assets we don't control). Document as a follow-up issue and accept the score for this pass.

Keep retries to a maximum of two cycles before accepting and documenting the gap.

- [ ] **Step 4: Append final scores to the spec**

Open `docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md` and append:

```markdown
## Phase 3 final scores (2026-04-26)

| Category | Score | Status |
|---|---|---|
| Performance | <n> | pass / accept |
| Accessibility | <n> | pass / accept |
| Best practices | <n> | pass / accept |
| SEO | <n> | pass / accept |

Final deploy URL: <url>
```

- [ ] **Step 5: Commit and clean up**

```bash
rm lighthouse-final-home.json
git add docs/superpowers/specs/2026-04-26-mobile-friendliness-design.md
git commit -m "docs(spec): record Phase 3 final Lighthouse mobile scores"
```

---

### Task 13: Final manual sweep across all 11 primary pages

**Files:** none modified — verification only.

- [ ] **Step 1: Sweep at 360, 414, 768, 1024**

For each viewport (iPhone SE 375, Pixel 7 414, iPad Mini 768, iPad Pro 1024), open the Phase 3 deploy URL and walk: `/`, `/protocol`, `/merchant`, `/developers`, `/conformance`, `/registry`, `/manifest`, `/blog`, `/governance`, `/changelog`, `/status`. Verify on every page:
- No horizontal overflow.
- Hamburger drawer reachable (≤ 768) or desktop nav reachable (≥ 768).
- All grids stack to a sensible single or double column at 360.
- Hero video does not load at 360 (Network panel filtered to `hero.mp4`).
- All content is readable — no truncation, no clipping.

- [ ] **Step 2: Drawer regression suite**

On `/` at 375×667: open drawer, verify each of the 5 nav links + Login + Install SDK navigates correctly. Open drawer, hit Escape — closes. Open drawer, tap outside — closes. Open drawer, resize to 1024 — auto-closes. Tab into drawer → focus traps. Toggle prefers-reduced-motion → animation disabled but drawer still works.

- [ ] **Step 3: Sign off**

If all checks pass, the mobile-friendliness pass is complete. The success criteria from the spec are met:

1. ✅ No layout overflow on 11 primary pages at 360px.
2. ✅ Every primary page reachable from the mobile drawer.
3. ✅ Drawer passes keyboard / Escape / outside-tap / resize tests.
4. ✅ Final Lighthouse mobile on `/` ≥ 90 across four categories (or documented gap).
5. ✅ Hero video does not load on mobile (Network panel verified).

If any check fails, return to the relevant Phase 1 or Phase 3 task and fix.

---

## Self-review notes

- **Spec coverage:** Every Phase 1, 3a, and 3b item from the spec maps to a task above (Task 1 = Phase 1a; Task 2 = Phase 1b; Tasks 6–9 = Phase 3a; Task 10 = Phase 3b; Tasks 4–5 = Phase 2; Task 12 + Task 13 = success criteria verification).
- **Phase 1b file count:** Spec lists 5 files; Task 2 modifies all 5 with their exact line numbers.
- **No placeholders:** Every step contains the exact code or command. Lighthouse JSON paths and shell snippets are concrete.
- **Type/name consistency:** drawer DOM ids `ok-mobile-toggle` / `ok-mobile-nav` are referenced consistently in the markup and the inline JS.
- **Out-of-scope items intentionally excluded:** replacing Tailwind Play CDN with a compiled stylesheet; adopting Cloudflare Images for the loop diagram. The spec calls these out as deferred — Task 12 Step 3 surfaces them again if a Phase 2 finding makes them load-bearing.
