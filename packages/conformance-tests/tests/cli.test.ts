import { bootAgent, loadFixtures } from "@openkarta/reference-agent-shop/src/agent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signBadge } from "../src/badge";
import { runAll } from "../src/runner";

let baseUrl = "";
const secret = "x".repeat(32);
const fx = loadFixtures("./fixtures");

beforeAll(async () => {
  baseUrl = await bootAgent(fx, 0, secret);
});
afterAll(async () => {
  /* fastify closed implicitly when vitest ends */
});

describe("CLI runner end-to-end", () => {
  it("runs core+product against Halcyon Shop and emits a signed badge", async () => {
    const { manifest, packReports } = await runAll(baseUrl);
    const passedCount = packReports.reduce((s, r) => s + r.passedCount, 0);
    const failedCount = packReports.reduce((s, r) => s + r.failedCount, 0);
    const packsPassed = packReports.filter((r) => r.failedCount === 0).map((r) => r.pack);

    const badge = signBadge(
      {
        agentId: manifest.agentId,
        protocolVersion: "0.1",
        tierDetected: manifest.tier,
        packsPassed,
        testsPassed: passedCount,
        testsFailed: failedCount,
        signedAt: new Date().toISOString(),
      },
      "unsigned-dev",
    );

    expect(packReports.map((r) => r.pack)).toEqual(["core", "product"]);
    expect(badge.packsPassed).toContain("core");
    expect(badge.packsPassed).toContain("product");
    expect(badge.testsFailed).toBe(0);
    expect(badge.testsPassed).toBe(12);
    expect(typeof badge.signature).toBe("string");
    expect(badge.signature.length).toBeGreaterThan(0);
  });
});
