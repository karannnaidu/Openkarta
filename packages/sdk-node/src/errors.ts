import { type ErrorCode, errorStatusFor } from "@openkarta/spec";

/**
 * Client-side error codes extend the wire-protocol `ErrorCode` set with two
 * transport-layer failure modes that never originate from an agent response:
 *
 *  - `'timeout'`      — the request was aborted by the SDK's own timer.
 *  - `'network_error'` — fetch threw before a response was received
 *                        (DNS failure, ECONNREFUSED, TLS error, etc.).
 *
 * Orchestrators branch on `code` to decide retry behaviour, so these must be
 * distinct from `'internal'` (which means the agent's handler crashed).
 */
export type ClientErrorCode = ErrorCode | "timeout" | "network_error";

export class OpenKartaError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OpenKartaError";
  }
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

export const toErrorResponse = (
  code: ErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, unknown>,
  requestId?: string,
): { status: number; body: ErrorBody } => ({
  status: errorStatusFor(code),
  body: {
    error: { code, message, retryable, ...(details !== undefined ? { details } : {}) },
    ...(requestId !== undefined ? { requestId } : {}),
  },
});
