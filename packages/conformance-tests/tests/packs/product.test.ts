import { bootAgent, loadFixtures } from "@openkarta/reference-agent-shop/src/agent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runProductPack } from "../../src/packs/product";

let baseUrl = "";
const secret = "x".repeat(32);
const fx = loadFixtures("./fixtures");

beforeAll(async () => {
  baseUrl = await bootAgent(fx, 0, secret);
});
afterAll(async () => {
  /* fastify closed implicitly when vitest ends */
});

describe("product pack", () => {
  it("passes all 4 product tests against Halcyon Shop", async () => {
    const report = await runProductPack({ baseUrl });
    expect(report.pack).toBe("product");
    expect(report.tests).toHaveLength(4);
    const failures = report.tests.filter((t) => !t.passed).map((t) => `${t.name}: ${t.message}`);
    expect(failures, failures.join("\n")).toEqual([]);
    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(4);
  });
});
