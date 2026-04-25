## Registry submission

<!-- Use this template when adding an agent to registry/agents.json -->

**Agent**: `<agentId>`
**Operator**: <who you are / your company>
**Contact**: <email or GitHub handle for follow-up>

## Conformance

- [ ] Ran `npx openkarta-conformance --target https://my-agent.example.com --json > badge.json` against the **public** `baseUrl` (not localhost).
- [ ] Every test passed (no skips, no fails).
- [ ] `badge.json` is hosted at the URL given in the `badgeUrl` field.
- [ ] My `manifestUrl` (`/v0/discover`) returns 200 over HTTPS.

## Schema

- [ ] My entry validates against [`registry/schema.json`](../../registry/schema.json) (CI will check; you can verify locally with `npx ajv-cli validate -s registry/schema.json -d registry/agents.json`).
- [ ] `agentId` is globally unique within `registry/agents.json`.
- [ ] `baseUrl` is HTTPS.

## Honesty

- [ ] `supportedItemTypes` only lists item types my agent **actually** serves.
- [ ] `regions` reflects where I can actually fulfil orders, not where I'd like to.
- [ ] `description` is one sentence and not marketing copy.

## Operator commitments

- [ ] I will respond to inbound `quote` / `checkout` calls within the protocol's timeouts.
- [ ] I will keep `/v0/discover` reachable; if I take the agent down, I will open a PR removing this entry.
- [ ] I understand that maintainers may remove this entry if health checks fail for >7 days.
