import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DispatchFn } from "@openkarta/orchestrator";
import { type McpErrorResult, toMcpError } from "./errors.js";

export interface McpSuccessResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: undefined;
}

export type McpToolResult = McpSuccessResult | McpErrorResult;
// Compile-time guard: our content shape must remain assignable to the SDK's
// CallToolResult content. If the SDK narrows or restructures content variants,
// this assertion fails and the call-site cast in server.ts becomes unsafe.
type _ContentIsAssignable = McpToolResult["content"] extends CallToolResult["content"]
  ? true
  : never;
const _check: _ContentIsAssignable = true;
void _check;

export async function runTool(
  dispatch: DispatchFn,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  try {
    const result = await dispatch(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result ?? null) }],
    };
  } catch (err) {
    return toMcpError(err);
  }
}
