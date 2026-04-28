import { errorHintFor, type ErrorResponse, type ErrorCode } from "@openkarta/spec";

export const BRIDGE_ERROR_HINTS = {
  bridge_registry_unavailable: "OpenKarta registry is unreachable. Retry shortly.",
  bridge_network_error: "Merchant unreachable. Try a different agentId or retry shortly.",
  bridge_invalid_merchant_response: "Merchant returned an invalid response. Pick a different agent.",
  bridge_invalid_merchant: "agentId not found in the OpenKarta registry. Use search to find a valid agentId.",
  bridge_invalid_args: "The supplied tool arguments did not validate. Inspect details for the offending field path.",
} as const;

export type BridgeErrorCode = keyof typeof BRIDGE_ERROR_HINTS;

export interface McpErrorResult {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
}

interface BridgeErrorInput {
  bridgeCode: BridgeErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

function isOpenKartaError(input: unknown): input is ErrorResponse {
  return (
    typeof input === "object" &&
    input !== null &&
    "error" in input &&
    typeof (input as { error: unknown }).error === "object" &&
    (input as { error: { code?: unknown } }).error !== null &&
    typeof (input as { error: { code?: unknown } }).error.code === "string"
  );
}

function isBridgeError(input: unknown): input is BridgeErrorInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "bridgeCode" in input &&
    typeof (input as { bridgeCode: unknown }).bridgeCode === "string"
  );
}

export function toMcpError(input: unknown): McpErrorResult {
  if (isOpenKartaError(input)) {
    const e = input.error;
    const payload = {
      code: e.code as ErrorCode,
      message: e.message,
      hint: errorHintFor(e.code as ErrorCode),
      retryable: e.retryable,
      ...(e.details ? { details: e.details } : {}),
    };
    return { isError: true, content: [{ type: "text", text: JSON.stringify(payload) }] };
  }
  if (isBridgeError(input)) {
    const payload = {
      code: input.bridgeCode,
      message: input.message,
      hint: BRIDGE_ERROR_HINTS[input.bridgeCode],
      ...(input.details ? { details: input.details } : {}),
    };
    return { isError: true, content: [{ type: "text", text: JSON.stringify(payload) }] };
  }
  const msg = input instanceof Error ? input.message : String(input);
  const payload = {
    code: "internal",
    message: msg,
    hint: "Unexpected bridge error. Retry; if it persists, file an issue.",
  };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(payload) }] };
}
