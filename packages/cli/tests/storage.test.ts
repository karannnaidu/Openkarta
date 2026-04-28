import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  process.env.OPENKARTA_HOME = mkdtempSync(join(tmpdir(), "okt-cli-"));
});

describe("storage", () => {
  it("round-trips state", async () => {
    const { readState, writeState } = await import("../src/storage.js");
    await writeState({ hello: "world" });
    expect(await readState()).toEqual({ hello: "world" });
  });
});
