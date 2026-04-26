# Landing color usage pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Teal Lagoon palette visibly across all landing pages — colored sections, ghost-on-tint secondary buttons, accent cards, branded closing CTAs.

**Architecture:** Mechanical class-string migrations. No structural HTML changes. All token shifts live in `tokens.css`. Page-by-page edits are exact-string `Edit replace_all` swaps.

**Tech Stack:** Astro 4 + Tailwind CDN runtime + CSS custom properties.

---

### Task 1: Token rebalance

**Files:**
- Modify: `packages/landing-web/src/styles/tokens.css:48-67`

- [ ] **Step 1: Update surface ladder values**

Replace the surface block with:
```css
  --color-background: #D0DEE0;
  --color-on-background: #0F2326;
  --color-surface: #D0DEE0;
  --color-on-surface: #0F2326;
  --color-surface-bright: #E8F0F1;
  --color-surface-dim: #88AAB0;
  --color-surface-container-lowest: #E8F0F1;
  --color-surface-container-low: #A8C5C8;
  --color-surface-container: #BDD0D2;
  --color-surface-container-high: #88AAB0;
  --color-surface-container-highest: #5F8D93;
  --color-surface-variant: #BDD0D2;
  --color-on-surface-variant: #2F4045;
  --color-inverse-surface: #243033;
  --color-inverse-on-surface: #F0F4F4;
  --color-outline: #5A7479;
  --color-outline-variant: #A8C5C8;
```

- [ ] **Step 2: Verify dev server hot-reloads**

Watch dev server output for `[watch] /src/styles/tokens.css`. Open `http://localhost:4321/` — page bg now light teal, cards visibly tinted, deepened bands stand out.

---

### Task 2: Header "Install SDK" button → primary teal

**Files:**
- Modify: `packages/landing-web/src/components/Header.astro` (2 occurrences — desktop + mobile)

- [ ] **Step 1: Replace desktop button**

Find and replace exact string:
- OLD: `bg-on-background text-surface-container-lowest px-4 py-2 text-sm font-medium border border-on-background hover:bg-surface-container-lowest hover:text-on-background transition-colors duration-240`
- NEW: `bg-primary text-on-primary px-4 py-2 text-sm font-medium border border-primary hover:bg-primary-container hover:border-primary-container transition-colors duration-240`

- [ ] **Step 2: Replace mobile button**

Find and replace exact string:
- OLD: `mt-2 inline-flex bg-on-background text-surface-container-lowest px-4 py-3 text-sm font-medium border border-on-background hover:bg-surface-container-lowest hover:text-on-background transition-colors duration-240`
- NEW: `mt-2 inline-flex bg-primary text-on-primary px-4 py-3 text-sm font-medium border border-primary hover:bg-primary-container hover:border-primary-container transition-colors duration-240`

---

### Task 3: Secondary buttons across all pages → ghost-on-tint teal

**Files:** all `.astro` files under `packages/landing-web/src/pages/` that match the old ghost-charcoal pattern.

- [ ] **Step 1: Find affected pages**

Run Grep for `bg-transparent text-on-background px-6 py-3 border border-on-background hover:bg-on-background hover:text-surface-container-lowest transition-colors duration-240` across `packages/landing-web/src/pages`.

- [ ] **Step 2: Replace pattern in each page**

For each match, exact-string replace (with `replace_all`):
- OLD: `bg-transparent text-on-background px-6 py-3 border border-on-background hover:bg-on-background hover:text-surface-container-lowest transition-colors duration-240`
- NEW: `bg-transparent text-primary px-6 py-3 border-2 border-primary hover:bg-primary hover:text-on-primary transition-colors duration-240`

---

### Task 4: Closing CTA blocks → primary teal full-bleed

**Files:** any `.astro` file with the charcoal-closer pattern. Confirmed: `developers.astro:128-134`. Possibly others.

- [ ] **Step 1: Find affected pages**

Grep for `bg-on-background text-surface-container-lowest p-12 md:p-20` in `packages/landing-web/src/pages`.

