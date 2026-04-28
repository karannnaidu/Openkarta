import { bootAgent, loadFixtures } from "@openkarta/reference-agent-stays/src/agent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runServicePack } from "../../src/packs/service";

let baseUrl = "";
const secret = "x".repeat(32);
const fx = loadFixtures("./fixtures");

beforeAll(async () => {
  baseUrl = await bootAgent(fx, 0, secret);
});
afterAll(async () => {
  /* fastify closed implicitly when vitest ends */
});

describe("service pack", () => {
  it("passes all 4 service tests against Halcyon Stays (which exposes services)", async () => {
    const report = await runServicePack({ baseUrl });
    expect(report.pack).toBe("service");
    expect(report.tests).toHaveLength(4);
    const failures = report.tests.filter((t) => !t.passed).map((t) => `${t.name}: ${t.message}`);
    expect(failures, failures.join("\n")).toEqual([]);
    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(4);
  });
});
