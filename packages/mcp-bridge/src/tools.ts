import type { DispatchFn } from "@openkarta/orchestrator";
import { type McpErrorResult, toMcpError } from "./errors.js";

export interface McpSuccessResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: undefined;
}

export type McpToolResult = McpSuccessResult | McpErrorResult;

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
