import { loadRegistry, DEFAULT_REGISTRY_URL, type RegistrySnapshot } from "@openkarta/orchestrator";

export interface LoadBridgeRegistryOpts {
  fetchImpl?: typeof fetch;
}

/**
 * Load the registry for the bridge. Pinned to DEFAULT_REGISTRY_URL on purpose —
 * the bridge is a consumer surface and must not honour env-var overrides.
 * Developers who need a custom registry should use @openkarta/orchestrator directly.
 */
export async function loadBridgeRegistry(
  opts: LoadBridgeRegistryOpts = {},
): Promise<RegistrySnapshot> {
  return loadRegistry({
    url: DEFAULT_REGISTRY_URL,
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  });
}
