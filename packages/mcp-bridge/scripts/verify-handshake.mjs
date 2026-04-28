// One-shot verifier: spawns dist/bin.js, runs initialize â†’ tools/list,
// prints the tool names, exits. Not part of the test suite â€” operational tool.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = resolve(__dirname, "..", "dist", "bin.js");

const child = spawn(process.execPath, [binPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(`[bridge stderr] ${chunk}`);
});

let buf = "";
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function send(payload) {
  child.stdin.write(`${JSON.stringify(payload)}\n`);
}

function call(method, params) {
  const id = Math.floor(Math.random() * 1e9);
  return new Promise((resolveP, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 15000);
    pending.set(id, (msg) => {
      clearTimeout(t);
      if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
      else resolveP(msg.result);
    });
    send({ jsonrpc: "2.0", id, method, params });
  });
}

try {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-handshake", version: "0.0.0" },
  });
  console.log("âœ“ initialize OK");
  console.log(`  server: ${init.serverInfo?.name}@${init.serverInfo?.version}`);
  console.log(`  protocol: ${init.protocolVersion}`);

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  const tools = await call("tools/list", {});
  console.log(`âœ“ tools/list returned ${tools.tools.length} tools:`);
  for (const t of tools.tools) console.log(`    - ${t.name}`);
} catch (err) {
  console.error("âœ— handshake failed:", err.message);
  process.exitCode = 1;
} finally {
  child.kill();
}

