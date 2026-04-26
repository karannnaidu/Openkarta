# Landing site Quiet Sage palette + token CSS file — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unused blue brand accent on the OpenKarta landing site with a calm sage green (`#4A7C59`), tint the surface ladder with a faint sage wash, and extract all color tokens into a single CSS-variables source-of-truth file (`tokens.css`).

**Architecture:** Two-file change. New `packages/landing-web/src/styles/tokens.css` defines all color tokens as CSS custom properties on `:root`. `packages/landing-web/src/layouts/BaseLayout.astro` imports tokens.css in frontmatter, references `var(--color-*)` in its inline Tailwind CDN config block, and uses `var(--color-*)` in its global `<style>` block (diagram rules). Page files do not change — they use Tailwind class names that auto-pick-up the new token values.

**Tech Stack:** Astro 4 (static), Tailwind CSS via CDN runtime, vanilla CSS custom properties.

**Reference spec:** `docs/superpowers/specs/2026-04-26-landing-secondary-color-palette-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/landing-web/src/styles/tokens.css` | **Create** | Single source of truth for all color tokens. Pure CSS variables on `:root`. No selectors beyond `:root`. |
| `packages/landing-web/src/layouts/BaseLayout.astro` | **Edit** | Consumer of tokens. Imports `tokens.css` in frontmatter; Tailwind config uses `var()` refs; global `<style>` diagram rules use `var()` refs. |

No other files in `packages/landing-web/` are touched. No other packages are touched. No test files exist for this package and none are added — verification is by build success, grep checks, and manual visual inspection.

---

### Task 1: Create the tokens CSS file

**Files:**
- Create: `packages/landing-web/src/styles/tokens.css`

- [ ] **Step 1: Create the file with all color tokens**

Write the file exactly as below. This is the single source of truth — every color the landing site uses lives here.

```css
/*
 * OpenKarta landing site — color tokens.
 * Single source of truth. Edit this file to change the palette.
 *
 * Palette: Quiet Sage (sage green accent + sage-tinted surface ladder).
 * Spec: docs/superpowers/specs/2026-04-26-landing-secondary-color-palette-design.md
 */

:root {
  /* Brand accent — Quiet Sage */
  --color-primary: #4A7C59;
  --color-on-primary: #FFFFFF;
  --color-primary-container: #3D6649;
  --color-on-primary-container: #DCEAD9;
  --color-inverse-primary: #A8C8AE;
  --color-primary-fixed: #DCEAD9;
  --color-primary-fixed-dim: #A8C8AE;
  --color-on-primary-fixed: #0F2014;
  --color-on-primary-fixed-variant: #2F5039;
  --color-surface-tint: #4A7C59;

  /* Secondary — neutral (unchanged) */
  --color-secondary: #5F5E5E;
  --color-on-secondary: #FFFFFF;
  --color-secondary-container: #E5E2E1;
  --color-on-secondary-container: #656464;
  --color-secondary-fixed: #E5E2E1;
  --color-secondary-fixed-dim: #C9C6C5;
  --color-on-secondary-fixed: #1C1B1B;
  --color-on-secondary-fixed-variant: #474646;

  /* Tertiary — neutral (unchanged) */
  --color-tertiary: #4C4E4F;
  --color-on-tertiary: #FFFFFF;
  --color-tertiary-container: #656666;
  --color-on-tertiary-container: #E4E4E5;
  --color-tertiary-fixed: #E2E2E2;
  --color-tertiary-fixed-dim: #C6C6C7;
  --color-on-tertiary-fixed: #1A1C1C;
  --color-on-tertiary-fixed-variant: #454747;

  /* Error — standard red (unchanged) */
  --color-error: #BA1A1A;
  --color-on-error: #FFFFFF;
  --color-error-container: #FFDAD6;
  --color-on-error-container: #93000A;

  /* Surface ladder — sage-tinted */
  --color-background: #FAFBF9;
  --color-on-background: #1B1C1C;
  --color-surface: #FAFBF9;
  --color-on-surface: #1B1C1C;
  --color-surface-bright: #FAFBF9;
  --color-surface-dim: #C7D2C2;
  --color-surface-container-lowest: #FFFFFF;
  --color-surface-container-low: #F1F4EF;
  --color-surface-container: #E8EEE5;
  --color-surface-container-high: #DCE5D8;
  --color-surface-container-highest: #CDDAC8;
  --color-surface-variant: #DCE5D8;
  --color-on-surface-variant: #434656;
  --color-inverse-surface: #303031;
  --color-inverse-on-surface: #F2F0F0;
  --color-outline: #7A8A78;
  --color-outline-variant: #C7D2C2;
}
```

