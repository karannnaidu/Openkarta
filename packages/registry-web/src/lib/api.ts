// Typed fetch wrappers for the OpenKarta registry-api. Browser-safe (no node deps).

export const API_BASE: string =
  (typeof window !== "undefined"
    ? (window as { __OPENKARTA_API__?: string }).__OPENKARTA_API__
    : undefined) ??
  (import.meta.env.PUBLIC_API_BASE as string | undefined) ??
  "https://registry.openkarta.org";

export interface AgentListing {
  agentId: string;
  displayName: string;
  description?: string;
  baseUrl: string;
  manifestUrl: string;
  tier: "lite" | "http" | "agentic";
  supportedItemTypes: string[];
  regions?: { country: string; city?: string; pincodes?: string[] }[];
  tags?: string[];
  verificationStatus: "pending" | "verified" | "delisted";
  healthStatus: "unknown" | "healthy" | "stale" | "delisted";
  consecutiveFailures: number;
  lastVerifiedAt?: string;
  createdAt: string;
}

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AgentDetail {
  agent: AgentListing;
  lastBadgeRun: BadgeRun | null;
  history: BadgeRunDay[];
}

export interface BadgeRun {
  id: string;
  ranAt: string;
  passed: boolean;
  testsPassed: number;
  testsFailed: number;
  packs: string[];
  errorSummary?: string;
}

export interface BadgeRunDay {
  date: string;
  passed: boolean;
}

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  githubLogin: string | null;
}

export interface ErrorBody {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = data as ErrorBody | undefined;
    throw new ApiError(
      res.status,
      err?.error.code ?? "http_error",
      err?.error.message ?? `HTTP ${res.status}`,
    );
  }
  return data as T;
}

export interface ListAgentsQuery {
  itemType?: string;
  country?: string;
  city?: string;
  pincode?: string;
  tier?: string;
  include?: "delisted";
  cursor?: string;
}

function qs(params: ListAgentsQuery): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const listAgents = (q: ListAgentsQuery = {}): Promise<PageResponse<AgentListing>> =>
  http(`/v1/agents${qs(q)}`);

export const getAgent = (id: string): Promise<AgentDetail> =>
  http(`/v1/agents/${encodeURIComponent(id)}`);

export const getMe = (): Promise<{ account: Account }> => http("/auth/me");

export const logout = (): Promise<void> => http("/auth/logout", { method: "POST" });

export interface CreateAgentBody {
  agentId: string;
  displayName: string;
  description?: string;
  baseUrl: string;
  manifestUrl?: string;
  tier: "lite" | "http" | "agentic";
  supportedItemTypes: string[];
  regions?: { country: string; city?: string; pincodes?: string[] }[];
  tags?: string[];
}

export interface CreateAgentResponse {
  agent: AgentListing;
  verificationInstructions: { token: string; path: string };
}

export const createAgent = (body: CreateAgentBody): Promise<CreateAgentResponse> =>
  http("/v1/agents", { method: "POST", body: JSON.stringify(body) });

export const verifyAgent = (id: string): Promise<{ status: string }> =>
  http(`/v1/agents/${encodeURIComponent(id)}/verify`, { method: "POST" });

export const reverifyAgent = (id: string): Promise<{ status: string }> =>
  http(`/v1/agents/${encodeURIComponent(id)}/reverify-conformance`, { method: "POST" });

export const deleteAgent = (id: string): Promise<void> =>
  http(`/v1/agents/${encodeURIComponent(id)}`, { method: "DELETE" });

export const requestMagicLink = (email: string): Promise<void> =>
  http("/auth/magic-link", { method: "POST", body: JSON.stringify({ email }) });
