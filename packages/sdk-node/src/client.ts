import type { ErrorCode } from '@openkarta/spec';

export class OpenKartaError extends Error {
  constructor(public code: ErrorCode, public status: number, message: string, public retryable: boolean) {
    super(message);
    this.name = 'OpenKartaError';
  }
}

export interface ClientOpts {
  baseUrl:   string;
  userToken?: string;
  headers?:  Record<string, string>;
  fetch?:    typeof fetch;
}

export interface Client {
  discover: () => Promise<unknown>;
  search:   (query: unknown) => Promise<unknown>;
  get:      (itemId: string) => Promise<unknown>;
  quote:    (cart: unknown, userContext?: unknown) => Promise<unknown>;
  checkout: (input: { cart: unknown; payment: unknown; address?: unknown; quoteToken: string }) => Promise<unknown>;
  status:   (orderId: string) => Promise<unknown>;
  cancel:   (orderId: string, reason: string) => Promise<unknown>;
  return:   (orderId: string, items: unknown[], reason: string) => Promise<unknown>;
}

const doFetch = async (opts: ClientOpts, path: string, init: RequestInit = {}): Promise<unknown> => {
  const f = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.userToken ? { 'x-openkarta-user-token': opts.userToken } : {}),
    ...opts.headers,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await f(`${opts.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers });
  const bodyText = await res.text();
  const body = bodyText ? JSON.parse(bodyText) : undefined;
  if (!res.ok) {
    const err = body?.error as { code: ErrorCode; message: string; retryable: boolean } | undefined;
    if (err) throw new OpenKartaError(err.code, res.status, err.message, err.retryable);
    throw new OpenKartaError('internal', res.status, `HTTP ${res.status}`, false);
  }
  return body;
};

export const createClient = (opts: ClientOpts): Client => ({
  discover: () => doFetch(opts, '/v0/discover'),
  search:   (query) => doFetch(opts, '/v0/search', { method: 'POST', body: JSON.stringify({ query }) }),
  get:      (itemId) => doFetch(opts, `/v0/items/${encodeURIComponent(itemId)}`),
  quote:    (cart, userContext) => doFetch(opts, '/v0/quote', { method: 'POST', body: JSON.stringify({ cart, userContext }) }),
  checkout: (input) => doFetch(opts, '/v0/checkout', { method: 'POST', body: JSON.stringify(input) }),
  status:   (orderId) => doFetch(opts, `/v0/orders/${encodeURIComponent(orderId)}/status`),
  cancel:   (orderId, reason) => doFetch(opts, `/v0/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  return:   (orderId, items, reason) => doFetch(opts, `/v0/orders/${encodeURIComponent(orderId)}/return`, { method: 'POST', body: JSON.stringify({ items, reason }) }),
});
