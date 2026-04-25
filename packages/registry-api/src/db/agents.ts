import type { AgentListing, Health, Tier, Verification, ItemType } from '@openkarta/registry-shared';

export interface AgentRow {
  id: string;
  account_id: string;
  display_name: string;
  description: string;
  base_url: string;
  manifest_url: string;
  tier: Tier;
  supported_item_types: string;
  regions: string;
  tags: string;
  public_key: string | null;
  verification_status: Verification;
  health_status: Health;
  consecutive_failures: number;
  last_verified_at: number | null;
  created_at: number;
  updated_at: number;
}

export function rowToListing(row: AgentRow): AgentListing {
  return {
    agentId: row.id,
    displayName: row.display_name,
    description: row.description,
    baseUrl: row.base_url,
    manifestUrl: row.manifest_url,
    tier: row.tier,
    supportedItemTypes: JSON.parse(row.supported_item_types) as ItemType[],
    regions: JSON.parse(row.regions),
    tags: JSON.parse(row.tags),
    publicKey: row.public_key,
    verified: row.verification_status === 'verified',
    health: row.health_status,
    lastVerifiedAt: row.last_verified_at
      ? new Date(row.last_verified_at * 1000).toISOString()
      : null,
  };
}