- [ ] **Step 2: Verify file exists and parses**

Run: `node -e "const c = require('fs').readFileSync('packages/landing-web/src/styles/tokens.css','utf8'); console.log('lines:', c.split('\n').length, 'has primary:', c.includes('--color-primary:'));"`

Expected output (approximate):
```
lines: 65 has primary: true
```

- [ ] **Step 3: Commit**

```bash
git add packages/landing-web/src/styles/tokens.css
git commit -m "feat(landing-web): add tokens.css as single source of truth for color tokens"
```

---

### Task 2: Wire BaseLayout to import tokens.css and use var() refs in Tailwind config

**Files:**
- Modify: `packages/landing-web/src/layouts/BaseLayout.astro`

The current frontmatter (lines 1–16) imports the Header and Footer components and defines the Props interface. We add a CSS import.

The current Tailwind config block (lines 29–115, inside `<script is:inline>`) hardcodes hex values in the `colors` object. We replace each value with a `var(--color-*)` reference. We do **not** touch `spacing`, `fontFamily`, `fontSize`, or `borderRadius` — those stay as-is.

- [ ] **Step 1: Add the CSS import to the frontmatter**

In `packages/landing-web/src/layouts/BaseLayout.astro`, change the frontmatter (lines 1–16) from:

```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
  activeNav?: 'protocol' | 'merchant' | 'governance' | 'developers' | 'manifesto' | null;
}

const {
  title,
  description = 'OpenKarta — The open contract for agentic commerce.',
  activeNav = null,
} = Astro.props;
---
```

to:

```astro
---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import '../styles/tokens.css';

interface Props {
  title: string;
  description?: string;
  activeNav?: 'protocol' | 'merchant' | 'governance' | 'developers' | 'manifesto' | null;
}

const {
  title,
  description = 'OpenKarta — The open contract for agentic commerce.',
  activeNav = null,
} = Astro.props;
---
```

(The single new line is `import '../styles/tokens.css';`.)

- [ ] **Step 2: Replace the colors block in the inline Tailwind config**

In the same file, locate the `colors:` object inside the inline `<script is:inline>` Tailwind config (currently lines 35–83). Replace the entire `colors:` object (every key/value pair from `primary:` through `'outline-variant':`) with the version below. Every value is now a `var()` reference.

```js
          colors: {
            primary: 'var(--color-primary)',
            'on-primary': 'var(--color-on-primary)',
            'primary-container': 'var(--color-primary-container)',
            'on-primary-container': 'var(--color-on-primary-container)',
            'inverse-primary': 'var(--color-inverse-primary)',
            'primary-fixed': 'var(--color-primary-fixed)',
            'primary-fixed-dim': 'var(--color-primary-fixed-dim)',
            'on-primary-fixed': 'var(--color-on-primary-fixed)',
            'on-primary-fixed-variant': 'var(--color-on-primary-fixed-variant)',
            secondary: 'var(--color-secondary)',
            'on-secondary': 'var(--color-on-secondary)',
            'secondary-container': 'var(--color-secondary-container)',
            'on-secondary-container': 'var(--color-on-secondary-container)',
            'secondary-fixed': 'var(--color-secondary-fixed)',
            'secondary-fixed-dim': 'var(--color-secondary-fixed-dim)',
            'on-secondary-fixed': 'var(--color-on-secondary-fixed)',
            'on-secondary-fixed-variant': 'var(--color-on-secondary-fixed-variant)',
            tertiary: 'var(--color-tertiary)',
            'on-tertiary': 'var(--color-on-tertiary)',
            'tertiary-container': 'var(--color-tertiary-container)',
            'on-tertiary-container': 'var(--color-on-tertiary-container)',
            'tertiary-fixed': 'var(--color-tertiary-fixed)',
            'tertiary-fixed-dim': 'var(--color-tertiary-fixed-dim)',
            'on-tertiary-fixed': 'var(--color-on-tertiary-fixed)',
            'on-tertiary-fixed-variant': 'var(--color-on-tertiary-fixed-variant)',
            error: 'var(--color-error)',
            'on-error': 'var(--color-on-error)',
            'error-container': 'var(--color-error-container)',
            'on-error-container': 'var(--color-on-error-container)',
            background: 'var(--color-background)',
            'on-background': 'var(--color-on-background)',
            surface: 'var(--color-surface)',
            'on-surface': 'var(--color-on-surface)',
            'surface-dim': 'var(--color-surface-dim)',
            'surface-bright': 'var(--color-surface-bright)',
            'surface-container-lowest': 'var(--color-surface-container-lowest)',
            'surface-container-low': 'var(--color-surface-container-low)',
            'surface-container': 'var(--color-surface-container)',
            'surface-container-high': 'var(--color-surface-container-high)',
            'surface-container-highest': 'var(--color-surface-container-highest)',
            'surface-variant': 'var(--color-surface-variant)',
            'on-surface-variant': 'var(--color-on-surface-variant)',
            'surface-tint': 'var(--color-surface-tint)',
            'inverse-surface': 'var(--color-inverse-surface)',
            'inverse-on-surface': 'var(--color-inverse-on-surface)',
            outline: 'var(--color-outline)',
            'outline-variant': 'var(--color-outline-variant)',
          },
```

