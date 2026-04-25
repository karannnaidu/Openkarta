import type { CapabilitiesManifest, ItemBase, ItemType } from '@openkarta/spec';

export interface OrchestratorOptions {
  registryUrl?: string;
  registry?: RegistrySnapshot;
  cacheTtlMs?: number;
  perAgentTimeoutMs?: number;
  searchConcurrency?: number;
  ordersFile?: string;
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
