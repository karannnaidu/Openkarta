# Landing site — Quiet Sage palette + CSS-variable token file

**Date:** 2026-04-26
**Scope:** `packages/landing-web` only
**Status:** Spec

## Problem

The landing site reads as a black-and-white interface. A primary blue (`#003ec7`) is defined in `BaseLayout.astro` but is barely used — most surfaces are flat gray, and the surface ladder (`surface-container-low` → `surface-container-highest`) walks through gray tones with no chromatic differentiation. Buttons and emphasis elements are not eye-friendly: where the blue does appear (notably diagram highlights), it's high-saturation and visually loud.

A secondary problem surfaced during brainstorming: color tokens are hardcoded in two places inside `BaseLayout.astro` — a Tailwind CDN config block and a global `<style>` block. Changing a single token currently requires hunting through inline scripts and CSS rules. There is no CSS source-of-truth file.

## Goal

1. Replace the blue brand accent with a calm sage green (`#4A7C59`) as the *single* brand accent. No two-tone hierarchy, no parallel blue.
2. Tint the surface ladder with a faint sage wash so cards / sections / containers visually differentiate from each other and from the page background.
3. Extract all color tokens into a single CSS variables file. Make `BaseLayout.astro` a *consumer* of those variables via `var()` references — both in the Tailwind config block and in the global `<style>` block.

## Non-goals

- No dark mode work (none currently exists).
- No changes to other packages (`registry-web`, `reference-agent-shop`, etc.).
- No changes to logo, favicon, hero MP4, or imagery.
- No changes to component HTML structure, layout, spacing, or typography tokens.
- No changes to secondary, tertiary, or error color roles — they remain the existing neutrals + standard error red.
- No migration to a Tailwind build step. We continue using the Tailwind CDN runtime.

## Direction (decided during brainstorming)

- **Color role: A** — replace blue entirely; sage is the single brand accent.
- **Hue family: B** — sage / forest, true mid-green slightly muted.
- **Surface treatment: A** — tinted surfaces (faint sage wash baked into the surface ladder).
- **Specific palette: Option 1 — "Quiet Sage"** (`#4A7C59` accent).

## Architecture

### New file: `packages/landing-web/src/styles/tokens.css`

CSS custom properties on `:root`. This file is the single source of truth for color values. Two consumers reference it via `var(--name)`:

1. The Tailwind CDN config block in `BaseLayout.astro` (color values become `var()` references, so utilities like `bg-primary` resolve to the variable at runtime).
2. The global `<style>` block in `BaseLayout.astro` (diagram-highlight rules and any other component CSS reference variables instead of literal hex).

Page files (`index.astro`, `protocol.astro`, etc.) require no edits — they use Tailwind class names and inherit the new token values automatically.

### Edited file: `packages/landing-web/src/layouts/BaseLayout.astro`

Three change clusters:
1. Frontmatter import: `import '../styles/tokens.css';` (Astro bundles & inlines this; ensures variables exist before Tailwind runtime classes render).
2. Tailwind CDN config block (the `tailwind = { config: ... }` inline script): every value in the `colors` object becomes a `var(--color-*)` string.
3. Global `<style>` block: `.diagram-highlight` and `.mono-diagram-highlight` rules use `var(--color-primary)` / `var(--color-on-primary)` instead of literal hex. Hardcoded `#1b1c1c` in `.diagram-node` / `.diagram-line` becomes `var(--color-on-background)`. The `rgba(0, 82, 255, 0.1)` fill in `.mono-diagram-highlight` becomes `rgb(74 124 89 / 0.12)` (kept numeric — `rgba(var(...))` wrapping is unreliable across browsers).

## Token map

### Brand accent — Quiet Sage

| Token | Old value | New value |
|---|---|---|
| `--color-primary` | `#003ec7` | `#4A7C59` |
| `--color-on-primary` | `#ffffff` | `#FFFFFF` |
| `--color-primary-container` | `#0052ff` | `#3D6649` |
| `--color-on-primary-container` | `#dfe3ff` | `#DCEAD9` |
| `--color-inverse-primary` | `#b7c4ff` | `#A8C8AE` |
| `--color-primary-fixed` | `#dde1ff` | `#DCEAD9` |
| `--color-primary-fixed-dim` | `#b7c4ff` | `#A8C8AE` |
| `--color-on-primary-fixed` | `#001452` | `#0F2014` |
| `--color-on-primary-fixed-variant` | `#0038b6` | `#2F5039` |
| `--color-surface-tint` | `#004ced` | `#4A7C59` |

### Surface ladder — sage-tinted

| Token | Old value | New value |
|---|---|---|
| `--color-background` | `#fbf9f9` | `#FAFBF9` |
| `--color-on-background` | `#1b1c1c` | `#1B1C1C` |
| `--color-surface` | `#fbf9f9` | `#FAFBF9` |
| `--color-on-surface` | `#1b1c1c` | `#1B1C1C` |
| `--color-surface-bright` | `#fbf9f9` | `#FAFBF9` |
| `--color-surface-dim` | `#dbdad9` | `#C7D2C2` |
| `--color-surface-container-lowest` | `#ffffff` | `#FFFFFF` |
| `--color-surface-container-low` | `#f5f3f3` | `#F1F4EF` |
| `--color-surface-container` | `#efeded` | `#E8EEE5` |
| `--color-surface-container-high` | `#e9e8e7` | `#DCE5D8` |
| `--color-surface-container-highest` | `#e3e2e2` | `#CDDAC8` |
| `--color-surface-variant` | `#e3e2e2` | `#DCE5D8` |
| `--color-on-surface-variant` | `#434656` | `#434656` |
| `--color-inverse-surface` | `#303031` | `#303031` |
| `--color-inverse-on-surface` | `#f2f0f0` | `#F2F0F0` |
| `--color-outline` | `#737688` | `#7A8A78` |
| `--color-outline-variant` | `#c3c5d9` | `#C7D2C2` |

