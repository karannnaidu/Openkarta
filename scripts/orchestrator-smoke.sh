#!/usr/bin/env bash
set -euo pipefail
# Boots all 3 reference agents in-process via their orchestrator e2e tests.
# Each test brings up its own Fastify on a random port, so no manual orchestration.
pnpm --filter '@openkarta/reference-agent-shop'   build
pnpm --filter '@openkarta/reference-agent-stays'  build
pnpm --filter '@openkarta/reference-agent-travel' build
pnpm --filter '@openkarta/orchestrator' test e2e-product e2e-stay e2e-flight
echo "orchestrator smoke ✓"
