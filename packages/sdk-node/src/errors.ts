import { type ErrorCode, errorStatusFor } from '@openkarta/spec';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; retryable: boolean; details?: Record<string, unknown> };
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
  body:   { error: { code, message, retryable, details }, requestId },
});
