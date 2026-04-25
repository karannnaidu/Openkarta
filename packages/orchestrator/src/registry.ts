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

export interface LoadRegistryInput {
  /** A registry URL to fetch. */
  url?: string;
  /** A pre-fetched JSON string (used in tests). Mutually exclusive with `url`. */
  inline?: string;
  fetchImpl?: typeof fetch;
}

export async function loadRegistry(input: LoadRegistryInput): Promise<RegistrySnapshot> {
  let raw: string;
  if (input.inline !== undefined) {
    raw = input.inline;
  } else if (input.url !== undefined) {
    const fetchImpl = input.fetchImpl ?? globalThis.fetch;
    const res = await fetchImpl(input.url);
    if (!res.ok) throw new Error(`registry fetch failed: HTTP ${res.status}`);
    raw = await res.text();
  } else {
    throw new Error('loadRegistry requires either { url } or { inline }');
  }
  const parsed = RegistryZ.parse(JSON.parse(raw));
  return parsed as RegistrySnapshot;
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
