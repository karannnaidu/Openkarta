# OpenKarta Registry (Stage 1)

This directory is the **interim OpenKarta registry**: a single JSON file listing every conformant agent.

It is intentionally low-tech. As of 2026-04-24, there is no hosted query service, no signed-update protocol, and no foundation governance. Plan 08 will replace this with `registry.openkarta.org/v1/search`. Until then, the source of truth lives here in Git, audited by pull request.

## Files

- [`agents.json`](agents.json) — the agent list. Authoritative.
- [`schema.json`](schema.json) — JSON Schema validating each entry. CI runs this on every PR.

## How to add your agent

1. **Pass the conformance harness.** Run `npx openkarta-conformance --target https://your-agent.example.com --json > badge.json` and verify every test passes.
2. **Host your `badge.json`.** Anywhere reachable over HTTPS — the file is HMAC-signed, so it can sit on any CDN.
3. **Open a PR** that adds an entry to `agents.json`:

   ```json
   {
     "agentId": "your-agent",
     "displayName": "Your Agent",
     "description": "One sentence about what you sell and where.",
     "baseUrl": "https://your-agent.example.com",
     "manifestUrl": "https://your-agent.example.com/v0/discover",
     "tier": "http",
     "supportedItemTypes": ["product"],
     "regions": [{ "country": "IN", "city": "Bengaluru" }],
     "publicKey": "base64-public-key-used-for-future-signed-updates",
     "badgeUrl": "https://your-agent.example.com/openkarta-badge.json",
     "tags": ["coffee", "specialty"],
     "addedAt": "2026-04-24",
     "verified": false
   }
   ```

4. **Use the registry PR template.** When opening the PR, append `?template=add-agent.md` to the GitHub URL, or paste the checklist from [`.github/PULL_REQUEST_TEMPLATE/add-agent.md`](../.github/PULL_REQUEST_TEMPLATE/add-agent.md) into the PR body.

5. **Wait for verification.** A maintainer re-runs the conformance harness against your public `baseUrl`, then sets `"verified": true` in a follow-up commit.

## Rules

- `agentId` must be globally unique. PRs that collide with existing IDs will be asked to rename.
- `baseUrl` must be **HTTPS**. Plaintext entries are rejected by the schema.
- `supportedItemTypes` must list at least one of `product / stay / flight / bus / service`.
- Submissions advertising things the agent does not actually serve (cosmetic stuffing of `regions` or `supportedItemTypes`) are removed without notice.

## Removal / takedown

Open an issue or email `hello@openkarta.org`. We remove on request from the agent owner; we also remove agents that fail health checks for >7 days.

## Roadmap (Plan 08)

When this file passes ~50 entries, we will:

1. Mirror it to `registry.openkarta.org/agents.json` (Cloudflare Pages, free tier).
2. Add a Cloudflare Worker fronting it: `GET /v1/search?region=IN&itemType=product`.
3. Add a signed-update endpoint so agents can submit updates without a PR.
4. Add federation: regional registries can mirror this list and add their own.

Until then: open a PR.
