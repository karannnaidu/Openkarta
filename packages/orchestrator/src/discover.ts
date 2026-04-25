import type { CapabilitiesManifest } from '@openkarta/spec';
import { createClient } from '@openkarta/sdk-node';

interface CacheEntry { manifest: CapabilitiesManifest; expiresAt: number; }

export interface ManifestCacheOptions {
  /** Cache TTL in milliseconds. @default 300_000 */
  ttlMs?: number;
  /** Custom fetch implementation; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Per-agent HTTP timeout in milliseconds. @default 8_000 */
  perAgentTimeoutMs?: number;
}

export interface ManifestCache {
  get(baseUrl: string): Promise<CapabilitiesManifest>;
  invalidate(baseUrl?: string): void;
}

export function createManifestCache(opts: ManifestCacheOptions = {}): ManifestCache {
  const ttlMs = opts.ttlMs ?? 5 * 60_000;
  const cache = new Map<string, CacheEntry>();

  return {
    async get(baseUrl: string) {
      const now = Date.now();
      const hit = cache.get(baseUrl);
      if (hit && hit.expiresAt > now) return hit.manifest;
      const client = createClient({
        baseUrl,
        timeoutMs: opts.perAgentTimeoutMs ?? 8_000,
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      });
      const manifest = await client.discover();
      cache.set(baseUrl, { manifest, expiresAt: now + ttlMs });
      return manifest;
    },
    invalidate(baseUrl?: string) {
      if (baseUrl) cache.delete(baseUrl);
      else cache.clear();
    },
  };
}
