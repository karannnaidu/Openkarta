import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  type DispatchFn,
  type RegistrySnapshot,
  buildStatelessToolDefs,
} from "@openkarta/orchestrator";
import { runTool } from "./tools.js";

export interface BuildServerOpts {
  registry: RegistrySnapshot;
  dispatch: DispatchFn;
  serverInfo?: { name?: string; version?: string };
}

export function buildServer(opts: BuildServerOpts): Server {
  const server = new Server(
    {
      name: opts.serverInfo?.name ?? "@openkarta/mcp-bridge",
      version: opts.serverInfo?.version ?? "0.0.0",
    },
    {
      capabilities: { tools: {} },
    },
  );

  const tools = buildStatelessToolDefs().map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: d.parameters,
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const result = await runTool(opts.dispatch, name, (args ?? {}) as Record<string, unknown>);
    return result as CallToolResult;
  });

  return server;
}
