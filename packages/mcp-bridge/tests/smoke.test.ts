import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { DEFAULT_REGISTRY_URL } from "@openkarta/orchestrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function registryHealthy(): Promise<boolean> {
  try {
    const res = await fetch(DEFAULT_REGISTRY_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    if (text.trimStart().startsWith("<")) return false;
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

describe("subprocess smoke", () => {
  it("spawns dist/bin.js and lists 8 tools", async (ctx) => {
    if (!(await registryHealthy())) {
      ctx.skip();
      return;
    }
    const here = path.dirname(fileURLToPath(import.meta.url));
    const bin = path.resolve(here, "../dist/bin.js");
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bin],
    });
    const client = new Client({ name: "smoke", version: "0.0.0" }, { capabilities: {} });
    await client.connect(transport);
    try {
      const list = await client.listTools();
      expect(list.tools.length).toBe(8);
    } finally {
      await client.close();
    }
  }, 20_000);
});