### Unchanged neutrals & error (copied into tokens.css verbatim, no value change)

`--color-secondary` `#5f5e5e`, `--color-on-secondary` `#ffffff`, `--color-secondary-container` `#e5e2e1`, `--color-on-secondary-container` `#656464`, `--color-secondary-fixed` `#e5e2e1`, `--color-secondary-fixed-dim` `#c9c6c5`, `--color-on-secondary-fixed` `#1c1b1b`, `--color-on-secondary-fixed-variant` `#474646`, `--color-tertiary` `#4c4e4f`, `--color-on-tertiary` `#ffffff`, `--color-tertiary-container` `#656666`, `--color-on-tertiary-container` `#e4e4e5`, `--color-tertiary-fixed` `#e2e2e2`, `--color-tertiary-fixed-dim` `#c6c6c7`, `--color-on-tertiary-fixed` `#1a1c1c`, `--color-on-tertiary-fixed-variant` `#454747`, `--color-error` `#ba1a1a`, `--color-on-error` `#ffffff`, `--color-error-container` `#ffdad6`, `--color-on-error-container` `#93000a`.

### Diagram-highlight rule changes (in the global `<style>` block)

| Rule | Old | New |
|---|---|---|
| `.diagram-node` border | `1px solid #1b1c1c` | `1px solid var(--color-on-background)` |
| `.diagram-line` background | `#1b1c1c` | `var(--color-on-background)` |
| `.diagram-highlight` background | `#0052FF` | `var(--color-primary)` |
| `.diagram-highlight` border | `#0052FF` | `var(--color-primary)` |
| `.diagram-highlight` color | `white` | `var(--color-on-primary)` |
| `.mono-diagram-line` stroke | `currentColor` (unchanged) | `currentColor` (unchanged) |
| `.mono-diagram-highlight` stroke | `#0052FF` | `var(--color-primary)` |
| `.mono-diagram-highlight` fill | `rgba(0, 82, 255, 0.1)` | `rgb(74 124 89 / 0.12)` |

## Accessibility checks

- **Body text on background:** `#1B1C1C` on `#FAFBF9` — contrast ratio ~17.4:1. AAA.
- **White on `--color-primary` (`#4A7C59`):** contrast ratio ~4.7:1. Passes WCAG AA for normal text (4.5:1 required).
- **`--color-on-background` on `--color-surface-container-highest` (`#1B1C1C` on `#CDDAC8`):** ~12.1:1. AAA.
- **Selection highlight** (`selection:bg-primary-container` = `#3D6649` with `selection:text-on-primary` = `#FFFFFF`): ~6.0:1. AA.

No color-only meaning is introduced. Diagram highlights still pair sage fill with sage border, plus retain shape/position cues.

## Files touched

| File | Action | Why |
|---|---|---|
| `packages/landing-web/src/styles/tokens.css` | **Create** | New single source of truth for color tokens. |
| `packages/landing-web/src/layouts/BaseLayout.astro` | **Edit** | Import tokens.css; switch Tailwind config and diagram styles to `var()` refs. |

No other files in `packages/landing-web/` need edits. Verified via grep:
- Hardcoded blue hexes (`#0052FF`, `#003ec7`, `#004ced`, `#b7c4ff`, `#dfe3ff`, `#dde1ff`, `rgba(0, 82, 255, ...)`) appear **only** in `BaseLayout.astro`.
- Tailwind class names referencing primary/surface tokens (`bg-primary`, `bg-surface-container-high`, etc.) are scattered across page files but pick up the new values automatically with no edits.

## Risks and mitigations

- **Tailwind CDN + `var()` colors don't support opacity modifiers.** Utilities like `bg-primary/50` would emit malformed CSS because Tailwind can't compute alpha-mixed values from a `var()` string. Verified the codebase doesn't currently use any `/N` opacity modifier on color utilities — this constraint is acceptable. If it changes later, we'd need to switch to a Tailwind build step.
- **Astro CSS bundling order.** Astro bundles imported CSS into the page's `<head>`; the Tailwind CDN runtime script also runs from `<head>`. As long as `import '../styles/tokens.css'` is in the BaseLayout frontmatter (not deferred), the variables are present in the cascade before Tailwind generates utilities.
- **Visual regression risk is contained to one file.** Because all hardcoded hex values lived in `BaseLayout.astro`, the surface area of the change is narrow.

## Verification

- Run dev server (`pnpm --filter landing-web dev`) and visually inspect: home, protocol, merchant, governance, manifesto, developers, conformance, registry, charter, manifest, blog index, blog post, about, press, security, privacy, terms, status, changelog, 404.
- Confirm: no remaining blue accents anywhere; surface boxes (cards, callouts, code blocks) visibly differentiate; primary CTAs are sage with white text and pass eye-friendliness check; diagrams use sage highlights instead of blue.
- Confirm reduced-motion still works; selection highlight is sage (not blue).
- Build succeeds (`pnpm --filter landing-web build`); no console errors.

## Out-of-scope follow-ups (not part of this work)

- Future palette or theme tweaks edit `tokens.css` only.
- A second theme (e.g., dark mode) would add a sibling `:root[data-theme="dark"] { ... }` block in `tokens.css` and a theme toggle — design separately if/when wanted.
