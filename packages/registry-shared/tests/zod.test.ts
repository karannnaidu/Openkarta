import { describe, expect, it } from "vitest";
import {
  AGENT_ID_REGEX,
  AgentListingSchema,
  AgentPatchSchema,
  AgentSubmissionSchema,
} from "../src/zod.js";

const baseValid = {
  agentId: "halcyon-shop",
  displayName: "Halcyon Shop",
  description: "demo",
  baseUrl: "https://halcyon-shop.fly.dev",
  tier: "http",
  supportedItemTypes: ["product"],
  regions: [{ country: "IN" }],
  tags: ["demo"],
} as const;

describe("AgentSubmissionSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(AgentSubmissionSchema.safeParse(baseValid).success).toBe(true);
  });

  it("rejects http baseUrl", () => {
    const r = AgentSubmissionSchema.safeParse({ ...baseValid, baseUrl: "http://x.com" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown item type", () => {
    const r = AgentSubmissionSchema.safeParse({ ...baseValid, supportedItemTypes: ["weapon"] });
    expect(r.success).toBe(false);
  });

  it("rejects empty supportedItemTypes", () => {
    const r = AgentSubmissionSchema.safeParse({ ...baseValid, supportedItemTypes: [] });
    expect(r.success).toBe(false);
  });
});

describe("AGENT_ID_REGEX", () => {
  it("accepts valid ids", () => {
    expect(AGENT_ID_REGEX.test("halcyon-shop")).toBe(true);
    expect(AGENT_ID_REGEX.test("abc")).toBe(true);
    expect(AGENT_ID_REGEX.test("a1-b2")).toBe(true);
  });
  it("rejects invalid ids", () => {
    expect(AGENT_ID_REGEX.test("Halcyon")).toBe(false);
    expect(AGENT_ID_REGEX.test("-bad")).toBe(false);
    expect(AGENT_ID_REGEX.test("bad-")).toBe(false);
    expect(AGENT_ID_REGEX.test("a")).toBe(false);
  });
});

describe("AgentListingSchema", () => {
  it("parses a public listing with health + verification", () => {
    const r = AgentListingSchema.safeParse({
      agentId: "halcyon-shop",
      displayName: "Halcyon",
      description: "",
      baseUrl: "https://x.com",
      manifestUrl: "https://x.com/v0/discover",
      tier: "http",
      supportedItemTypes: ["product"],
      regions: [{ country: "IN" }],
      tags: [],
      publicKey: null,
      verified: true,
      health: "healthy",
      lastVerifiedAt: "2026-04-25T00:00:00Z",
    });
    expect(r.success).toBe(true);
  });
});

describe("AgentPatchSchema", () => {
  it("omits agentId from patch", () => {
    const r = AgentPatchSchema.safeParse({ displayName: "New" });
    expect(r.success).toBe(true);
  });
});
