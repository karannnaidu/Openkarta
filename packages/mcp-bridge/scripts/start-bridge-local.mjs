// Boot the bridge with the local registry/agents.json snapshot.
// Skips the network fetch of DEFAULT_REGISTRY_URL — useful when the live
// registry is down or for offline verification.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { bootstrap } from "../dist/bootstrap.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotPath = resolve(__dirname, "..", "..", "..", "registry", "agents.json");
const registry = JSON.parse(readFileSync(snapshotPath, "utf8"));

await bootstrap({ registry, transport: "stdio" });