- [ ] **Step 2: Replace closer block**

For each match:
- OLD: `bg-on-background text-surface-container-lowest p-12 md:p-20`
- NEW: `bg-primary text-on-primary p-12 md:p-20`

- [ ] **Step 3: Replace inner heading text-color**

Inside the same blocks, the heading uses `text-surface-container-lowest`. Replace inside the closer block scope:
- OLD: `text-surface-container-lowest max-w-2xl mb-8`
- NEW: `text-on-primary max-w-2xl mb-8`

- [ ] **Step 4: Replace inner buttons**

The inverted buttons inside the closer were styled to flip on hover. Replace with on-primary appropriate variants:
- OLD primary inverted: `bg-surface-container-lowest text-on-background px-6 py-3 border border-surface-container-lowest hover:bg-transparent hover:text-surface-container-lowest transition-colors duration-240`
- NEW: `bg-on-primary text-primary px-6 py-3 border border-on-primary hover:bg-transparent hover:text-on-primary transition-colors duration-240`

- OLD secondary inverted: `bg-transparent text-surface-container-lowest px-6 py-3 border border-surface-container-lowest hover:bg-surface-container-lowest hover:text-on-background transition-colors duration-240`
- NEW: `bg-transparent text-on-primary px-6 py-3 border border-on-primary hover:bg-on-primary hover:text-primary transition-colors duration-240`

---

### Task 5: Hero label-caps strip → primary pill (top hero only)

**Files:** main hero pages — `index.astro`, `developers.astro`, `conformance.astro`, `registry.astro`, `protocol.astro`, `merchant.astro`, `about.astro`.

- [ ] **Step 1: Find first hero label-caps strip in each page**

For each page, locate the first occurrence of:
```
<div class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-8">
```

- [ ] **Step 2: Replace with primary pill**

Convert the wrapping div to a pill:
- OLD wrapper: `font-label-caps text-label-caps text-on-surface-variant uppercase mb-8`
- NEW wrapper: `font-label-caps text-label-caps uppercase mb-8 bg-primary text-on-primary inline-block px-3 py-1`

Only the FIRST hero strip per page. Body-section label-caps stay neutral.

---

### Task 6: Accent card — developers.astro Track A

**Files:**
- Modify: `packages/landing-web/src/pages/developers.astro:32`

- [ ] **Step 1: Make Track A the accent card**

Track A is the recommended "Brand agent" track. Change its card's container class:
- OLD: `border border-on-background/10 bg-surface-container-lowest p-12 hover-lift`
- NEW: `border border-primary-container bg-primary-container text-on-primary-container p-12 hover-lift`

- [ ] **Step 2: Adjust inner copy color (Track A only)**

Inside Track A only, ensure the descriptive paragraph reads correctly on deep teal. Replace the paragraph class:
- OLD: `font-body-main text-body-main text-on-surface-variant mb-8`
- NEW: `font-body-main text-body-main text-on-primary-container mb-8`

The label-caps + h2 + button are already legible on `text-on-primary-container` since they inherit (or use `text-on-background` which we leave to fall through to the parent). If h2/label fail contrast in the eye-test, swap them inline.

---

### Task 7: Build, deploy, push

- [ ] **Step 1: Production build**

Run: `pnpm --filter landing-web build`
Expected: 24 pages built, no errors.

- [ ] **Step 2: Deploy to Cloudflare Pages**

Run: `pnpm --filter landing-web exec wrangler pages deploy dist --project-name openkarta-landing --branch main --commit-dirty=true`
Expected: `✨ Deployment complete!` with new pages.dev URL.

- [ ] **Step 3: Verify live**

Curl `https://openkarta.org/developers/` and grep for new CSS bundle hash + sage→teal token presence.

- [ ] **Step 4: Commit all changes**

Stage all modified files (tokens.css, Header.astro, page files), commit with descriptive message.

- [ ] **Step 5: Push to GitHub**

Run: `git push origin feat/orchestrator-and-cli`
