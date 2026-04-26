#!/usr/bin/env bash
set -euo pipefail
# Registry stack smoke test. Exercises the full submission → verify → queue →
# conformance → email-on-pass → public listing path through the
# vitest-pool-workers harness (which boots a real workerd + D1 + queue).
#
# Phases:
#   1. Build shared packages so cross-package imports resolve.
#   2. Run registry-api tests:
#       - schema migrations
#       - magic-link sign-in + GitHub OAuth
#       - agents CRUD + domain verify + transfer
#       - public listing pagination + cursor
#   3. Run registry-verifier queue-consumer tests:
#       - state machine transitions
#       - end-to-end: enqueue → run conformance → persist badge_run → email
#   4. Run registry-cron tests:
#       - scheduled handler dispatch
#       - daily reverify enqueue
#       - git-mirror snapshot via mocked GitHub REST
#   5. Build the orchestrator and exercise its hosted-shape registry path.
#
# Anything beyond this (real wrangler dev, real Resend, real GitHub) belongs
# in the deployment runbook (docs/registry/runbook.md), not in this script.

pnpm --filter '@openkarta/spec'             build
pnpm --filter '@openkarta/sdk-node'         build
pnpm --filter '@openkarta/registry-shared'  build
pnpm --filter '@openkarta/conformance-tests' build

pnpm --filter '@openkarta/registry-api'      test
pnpm --filter '@openkarta/registry-verifier' test
pnpm --filter '@openkarta/registry-cron'     test
pnpm --filter '@openkarta/orchestrator'      test

echo "registry smoke ✓"
