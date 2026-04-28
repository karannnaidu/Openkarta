# Landing site — color usage pass (Teal Lagoon)

**Date:** 2026-04-27
**Status:** Approved, ready for implementation

## Problem

Landing site has a teal palette (`tokens.css`) but barely uses it visually.
Pages read as black-on-white with thin borders because:
- Page bg is medium teal `#A8C5C8` but cards (`surface-container-lowest`) are
  pure white in many spots, washing out the contrast.
- Most buttons are charcoal-filled (`bg-on-background`) or transparent-ghost
  with a charcoal border — neither uses the teal palette.
- No section bands; every section bleeds into the same uniform bg, so the
  palette has no rhythm.
- Closing CTA blocks are charcoal (`bg-on-background`), keeping the
  black-and-white feel even on pages that should close in brand color.

The palette pivot from sage to teal is locked. This spec defines how to
actually apply it across the site.

## Scope

All 24 pages under `packages/landing-web/src/pages/` + `Header.astro` +
`Footer.astro` + `BaseLayout.astro` + `tokens.css`. Class-string migrations
only — no structural HTML changes, no new components, no JS changes.

## Design

### 1. Token updates (`tokens.css`)

Surface ladder rebalanced so the page is light enough for ghost buttons to
read, and so deepened section bands have visible contrast against the page.

```
--color-background:               #D0DEE0   (was #A8C5C8 — light teal page)
--color-surface:                  #D0DEE0   (matches background)
--color-surface-bright:           #E8F0F1
--color-surface-dim:              #88AAB0
--color-surface-container-lowest: #E8F0F1   (cards — light teal, NOT white)
--color-surface-container-low:    #A8C5C8   (deepened section band)
--color-surface-container:        #BDD0D2
--color-surface-container-high:   #88AAB0
--color-surface-container-highest:#5F8D93
--color-surface-variant:          #BDD0D2
--color-outline-variant:          #A8C5C8

(unchanged: primary tokens, on-* tokens, error, secondary, tertiary)
```

Three visible levels in normal flow: light page → light-teal cards →
deepened band sections. Deep teal only on filled buttons + accent cards +
closing CTAs.

### 2. Button patterns

**Primary (filled):**
```
bg-primary text-on-primary px-6 py-3 border border-primary
hover:bg-primary-container hover:border-primary-container
transition-colors duration-240
```

**Secondary (ghost-on-tint):**
```
bg-transparent text-primary px-6 py-3 border-2 border-primary
hover:bg-primary hover:text-on-primary
transition-colors duration-240
```

Header "Install SDK" → primary variant (no charcoal-filled exception).

Migrations across all pages:
- `bg-on-background text-surface-container-lowest ... border border-on-background hover:bg-surface-container-lowest hover:text-on-background`
  → primary pattern above
- `bg-transparent text-on-background ... border border-on-background hover:bg-on-background hover:text-surface-container-lowest`
  → secondary pattern above

### 3. Section rhythm

Per page:
- **Hero**: page bg + small deep-teal pill replacing the label-caps strip:
  `bg-primary text-on-primary px-3 py-1 inline-block font-label-caps text-label-caps uppercase`
  (instead of the current plain `text-label-caps text-on-surface-variant`).
- **Body sections**: alternate page bg ↔ `bg-surface-container-low py-20`
  full-bleed band. The class is already used in some pages (e.g.,
  `conformance.astro` "How a run works") — extend the pattern to ~one band
  per page. Don't band every section; rhythm needs gaps.
- **Closing CTA section**: full-bleed `bg-primary text-on-primary p-12 md:p-20`
  block. Buttons inside are:
  - Primary on dark teal: `bg-on-primary text-primary` (light pill)
  - Secondary on dark teal: ghost variant with `border-on-primary text-on-primary hover:bg-on-primary hover:text-primary`
  Replaces the current `bg-on-background text-surface-container-lowest`
  charcoal closing block in `developers.astro` and similar pages.

### 4. Card variants

- **Default**: `bg-surface-container-lowest border border-on-background/10`
  (light teal #E8F0F1 with thin outline). No change to existing class names —
  the token shift in step 1 makes them light teal automatically.
- **Accent card** (used sparingly — one per row of 3+ to highlight the primary
  option, e.g., the recommended track in `developers.astro`):
  `bg-primary-container text-on-primary-container` (deep teal #1F5F62 with
  light text). Border becomes `border-primary-container`.
- Cards inside deepened bands: stay light (default) so they pop on the deeper
  band rather than blend.

### 5. Affected files

- `packages/landing-web/src/styles/tokens.css` — surface ladder rebalance
- `packages/landing-web/src/components/Header.astro` — Install SDK button
  migration
- `packages/landing-web/src/components/Footer.astro` — no button changes
  needed (link-only); verify token shift renders cleanly
- `packages/landing-web/src/pages/*.astro` (24 files) — button class-string
  migrations + selective accent-card application + closing-CTA migration on
  the 3-4 pages that have the charcoal closer
- `packages/landing-web/src/layouts/BaseLayout.astro` — no changes (already
  uses `bg-background`)

## Migrations are mechanical

All button changes are exact-string replacements via `Edit replace_all`.
No regex. No conditional logic. Each page either matches the source string
or it doesn't, and the patch is identical across files.

The accent-card and closing-CTA migrations are per-file targeted edits
(handful of pages) — done with explicit Edit calls rather than batch.

## Accessibility

- Deep teal `#2E7B7E` on white = ~5.4:1 (AA pass for body, AA-large for
  headlines).
- White on deep teal `#2E7B7E` = inverse, same ratio (AA pass).
- Deep teal text on light page bg `#D0DEE0` = ~4.7:1 (AA pass for body
  text, used for ghost button label).
- Deep-teal border on light bg = decorative, no contrast requirement.
- Light teal on deep teal (accent card text `#C8E5E6` on `#1F5F62`) = ~9:1
  (AAA pass).

## Out of scope

- Logo size changes (already done in prior turn — `h-[88px] w-[88px]`,
  header height bumped to `h-28`, main `pt-28`).
- Animation tweaks.
- Mobile-only adjustments (the design works at all breakpoints unchanged).
- Replacing the typography or font system.
- Dark mode (not currently supported).

## Risks

- **Tailwind CDN + var() opacity**: Tailwind's CDN runtime doesn't support
  the `bg-primary/50`-style opacity modifier on var()-backed colors. Verified
  in prior pass — codebase doesn't use opacity modifiers on tokenized colors.
  New patterns in this spec also avoid them.
- **Visual regression on pages I don't visually verify**: All 24 pages will
  re-render with the new token values. Mitigation — local dev server stays
  running for the user to spot-check before deploy.
- **Selective accent-card placement is judgment-driven**: not every card
  group needs an accent. Pick the page-by-page primary-action card; if
  unsure, leave default. Better one missed accent than every card screaming.
