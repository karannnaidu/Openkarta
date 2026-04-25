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

export class OpenKartaError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OpenKartaError';
  }
}

export interface ClientOptions {
  baseUrl:    string;
  timeoutMs?: number;
  userToken?: string;
  headers?:   Record<string, string>;
  /** Custom fetch implementation; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** @deprecated use fetchImpl */
  fetch?:     typeof fetch;
}

/** @deprecated use {@link ClientOptions} */
export type ClientOpts = ClientOptions;

export interface SearchResults {
  items: Item[];
}

export interface CheckoutInput {
  cart:        Cart;
  payment:     { rail?: string; method?: string; ref?: string };
  address?:    unknown;
  quoteToken:  string;
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
  return:   (orderId: string, reason: string, items?: unknown[]) => Promise<Refund>;
}

/** @deprecated retained for backwards compatibility — use {@link OpenKartaClient}. */
export type Client = OpenKartaClient;

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
  const f = opts.fetchImpl ?? opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.userToken ? { 'x-openkarta-user-token': opts.userToken } : {}),
    ...opts.headers,
    ...(init.headers as Record<string, string> | undefined),
  };

  const controller = opts.timeoutMs ? new AbortController() : undefined;
  const timer      = controller
    ? setTimeout(() => controller.abort(new Error('timeout')), opts.timeoutMs)
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
    if (e?.name === 'AbortError' || /abort/i.test(e?.message ?? '')) {
      throw new OpenKartaError('internal', 0, `Request aborted: timeout after ${opts.timeoutMs}ms`);
    }
    throw err;
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
  return:   (orderId, reason, items = []) => doFetch<Refund>(opts, `/v0/orders/${encodeURIComponent(orderId)}/return`, {
    method: 'POST',
    body:   JSON.stringify({ items, reason }),
  }),
});
