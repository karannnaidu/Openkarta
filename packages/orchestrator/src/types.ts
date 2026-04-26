import type { CapabilitiesManifest, ItemBase, ItemType } from '@openkarta/spec';

export interface OrchestratorOptions {
  registryUrl?: string;            // default: bundled fallback
  registry?: RegistrySnapshot;     // pre-loaded; bypasses fetch
  cacheTtlMs?: number;             // manifest cache TTL, default 5 min
  perAgentTimeoutMs?: number;      // default 8s
  searchConcurrency?: number;      // default 5
  ordersFile?: string;             // default ~/.openkarta/orders.json
  fetchImpl?: typeof fetch;
}

export interface RegistrySnapshot {
  version: string;
  updated: string;
  agents: RegistryAgent[];
}

export interface RegistryAgent {
  agentId: string;
  displayName: string;
  description?: string;
  baseUrl: string;
  manifestUrl?: string;
  tier: 'lite' | 'http' | 'agentic';
  supportedItemTypes: ItemType[];
  regions?: { country: string; city?: string; pincodes?: string[] }[];
  publicKey?: string | null;
  badgeUrl?: string | null;
  tags?: string[];
  addedAt: string;
  verified?: boolean;
}

export interface SearchPlan {
  itemType: ItemType;
  q?: string;
  region?: { country: string; city?: string; pincode?: string };
  agentIds?: string[];
  /** Vertical-specific query fields merged directly into the wire SearchQuery (e.g. checkIn/checkOut for stays, origin/destination for flights). */
  extra?: Record<string, unknown>;
}

export interface RankedResult {
  agentId: string;
  agentDisplayName: string;
  manifest: CapabilitiesManifest;
  item: ItemBase;
  rankScore: number;
}

export interface OrderRecord {
  orderId: string;
  agentId: string;
  agentBaseUrl: string;
  itemType: ItemType;
  totalMinor: number;
  currency: string;
  placedAt: string;
}
