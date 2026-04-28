import { z } from "zod";

export const AGENT_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
export const ITEM_TYPES = ["product", "stay", "flight", "bus", "service"] as const;
export const TIERS = ["lite", "http", "agentic"] as const;
export const HEALTH = ["unknown", "healthy", "stale", "delisted"] as const;
export const VERIFICATION = ["pending", "verified", "delisted"] as const;

export type Tier = (typeof TIERS)[number];
export type Health = (typeof HEALTH)[number];
export type Verification = (typeof VERIFICATION)[number];
export type ItemType = (typeof ITEM_TYPES)[number];

const RegionSchema = z.object({
  country: z.string().length(2),
  city: z.string().optional(),
  pincodes: z.array(z.string()).optional(),
});
export type Region = z.infer<typeof RegionSchema>;

export const AgentSubmissionSchema = z.object({
  agentId: z.string().regex(AGENT_ID_REGEX),
  displayName: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  baseUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "must be HTTPS"),
  manifestUrl: z.string().url().optional(),
  tier: z.enum(TIERS),
  supportedItemTypes: z.array(z.enum(ITEM_TYPES)).min(1),
  regions: z.array(RegionSchema).default([]),
  tags: z.array(z.string()).default([]),
  publicKey: z.string().nullable().optional(),
});
export type AgentSubmission = z.infer<typeof AgentSubmissionSchema>;

export const AgentListingSchema = AgentSubmissionSchema.extend({
  manifestUrl: z.string().url(),
  publicKey: z.string().nullable(),
  verificationStatus: z.enum(VERIFICATION),
  healthStatus: z.enum(HEALTH),
  lastVerifiedAt: z.string().optional(),
  createdAt: z.string(),
});
export type AgentListing = z.infer<typeof AgentListingSchema>;

export const AgentPatchSchema = AgentSubmissionSchema.partial().omit({ agentId: true });
export type AgentPatch = z.infer<typeof AgentPatchSchema>;