- [ ] **Step 3: Verify no hardcoded hex values remain in the colors block**

Run a grep over the file looking for the old blue values that used to live in the colors block:

```
Grep pattern: #003ec7|#0052ff|#dfe3ff|#b7c4ff|#dde1ff|#001452|#0038b6|#004ced
File: packages/landing-web/src/layouts/BaseLayout.astro
```

Expected: no matches in the inline Tailwind config (the global `<style>` block still has `#0052FF` and `rgba(0, 82, 255, 0.1)` — those get replaced in Task 3).

- [ ] **Step 4: Commit**

```bash
git add packages/landing-web/src/layouts/BaseLayout.astro
git commit -m "refactor(landing-web): import tokens.css and reference CSS variables in Tailwind config"
```

---

### Task 3: Replace hardcoded hex values in BaseLayout's global style block with var() refs

**Files:**
- Modify: `packages/landing-web/src/layouts/BaseLayout.astro`

The current global `<style is:global>` block (around lines 116–181) has four rules with hardcoded hex values that need to consume the new tokens. Specifically: `.diagram-node`, `.diagram-line`, `.diagram-highlight`, and `.mono-diagram-highlight`.

- [ ] **Step 1: Update the four diagram rules**

Locate this block in the file (currently lines 166–170):

```css
  .diagram-node { border: 1px solid #1b1c1c; }
  .diagram-line { background-color: #1b1c1c; }
  .diagram-highlight { background-color: #0052FF; border-color: #0052FF; color: white; }
  .mono-diagram-line { stroke: currentColor; stroke-width: 1; fill: none; }
  .mono-diagram-highlight { stroke: #0052FF; stroke-width: 2; fill: rgba(0, 82, 255, 0.1); }
```

Replace it with:

```css
  .diagram-node { border: 1px solid var(--color-on-background); }
  .diagram-line { background-color: var(--color-on-background); }
  .diagram-highlight { background-color: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
  .mono-diagram-line { stroke: currentColor; stroke-width: 1; fill: none; }
  .mono-diagram-highlight { stroke: var(--color-primary); stroke-width: 2; fill: rgb(74 124 89 / 0.12); }
```

Notes:
- `.mono-diagram-line` is unchanged (uses `currentColor`).
- `.mono-diagram-highlight` fill stays as a literal rgb at 12% alpha. We don't wrap a `var()` inside `rgb(...)` because the variable isn't decomposed into channels. If the primary hex ever changes, update this fill literal alongside `tokens.css` (noted in spec).

- [ ] **Step 2: Verify no remaining hardcoded blue/old hex values in the file**

Run a grep over the file for the previous hardcoded blue values used anywhere (config block + style block):

