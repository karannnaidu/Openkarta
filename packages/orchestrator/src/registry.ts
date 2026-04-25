import { z } from 'zod';
import type { ItemType } from '@openkarta/spec';
import type { RegistrySnapshot, RegistryAgent } from './types.js';

const ITEM_TYPES = ['product', 'stay', 'flight', 'bus', 'service'] as const;

const RegistryAgentZ = z.object({
  agentId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/),
  displayName: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url().refine((u) => u.startsWith('https://'), 'baseUrl must be https'),
  manifestUrl: z.string().url().optional(),
  tier: z.enum(['lite', 'http', 'agentic']),
  supportedItemTypes: z.array(z.enum(ITEM_TYPES)).min(1),
  regions: z.array(z.object({
    country: z.string().regex(/^[A-Z]{2}$/),
    city: z.string().optional(),
    pincodes: z.array(z.string()).optional(),
  })).optional(),
  publicKey: z.string().nullable().optional(),
  badgeUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  addedAt: z.string(),
  verified: z.boolean().optional(),
});

const RegistryZ = z.object({
  version: z.literal('0.1'),
  updated: z.string(),
  agents: z.array(RegistryAgentZ),
});

const HostedListingZ = z.object({
  agentId: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  baseUrl: z.string(),
  manifestUrl: z.string().optional(),
  tier: z.enum(['lite', 'http', 'agentic']),
  supportedItemTypes: z.array(z.enum(ITEM_TYPES)).min(1),
  regions: z
    .array(
      z.object({
        country: z.string(),
        city: z.string().optional(),
        pincodes: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  tags: z.array(z.string()).optional(),
  verificationStatus: z.string().optional(),
  healthStatus: z.string().optional(),
  lastVerifiedAt: z.string().optional(),
  createdAt: z.string(),
});

const HostedPageZ = z.object({
  items: z.array(HostedListingZ),
  nextCursor: z.string().nullable().optional(),
});

type _RegistryShapeMatches = keyof RegistrySnapshot extends keyof z.infer<typeof RegistryZ>
  ? true
  : false;
const _registryShapeCheck: _RegistryShapeMatches = true;

export interface LoadRegistryInput {
  /** A registry URL to fetch. */
  url?: string;
  /** A pre-fetched JSON string (used in tests). Mutually exclusive with `url`. */
  inline?: string;
  fetchImpl?: typeof fetch;
}

function dateOnly(value: string): string {
  // The static shape expects an ISO date (YYYY-MM-DD); the hosted API returns
  // a full ISO timestamp. Trim safely.
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function hostedToStatic(items: z.infer<typeof HostedListingZ>[]): z.infer<typeof RegistryZ> {
  const agents: RegistryAgent[] = items
    .filter((it) => it.healthStatus !== 'delisted')
    .map((it) => {
      const regions = it.regions?.map((r) => {
        const out: { country: string; city?: string; pincodes?: string[] } = { country: r.country };
        if (r.city !== undefined) out.city = r.city;
        if (r.pincodes !== undefined) out.pincodes = r.pincodes;
        return out;
      });
      return {
        agentId: it.agentId,
        displayName: it.displayName,
        ...(it.description ? { description: it.description } : {}),
        baseUrl: it.baseUrl,
        ...(it.manifestUrl ? { manifestUrl: it.manifestUrl } : {}),
        tier: it.tier,
        supportedItemTypes: it.supportedItemTypes,
        ...(regions ? { regions } : {}),
        ...(it.tags ? { tags: it.tags } : {}),
        addedAt: dateOnly(it.createdAt),
        verified: it.verificationStatus === 'verified',
      };
    });
  return {
    version: '0.1',
    updated: new Date().toISOString().slice(0, 10),
    agents,
  };
}

async function fetchHostedRest(
  url: string,
  fetchImpl: typeof fetch,
  firstPage: z.infer<typeof HostedPageZ>,
): Promise<z.infer<typeof HostedListingZ>[]> {
  const all: z.infer<typeof HostedListingZ>[] = [...firstPage.items];
  const u = new URL(url);
  let cursor: string | null | undefined = firstPage.nextCursor;
  for (let page = 0; page < 99 && cursor; page++) {
    u.searchParams.set('cursor', cursor);
    const res = await fetchImpl(u.toString());
    if (!res.ok) throw new Error(`registry fetch failed: HTTP ${res.status}`);
    const parsed = HostedPageZ.parse(await res.json());
    all.push(...parsed.items);
    cursor = parsed.nextCursor;
  }
  return all;
}

export async function loadRegistry(input: LoadRegistryInput): Promise<RegistrySnapshot> {
  if (input.inline !== undefined && input.url !== undefined) {
    throw new Error('loadRegistry: pass either { url } or { inline }, not both');
  }
  if (input.inline !== undefined) {
    return RegistryZ.parse(JSON.parse(input.inline)) as RegistrySnapshot;
  }
  if (input.url === undefined) {
    throw new Error('loadRegistry requires either { url } or { inline }');
  }
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const res = await fetchImpl(input.url);
  if (!res.ok) throw new Error(`registry fetch failed: HTTP ${res.status}`);
  const raw = await res.text();
  const json = JSON.parse(raw) as unknown;

  // Hosted API: { items, nextCursor }. Iterate cursors and project to the
  // legacy static shape so callers keep the same RegistrySnapshot.
  if (json && typeof json === 'object' && 'items' in (json as Record<string, unknown>)) {
    const firstPage = HostedPageZ.parse(json);
    const items = await fetchHostedRest(input.url, fetchImpl, firstPage);
    return hostedToStatic(items) as RegistrySnapshot;
  }

  return RegistryZ.parse(json) as RegistrySnapshot;
}

export interface AgentFilter {
  itemType: ItemType;
  country?: string;
  city?: string;
  pincode?: string;
  tier?: 'lite' | 'http' | 'agentic';
  agentIds?: string[];
}

export function filterAgents(agents: RegistryAgent[], filter: AgentFilter): RegistryAgent[] {
  if (filter.city && !filter.country) {
    throw new Error('filterAgents: `city` filter requires `country`');
  }
  return agents.filter((a) => {
    if (!a.supportedItemTypes.includes(filter.itemType)) return false;
    if (filter.tier && a.tier !== filter.tier) return false;
    if (filter.agentIds && filter.agentIds.length > 0 && !filter.agentIds.includes(a.agentId)) return false;
    if (filter.country && (a.regions ?? []).every((r) => r.country !== filter.country)) return false;
    if (filter.city) {
      const r = (a.regions ?? []).find((r) => r.country === filter.country && (r.city === filter.city || !r.city));
      if (!r) return false;
    }
    if (filter.pincode) {
      const r = (a.regions ?? []).find((r) => (r.pincodes ?? []).includes(filter.pincode!));
      if (!r) return false;
    }
    return true;
  });
}

export const DEFAULT_REGISTRY_URL = 'https://registry.openkarta.org/v1/agents';
