import { bootAgent, loadFixtures } from "@openkarta/reference-agent-shop/src/agent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCorePack } from "../../src/packs/core";

let baseUrl = "";
const secret = "x".repeat(32);
const fx = loadFixtures("./fixtures");

beforeAll(async () => {
  baseUrl = await bootAgent(fx, 0, secret);
});
afterAll(async () => {
  /* fastify closed implicitly when vitest ends */
});

describe("core pack", () => {
  it("passes all 8 core tests against Halcyon Shop", async () => {
    const report = await runCorePack({ baseUrl });
    expect(report.pack).toBe("core");
    expect(report.tests).toHaveLength(8);
    const failures = report.tests.filter((t) => !t.passed).map((t) => `${t.name}: ${t.message}`);
    expect(failures, failures.join("\n")).toEqual([]);
    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(8);
    expect(report.tests.every((t) => t.passed)).toBe(true);
  });
});
