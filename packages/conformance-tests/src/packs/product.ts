import type { PackReport, TestResult } from '../types.js';

interface RunCtx { baseUrl: string; userToken?: string; }

const test = async (name: string, fn: () => Promise<string | void>): Promise<TestResult> => {
  const t0 = Date.now();
  try {
    const note = await fn();
    return {
      name, pack: 'product', passed: true, durationMs: Date.now() - t0,
      ...(note ? { message: note } : {}),
    };
  } catch (e) {
    return { name, pack: 'product', passed: false, message: String((e as Error).message), durationMs: Date.now() - t0 };
  }
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  return (await res.json()) as T;
};

interface ProductSearchItem { id: string; sku?: string; variants?: Array<{ sku: string }>; inventoryStatus?: string; }
interface ManifestShape {
  productCapabilities?: { deliveryModes: string[]; returnWindow: number };
}
interface QuoteShape { quoteToken: string; estimatedFulfilmentAt?: string; }
interface CheckoutResp { orderId: string; }
interface ReturnResp { status?: string; }

export const runProductPack = async (ctx: RunCtx): Promise<PackReport> => {
  const results: TestResult[] = [];
  const manifest = await fetchJson<ManifestShape>(`${ctx.baseUrl}/v0/discover`);
  const search   = await fetchJson<{ items: ProductSearchItem[] }>(`${ctx.baseUrl}/v0/search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: { type: 'product' } }),
  });
  const items = search.items ?? [];

  // Test 1: variants — soft (skip if catalogue has none)
  results.push(await test('variants', async () => {
    const withVariants = items.find((i) => Array.isArray(i.variants) && i.variants.length > 0);
    if (!withVariants) return 'skipped: no variants in catalogue';
    const variantSku = withVariants.variants![0]!.sku;
    const cart = { cartId: 'conformance_variants', lines: [{ itemType: 'product', itemId: withVariants.id, quantity: 1, variantSku }] };
    const q = await fetchJson<QuoteShape>(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart }),
    });
    if (!q.quoteToken) throw new Error('variant quote returned no token');
  }));

  // Test 2: delivery-modes — hard for instant
  results.push(await test('delivery-modes', async () => {
    const modes = manifest.productCapabilities?.deliveryModes ?? [];
    if (modes.length === 0) throw new Error('manifest declares no deliveryModes');
    if (!modes.includes('instant')) return 'skipped: agent does not declare instant delivery';
    const itemId = items[0]?.id;
    if (!itemId) throw new Error('no product to quote');
    const cart = { cartId: 'conformance_delivery', lines: [{ itemType: 'product', itemId, quantity: 1 }] };
    const q = await fetchJson<QuoteShape>(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart }),
    });
    if (!q.estimatedFulfilmentAt) throw new Error('instant delivery declared but no estimatedFulfilmentAt');
    const eta = new Date(q.estimatedFulfilmentAt).getTime();
    const ceiling = Date.now() + 45 * 60_000;
    if (eta > ceiling) throw new Error(`instant ETA ${q.estimatedFulfilmentAt} > 45 min from now`);
  }));

  // Test 3: inventory-states — SHOULD not MUST; warn if not enforced
  results.push(await test('inventory-states', async () => {
    const withStatus = items.filter((i) => typeof i.inventoryStatus === 'string');
    if (withStatus.length === 0) return 'warn: no items expose inventoryStatus';
    const out = items.find((i) => i.inventoryStatus === 'out');
    if (!out) return 'warn: no out-of-stock items in catalogue to probe';
    const cart = { cartId: 'conformance_inventory', lines: [{ itemType: 'product', itemId: out.id, quantity: 1 }] };
    const res = await fetch(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart }),
    });
    if (res.ok) return 'warn: agent does not enforce inventory_unavailable on out items (SHOULD-not-MUST)';
    const body = await res.json() as { error?: { code?: string } };
    if (body?.error?.code !== 'inventory_unavailable') {
      return `warn: out-of-stock quote returned ${body?.error?.code ?? 'unknown'} instead of inventory_unavailable`;
    }
  }));

  // Test 4: return-window — hard
  results.push(await test('return-window', async () => {
    const window = manifest.productCapabilities?.returnWindow;
    if (window === undefined) throw new Error('manifest missing productCapabilities.returnWindow');
    const itemId = items[0]?.id;
    if (!itemId) throw new Error('no product to checkout');
    const cart = { cartId: 'conformance_return', lines: [{ itemType: 'product', itemId, quantity: 1 }] };
    const q = await fetchJson<QuoteShape>(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart }),
    });
    const order = await fetchJson<CheckoutResp>(`${ctx.baseUrl}/v0/checkout`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart, payment: { rail: 'razorpay_routes', method: 'upi' }, quoteToken: q.quoteToken }),
    });
    const refund = await fetchJson<ReturnResp>(`${ctx.baseUrl}/v0/orders/${order.orderId}/return`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ itemId, quantity: 1 }], reason: 'changed_mind' }),
    });
    if (refund.status !== 'initiated') throw new Error(`expected refund.status=initiated, got ${String(refund.status)}`);
  }));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  return { pack: 'product', tests: results, passedCount, failedCount,
           durationMs: results.reduce((s, r) => s + r.durationMs, 0) };
};
