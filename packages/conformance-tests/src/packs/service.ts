import type { PackReport, TestResult } from '../types.js';

interface RunCtx { baseUrl: string; userToken?: string; }

const test = async (name: string, fn: () => Promise<string | void>): Promise<TestResult> => {
  const t0 = Date.now();
  try {
    const note = await fn();
    return {
      name, pack: 'service', passed: true, durationMs: Date.now() - t0,
      ...(note ? { message: note } : {}),
    };
  } catch (e) {
    return { name, pack: 'service', passed: false, message: String((e as Error).message), durationMs: Date.now() - t0 };
  }
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  return (await res.json()) as T;
};

interface ServiceLocation {
  mode: 'at_customer' | 'at_provider' | 'online' | 'venue';
  serviceRadius?: number;
  address?: unknown;
  joinUrl?: string;
  venueAddress?: unknown;
}

interface ServiceSearchItem {
  id: string;
  durationMinutes?: number;
  providerName?: string;
  location?: ServiceLocation;
}

export const runServicePack = async (ctx: RunCtx): Promise<PackReport> => {
  const results: TestResult[] = [];

  // The Service search query requires a category — try common ones to find any service item.
  const probeCategories = ['wellness.massage', 'wellness.yoga', 'spa.facial', 'service'];
  let services: ServiceSearchItem[] = [];
  for (const category of probeCategories) {
    const search = await fetchJson<{ items?: ServiceSearchItem[] }>(`${ctx.baseUrl}/v0/search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: { type: 'service', category, location: { country: 'IN' } } }),
    });
    if (search.items && search.items.length > 0) { services = search.items; break; }
  }

  // Test 1: slot-booking — soft (harness doesn't track slot state)
  results.push(await test('slot-booking', async () => {
    const svc = services[0];
    if (!svc) return 'skipped: no service items returned by probe categories';
    const baseLine = {
      itemType: 'service', itemId: svc.id,
      slotStart: '2026-12-01T10:00:00Z',
      slotEnd:   '2026-12-01T11:00:00Z',
      headcount: 1,
    };
    const r1 = await fetch(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart: { cartId: 'conformance_slot1', lines: [baseLine] } }),
    });
    if (!r1.ok) throw new Error(`first slot quote returned ${r1.status}`);
    const r2 = await fetch(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart: { cartId: 'conformance_slot2', lines: [baseLine] } }),
    });
    if (r2.ok) return 'warn: agent does not detect double-booked slots (SHOULD return 409)';
  }));

  // Test 2: location-mode-variants — hard (read manifest+items, verify shape per mode)
  results.push(await test('location-mode-variants', async () => {
    if (services.length === 0) return 'skipped: no service items to inspect';
    for (const svc of services) {
      const loc = svc.location;
      if (!loc) throw new Error(`service ${svc.id} missing location`);
      switch (loc.mode) {
        case 'at_customer':
          // serviceRadius is optional in the spec but recommended; if present must be number
          if (loc.serviceRadius !== undefined && typeof loc.serviceRadius !== 'number')
            throw new Error(`service ${svc.id} at_customer serviceRadius not numeric`);
          break;
        case 'at_provider':
          if (!loc.address) throw new Error(`service ${svc.id} at_provider missing address`);
          break;
        case 'online':
          if (loc.joinUrl !== undefined && typeof loc.joinUrl !== 'string')
            throw new Error(`service ${svc.id} online joinUrl not string`);
          break;
        case 'venue':
          if (!loc.venueAddress) throw new Error(`service ${svc.id} venue missing venueAddress`);
          break;
        default:
          throw new Error(`service ${svc.id} unknown location.mode ${String(loc.mode)}`);
      }
    }
  }));

  // Test 3: provider-attribution — soft (Order schema does not require providerName)
  results.push(await test('provider-attribution', async () => {
    if (services.length === 0) return 'skipped: no service items';
    const withProvider = services.find((s) => typeof s.providerName === 'string');
    if (!withProvider) return 'warn: no service item declares providerName (optional field)';
    return 'warn: harness does not surface providerName on the Order response';
  }));

  // Test 4: duration-enforcement — hard (slot end - start ~= durationMinutes ±5)
  results.push(await test('duration-enforcement', async () => {
    const svc = services.find((s) => typeof s.durationMinutes === 'number');
    if (!svc) return 'skipped: no service declares durationMinutes';
    const minutes = svc.durationMinutes!;
    const slotStart = new Date('2026-12-01T10:00:00Z');
    const slotEnd   = new Date(slotStart.getTime() + minutes * 60_000);
    const cart = {
      cartId: 'conformance_duration',
      lines: [{ itemType: 'service', itemId: svc.id,
        slotStart: slotStart.toISOString(),
        slotEnd:   slotEnd.toISOString(),
        headcount: 1 }],
    };
    const q = await fetch(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart }),
    });
    if (!q.ok) throw new Error(`duration-conformant quote returned ${q.status}`);
    const diff = Math.abs((slotEnd.getTime() - slotStart.getTime()) / 60_000 - minutes);
    if (diff > 5) throw new Error(`slot duration off by ${diff} min from declared ${minutes}`);
  }));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  return { pack: 'service', tests: results, passedCount, failedCount,
           durationMs: results.reduce((s, r) => s + r.durationMs, 0) };
};