```
Grep pattern: #003ec7|#0052ff|#0052FF|#004ced|#dfe3ff|#b7c4ff|#dde1ff|#001452|#0038b6|0,\s*82,\s*255
File: packages/landing-web/src/layouts/BaseLayout.astro
```

Expected: zero matches.

Also grep across the entire `packages/landing-web/src/` directory for the same patterns to confirm nothing was missed in pages or components:

```
Grep pattern: #003ec7|#0052ff|#0052FF|#004ced|0,\s*82,\s*255
Path: packages/landing-web/src/
```

Expected: zero matches.

- [ ] **Step 3: Commit**

```bash
git add packages/landing-web/src/layouts/BaseLayout.astro
git commit -m "refactor(landing-web): switch diagram styles to CSS variable references"
```

---

### Task 4: Build and visual verification

**Files:**
- None modified. Verification only.

This task confirms the build succeeds, no console errors appear, and the new palette renders correctly across the site.

- [ ] **Step 1: Install (if needed) and run the production build**

From the repo root:

```bash
pnpm --filter landing-web build
```

Expected: build completes without errors. The terminal shows generated routes for all pages (index, protocol, merchant, governance, developers, manifesto, about, conformance, registry, charter, manifest, status, security, privacy, terms, press, blog, blog posts, changelog, 404).

If the build errors with anything related to the import path (e.g., "Cannot find module '../styles/tokens.css'"), confirm `packages/landing-web/src/styles/tokens.css` exists at exactly that path.

- [ ] **Step 2: Start the dev server**

```bash
pnpm --filter landing-web dev
```

Expected: dev server starts on a local port (typically 4321). No errors in terminal output.

- [ ] **Step 3: Open the home page and confirm visually**

Open `http://localhost:4321/` in a browser.

Confirm:
- Page background is near-white with the slightest warm-cool tone (`#FAFBF9`), not pure gray.
- Any "card" or "container" surfaces (e.g., feature boxes, code blocks) show a subtle sage tint distinct from the page background.
- Any place a primary CTA or accent appears (e.g., the diagram highlight on the protocol page, primary buttons), it reads as sage green (`#4A7C59`), not blue.
- Selecting body text shows a sage-green selection highlight (not blue).

- [ ] **Step 4: Spot-check three more pages**

Visit:
- `http://localhost:4321/protocol` — confirm diagram highlight blocks are sage, not blue.
- `http://localhost:4321/merchant` — confirm buttons / accent blocks are sage.
- `http://localhost:4321/manifesto` — confirm any quote blocks / surface containers show subtle sage tint.

If any page still shows blue accents, return to Task 3 Step 2 and re-run the grep. Investigate any remaining match.

- [ ] **Step 5: Confirm reduced-motion still works (no regression)**

In your browser devtools, toggle "Emulate prefers-reduced-motion: reduce" and reload the page. Confirm:
- Animations are disabled (marquees stop, fade-slide-up elements appear immediately).
- Layout and color rendering are unchanged from the non-reduced state.

- [ ] **Step 6: Stop dev server**

`Ctrl+C` in the terminal running the dev server.

- [ ] **Step 7: No commit (verification only)**

This task produces no code changes. If visual issues were found and you patched something, that patch lives in its own commit with an appropriate message.

---

## Self-Review

**Spec coverage:**
- Replace blue brand accent with `#4A7C59` → Tasks 1 (token values) + 2 (Tailwind config refs) + 3 (diagram styles).
- Tint surface ladder with sage wash → Task 1 (surface ladder values in tokens.css).
- Extract tokens to a CSS variable file → Task 1 (file creation) + Task 2 (BaseLayout import + var refs).
- Diagram-highlight rules switch to var() refs → Task 3.
- No other packages or files touched → Tasks 2/3 grep checks confirm.
- Build & visual verification → Task 4.

**Placeholder scan:** No "TBD", "TODO", "implement later", or vague directives. Every step contains the actual code or command needed.

**Type/value consistency:** Token names match between `tokens.css` (Task 1) and the Tailwind config object (Task 2) and the diagram rules (Task 3). Hex values are consistent across spec → tokens.css → diagram rules. The `.mono-diagram-highlight` fill of `rgb(74 124 89 / 0.12)` matches the primary hex `#4A7C59` (74, 124, 89 in decimal) — verified.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-landing-secondary-color-palette.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
