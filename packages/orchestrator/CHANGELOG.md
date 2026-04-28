# @openkarta/orchestrator

## 0.5.0

### Fixed

- `DEFAULT_REGISTRY_URL` now points at `https://api.openkarta.org/v1/agents`
  (the actual Worker hostname). Previously it pointed at
  `https://registry.openkarta.org/v1/agents`, which is the public Pages
  dashboard and serves HTML — every default-config caller since 0.4.0 was
  failing to bootstrap. Callers using `loadRegistry({ url })` were unaffected.

## 0.4.0

### Breaking

- `DEFAULT_REGISTRY_URL` now points to the hosted registry at
  `https://registry.openkarta.org/v1/agents`. The legacy static URL
  (`https://raw.githubusercontent.com/karannnaidu/Openkarta/main/registry/agents.json`)
  is mirrored daily and remains a valid override via the `OPENKARTA_REGISTRY_URL`
  env var or by passing `{ url }` to `loadRegistry`.

### Added

- `loadRegistry` now sniffs the response shape: hosted listings
  (`{ items, nextCursor }`) are paginated through cursor pages and projected to
  the existing `RegistrySnapshot` shape, so callers see no API change. Delisted
  agents are dropped; `verificationStatus === 'verified'` maps to `verified: true`.

## 0.3.0

- Vendor-neutral chat loop using the `chat/completions` wire format.
