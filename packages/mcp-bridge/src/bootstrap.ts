import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createOrchestrator,
  createStatelessDispatcher,
  type DispatchFn,
  type RegistrySnapshot,
} from "@openkarta/orchestrator";
import { loadBridgeRegistry } from "./registry.js";
import { buildServer } from "./server.js";

export interface BootstrapOpts {
  registry?: RegistrySnapshot;
  dispatch?: DispatchFn;
  /** `"stdio"` (real, default) or `"noop"` (test — returns an unconnected server) */
  transport?: "stdio" | "noop";
}

export async function bootstrap(opts: BootstrapOpts = {}) {
  let registry: RegistrySnapshot;
  if (opts.registry) {
    registry = opts.registry;
  } else {
    registry = await loadBridgeRegistry();
  }

  const dispatch = opts.dispatch ?? createStatelessDispatcher(createOrchestrator({ registry }));
  const server = buildServer({ registry, dispatch });
  const startedAt = new Date();

  const resolvedTransport = opts.transport ?? "stdio";
  if (resolvedTransport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }

  return { server, startedAt };
}
