# Deploying the reference-agent-shop publicly

The shop reference agent is published to the OpenKarta registry as a **demo** — it lets anyone run `npx -p @openkarta/conformance-tests openkarta-conformance --target https://halcyon-shop.fly.dev` against a real, live agent without setting anything up locally.

This file documents how to deploy it. Fly.io is used because it has a free allowance, supports Docker, and has a Mumbai region close to where the rest of the project is hosted.

## Prerequisites

- A Fly account: <https://fly.io/app/sign-up>
  - First-time accounts are usually flagged as "high risk" by Fly's anti-abuse system. Visit <https://fly.io/high-risk-unlock> and add a payment method to unlock. Scale-to-zero + 256MB stays inside the free allowance — you won't be charged for the demo.
- The `flyctl` CLI: <https://fly.io/docs/flyctl/install/>
  - On Windows, install via PowerShell: `iwr https://fly.io/install.ps1 -useb | iex`. The Linux `curl | sh` script does not work on Git Bash for Windows.
- `fly auth login` completed.

## How the build works

The Dockerfile is a multi-stage pnpm-workspace build. It needs the **repo root** as the build context (it copies `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and the whole `packages/` tree). So you launch from `packages/reference-agent-shop/` (where `fly.toml` lives) but you **deploy from the repo root** with explicit `--config` and `--dockerfile` flags.

A root-level `.dockerignore` excludes `node_modules`, `dist`, `.git`, etc. so the build context stays small and Windows symlinks in `node_modules/.bin` don't crash the tar packer.

## First deploy

```bash
# 1. Create the Fly app (once)
cd packages/reference-agent-shop
fly launch --no-deploy --copy-config --name halcyon-shop --region bom --yes

# 2. Set the HMAC secret used to sign quote tokens
fly secrets set OPENKARTA_SECRET="$(openssl rand -hex 32)" --app halcyon-shop

# 3. Deploy from the repo root, pointing back at the package's fly.toml + Dockerfile.
#    --ha=false keeps this to a single machine — required because the reference
#    agent stores orders in memory and HA across machines breaks state-bound flows.
cd ../..
fly deploy . --remote-only --ha=false \
  --config packages/reference-agent-shop/fly.toml \
  --dockerfile packages/reference-agent-shop/Dockerfile \
  --app halcyon-shop
```

`--remote-only` tells Fly to build the Docker image on its builder machine instead of locally. The build takes ~3 minutes the first time, ~30 seconds after layers are cached.

## Verify

```bash
curl https://halcyon-shop.fly.dev/v0/discover | jq '.agentId'
# "halcyon-shop"

npx -y -p @openkarta/conformance-tests openkarta-conformance \
  --target https://halcyon-shop.fly.dev --json > /tmp/badge.json
jq '.testsPassed, .testsFailed' /tmp/badge.json
```

## Updating

```bash
# from the repo root
fly deploy . --remote-only --ha=false \
  --config packages/reference-agent-shop/fly.toml \
  --dockerfile packages/reference-agent-shop/Dockerfile \
  --app halcyon-shop
```

`auto_stop_machines = "stop"` in `fly.toml` means the VM scales to zero between requests — there is no idle cost. The first request after a quiet period takes a few seconds to wake the machine; this is fine for a demo.

## Cost

At the configured 1 shared CPU / 256 MB / scale-to-zero, this fits inside Fly's free allowance for low-traffic demos. If it starts costing money, that means real usage — open an issue and we'll move it.

## Why a single machine

The reference agent uses an in-memory order store. Fly's default rolling deploy creates two machines for HA — that breaks any flow that touches state across requests, because checkout might land on machine A and the matching return on machine B. The deploy command above passes `--ha=false` to keep this to one machine, and `min_machines_running = 0` lets it scale to zero between requests.

If you fork this for a real merchant with persistent storage, drop `--ha=false`.

## Caveats

This deployment is **demo only**. It uses the in-memory store from the reference agent and resets all order state on every restart. Don't point real consumer agents at it for anything other than smoke testing.
