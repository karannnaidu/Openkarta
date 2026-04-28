import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createOrchestrator,
  createStatelessDispatcher,
  type DispatchFn,
  type RegistrySnapshot,
} from "@openkarta/orchestrator";
import { toMcpError } from "./errors.js";
import { loadBridgeRegistry } from "./registry.js";
import { buildServer } from "./server.js";

export interface BootstrapOpts {
  registry?: RegistrySnapshot;
  dispatch?: DispatchFn;
  /** "stdio" (real) or "noop" (test). */
  transport?: "stdio" | "noop";
}

export async function bootstrap(opts: BootstrapOpts = {}) {
  let registry: RegistrySnapshot;
  if (opts.registry) {
    registry = opts.registry;
  } else {
    try {
      registry = await loadBridgeRegistry();
    } catch (err) {
      const e = toMcpError({
        bridgeCode: "bridge_registry_unavailable",
        message: err instanceof Error ? err.message : String(err),
      });
      process.stderr.write(`${e.content[0]!.text}\n`);
      throw err;
    }
  }

  const dispatch = opts.dispatch ?? createStatelessDispatcher(createOrchestrator({ registry }));
  const server = buildServer({ registry, dispatch });
  const startedAt = new Date();

  if (opts.transport === "stdio" || opts.transport === undefined) {
    if (opts.transport === undefined && process.env.NODE_ENV === "test") {
      return { server, startedAt };
    }
    if (opts.transport === "stdio") {
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
  }

  return { server, startedAt };
}

const isDirectInvocation =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")));
if (isDirectInvocation) {
  bootstrap({ transport: "stdio" }).catch((err) => {
    process.stderr.write(
      `@openkarta/mcp-bridge failed to start: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
