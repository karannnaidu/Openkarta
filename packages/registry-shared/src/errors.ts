export const REGISTRY_ERROR_CODES = [
  "account_required",
  "agent_not_found",
  "agent_id_taken",
  "domain_verification_pending",
  "rate_limited",
  "validation_failed",
  "forbidden",
] as const;

export type RegistryErrorCode = (typeof REGISTRY_ERROR_CODES)[number];

const STATUS: Record<RegistryErrorCode, number> = {
  account_required: 401,
  agent_not_found: 404,
  agent_id_taken: 409,
  domain_verification_pending: 409,
  rate_limited: 429,
  validation_failed: 400,
  forbidden: 403,
};

export function httpStatusFor(code: RegistryErrorCode): number {
  return STATUS[code];
}

export class RegistryError extends Error {
  constructor(
    public readonly code: RegistryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RegistryError";
  }

  toJSON(): { error: { code: RegistryErrorCode; message: string } } {
    return { error: { code: this.code, message: this.message } };
  }
}
