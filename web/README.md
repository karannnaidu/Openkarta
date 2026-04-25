# openkarta.org landing page

Static one-page site, deployed to Cloudflare Pages.

## Local preview

```bash
npx serve web
```

## Deploy (Cloudflare Pages)

1. In Cloudflare Pages, create a project pointing at this repo.
2. Build command: *(leave empty)*
3. Output directory: `web`
4. Production branch: `main`
5. Custom domain: `openkarta.org` (apex) and `www.openkarta.org`.

That's it. There is no build step — it's plain HTML/CSS.

## Files

- `index.html` — the landing page.
- `style.css` — styling (no framework, deliberately).
- `_headers` — Cloudflare Pages security headers.

When the site grows beyond one page, replace this with Astro or Next static export. Until then, plain HTML keeps shipping cheap.
