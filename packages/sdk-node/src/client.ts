import type {
  CapabilitiesManifest,
  Cart,
  ErrorCode,
  Item,
  ItemBase,
  Order,
  Quote,
  Refund,
  SearchQuery,
} from '@openkarta/spec';
import { OpenKartaError } from './errors.js';

export interface ClientOptions {
  baseUrl:    string;
  timeoutMs?: number;
  userToken?: string;
  headers?:   Record<string, string>;
  /** Custom fetch implementation; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

export interface SearchResults {
  items: Item[];
}

export interface CheckoutInput {
  cart:        Cart;
  payment:     { rail?: string; method?: string; ref?: string };
  address?:    unknown;
  quoteToken:  string;
}

export interface ReturnInput {
  reason: string;
  items?: unknown[];
}

export interface OpenKartaClient {
  baseUrl:  string;
  discover: () => Promise<CapabilitiesManifest>;
  search:   (query: SearchQuery) => Promise<SearchResults>;
  get:      (itemId: string) => Promise<ItemBase>;
  quote:    (cart: Cart, userContext?: unknown) => Promise<Quote>;
  checkout: (input: CheckoutInput) => Promise<Order>;
  status:   (orderId: string) => Promise<Order>;
  cancel:   (orderId: string, reason: string) => Promise<Order>;
  /**
   * Submit a return request. The protocol's `/v0/orders/:orderId/return` endpoint
   * accepts an optional `items` array (per-line refund quantity); when omitted the
   * request is treated as a full-order return. Returns a `Refund` record.
   */
  return:   (orderId: string, input: ReturnInput) => Promise<Refund>;
}

interface ServerErrorBody {
  error?: {
    code:      ErrorCode;
    message:   string;
    retryable?: boolean;
    details?:  unknown;
  };
}

const doFetch = async <T = unknown>(
  opts: ClientOptions,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const f = opts.fetchImpl ?? globalThis.fetch;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.userToken ? { 'x-openkarta-user-token': opts.userToken } : {}),
    ...opts.headers,
    ...(init.headers as Record<string, string> | undefined),
  };

  const controller = opts.timeoutMs ? new AbortController() : undefined;
  const timer      = controller
    ? setTimeout(() => controller.abort(), opts.timeoutMs)
    : undefined;

  let res: Response;
  try {
    res = await f(`${opts.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    const e = err as Error & { name?: string };
    if (e?.name === 'AbortError') {
      throw new OpenKartaError('timeout', 0, `Request aborted: timeout after ${opts.timeoutMs}ms`);
    }
    throw new OpenKartaError('network_error', 0, e?.message ?? 'Network request failed');
  } finally {
    if (timer) clearTimeout(timer);
  }

  const bodyText = await res.text();
  const body     = bodyText ? (JSON.parse(bodyText) as unknown) : undefined;
  if (!res.ok) {
    const err = (body as ServerErrorBody | undefined)?.error;
    if (err) throw new OpenKartaError(err.code, res.status, err.message, err.details);
    throw new OpenKartaError('internal', res.status, `HTTP ${res.status}`);
  }
  return body as T;
};

export const createClient = (opts: ClientOptions): OpenKartaClient => ({
  baseUrl:  opts.baseUrl,
  discover: () => doFetch<CapabilitiesManifest>(opts, '/v0/discover'),
  // The wire protocol wraps the query in `{ query: ... }`; the public client takes the bare SearchQuery.
  search:   (query) => doFetch<SearchResults>(opts, '/v0/search', {
    method: 'POST',
    body:   JSON.stringify({ query }),
  }),
  get:      (itemId) => doFetch<ItemBase>(opts, `/v0/items/${encodeURIComponent(itemId)}`),
  quote:    (cart, userContext) => doFetch<Quote>(opts, '/v0/quote', {
    method: 'POST',
    body:   JSON.stringify({ cart, userContext }),
  }),
  checkout: (input) => doFetch<Order>(opts, '/v0/checkout', {
    method: 'POST',
    body:   JSON.stringify(input),
  }),
  status:   (orderId) => doFetch<Order>(opts, `/v0/orders/${encodeURIComponent(orderId)}/status`),
  cancel:   (orderId, reason) => doFetch<Order>(opts, `/v0/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    body:   JSON.stringify({ reason }),
  }),
  return:   (orderId, input) => doFetch<Refund>(opts, `/v0/orders/${encodeURIComponent(orderId)}/return`, {
    method: 'POST',
    body:   JSON.stringify({ items: input.items ?? [], reason: input.reason }),
  }),
});
