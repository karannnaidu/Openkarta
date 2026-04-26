# Registry deployment runbook

This document lists every user-side prerequisite for standing up the hosted
registry and the exact `wrangler` commands to deploy each component. All names
below are the production names — pick prefixed equivalents for staging.

## 1. Cloudflare account

You need:

- A Cloudflare account with Workers Paid (required for D1 + Queues).
- `wrangler` CLI installed and authenticated: `wrangler login`.
- Verified `wrangler whoami`.

## 2. D1 database

```bash
wrangler d1 create registry_db
```

Copy the resulting `database_id` UUID. Replace `REPLACE_WITH_D1_ID` in:

- `packages/registry-api/wrangler.toml`
- `packages/registry-verifier/wrangler.toml`
- `packages/registry-cron/wrangler.toml`

Apply migrations:

```bash
wrangler d1 migrations apply registry_db --remote --config packages/registry-api/wrangler.toml
```

(Run with `--local` first if you want to inspect the schema locally.)

## 3. Cloudflare Queue

```bash
wrangler queues create openkarta-verify
```

The queue name `openkarta-verify` is referenced from:

- `packages/registry-api/wrangler.toml` ([[queues.producers]])
- `packages/registry-cron/wrangler.toml` ([[queues.producers]])
- `packages/registry-verifier/wrangler.toml` ([[queues.consumers]])

## 4. Cloudflare Pages project

```bash
# First-time bootstrap (or use the dashboard):
pnpm --filter '@openkarta/registry-web' build
wrangler pages project create openkarta-registry --production-branch main
wrangler pages deploy packages/registry-web/dist --project-name openkarta-registry
```

Set the `PUBLIC_API_BASE` env var on the Pages project to
`https://registry.openkarta.org` (or your API domain).

## 5. GitHub OAuth app

Create at https://github.com/settings/developers:

- **Application name:** OpenKarta Registry
- **Homepage URL:** `https://registry.openkarta.org`
- **Authorization callback URL:** `https://registry.openkarta.org/auth/github/callback`

Capture the resulting Client ID and Client Secret for the secret-set step
below.

## 6. Resend account (transactional email)

1. Sign up at https://resend.com.
2. Verify the sending domain (`openkarta.org`) — add the DKIM, SPF, and
   return-path DNS records Resend prints.
3. Confirm the From address `noreply@openkarta.org` appears under verified
   identities.
4. Create an API key with `emails:send` permission.

## 7. GitHub PAT for the git mirror

The cron Worker pushes to a branch on the public OpenKarta repo. Create a
fine-grained personal access token (PAT) with:

- **Repository access:** the `openkarta` (or whichever) repo only.
- **Permissions:** `Contents: Read and write`, `Metadata: Read-only`.

Store as `GITHUB_BOT_PAT` (see step 9).

## 8. DNS records

Point the registry hostname at the deployed Worker / Pages project:

| Hostname                       | Type  | Target                                    |
|--------------------------------|-------|-------------------------------------------|
| `registry.openkarta.org`       | CNAME | `<your-worker>.workers.dev`               |
| `www.registry.openkarta.org`   | CNAME | `<your-pages-project>.pages.dev`          |

Or add custom domains directly via the Workers/Pages dashboards.

You'll also need DNS for the email sender domain (DKIM/SPF/DMARC) — Resend
prints the exact records under "Domains".

## 9. Secrets

Run each `wrangler secret put` for the relevant Worker. The secret values are
prompted interactively.

```bash
# registry-api
wrangler secret put RESEND_API_KEY        --config packages/registry-api/wrangler.toml
wrangler secret put GITHUB_OAUTH_CLIENT_ID --config packages/registry-api/wrangler.toml
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET --config packages/registry-api/wrangler.toml
wrangler secret put SESSION_SECRET        --config packages/registry-api/wrangler.toml

# registry-verifier
wrangler secret put RESEND_API_KEY        --config packages/registry-verifier/wrangler.toml
wrangler secret put BADGE_SIGNING_SECRET  --config packages/registry-verifier/wrangler.toml

# registry-cron
wrangler secret put GITHUB_BOT_PAT        --config packages/registry-cron/wrangler.toml
```

Generate strong random values for `SESSION_SECRET` and `BADGE_SIGNING_SECRET`:

```bash
openssl rand -base64 32
```

## 10. Deploy

In order (the consumer must be deployed before the cron starts producing):

```bash
wrangler deploy --config packages/registry-api/wrangler.toml
wrangler deploy --config packages/registry-verifier/wrangler.toml
wrangler deploy --config packages/registry-cron/wrangler.toml
pnpm --filter '@openkarta/registry-web' build
wrangler pages deploy packages/registry-web/dist --project-name openkarta-registry
```

## 11. Post-deploy verification

1. Visit `https://registry.openkarta.org/sign-in` and complete the magic-link
   flow.
2. Submit a test agent (use `https://reference-agent-shop.openkarta.org` or a
   personal sandbox).
3. Host the token at the well-known path, click "Verify", wait for the
   conformance run to finish.
4. Confirm `GET https://registry.openkarta.org/v1/agents` lists it.
5. After the next 02:00 UTC cron, confirm a new `badge_run` row appears and
   the daily mirror branch on GitHub has been updated.

## 12. Rollback

If a deploy is bad:

```bash
wrangler rollback --config packages/registry-api/wrangler.toml
```

If the daily mirror produced a bad snapshot (e.g. removed agents en masse),
the auto-merge workflow rejects it. Manually inspect the diff on the
`registry-mirror` branch and merge with `--ff-only` once corrected.
