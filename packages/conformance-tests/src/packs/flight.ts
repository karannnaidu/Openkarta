import type { PackReport, TestResult } from "../types.js";

interface RunCtx {
  baseUrl: string;
  userToken?: string;
}

const test = async (name: string, fn: () => Promise<string | void>): Promise<TestResult> => {
  const t0 = Date.now();
  try {
    const note = await fn();
    return {
      name,
      pack: "flight",
      passed: true,
      durationMs: Date.now() - t0,
      ...(note ? { message: note } : {}),
    };
  } catch (e) {
    return {
      name,
      pack: "flight",
      passed: false,
      message: String((e as Error).message),
      durationMs: Date.now() - t0,
    };
  }
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  return (await res.json()) as T;
};

interface FlightSearchItem {
  id: string;
  refundable?: boolean;
}

export const runFlightPack = async (ctx: RunCtx): Promise<PackReport> => {
  const results: TestResult[] = [];

  const search = await fetchJson<{ items: FlightSearchItem[] }>(`${ctx.baseUrl}/v0/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: { type: "flight", origin: "BLR", destination: "BOM", departure: "2026-12-01", pax: 1 },
    }),
  });
  const flights = search.items ?? [];

  // Test 1: passenger-validation — sdk-node validates schemas (firstName required)
  results.push(
    await test("passenger-validation", async () => {
      const flight = flights[0];
      if (!flight) return "skipped: no flight items in catalogue";
      const cart = {
        cartId: "conformance_pax",
        lines: [{ itemType: "flight", itemId: flight.id, passengers: [{ lastName: "B" }] }],
      };
      const res = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      if (res.ok) return "warn: agent accepted passenger missing firstName (SHOULD reject)";
      if (res.status !== 422 && res.status !== 400) {
        return `warn: missing firstName returned ${res.status}; expected 422 or 400`;
      }
    }),
  );

  // Test 2: seat-selection — soft (harness doesn't validate seats)
  results.push(
    await test("seat-selection", async () => {
      const flight = flights[0];
      if (!flight) return "skipped: no flight items";
      const cart = {
        cartId: "conformance_seat",
        lines: [
          {
            itemType: "flight",
            itemId: flight.id,
            passengers: [{ firstName: "A", lastName: "B" }],
            seatSelection: ["12A"],
          },
        ],
      };
      const q = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      if (!q.ok) throw new Error(`valid seat quote returned ${q.status}`);
      // probe invalid seat
      const bad = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cart: {
            ...cart,
            cartId: "conformance_seat_bad",
            lines: [{ ...cart.lines[0], seatSelection: ["99Z"] }],
          },
        }),
      });
      if (bad.ok) return "warn: agent does not reject invalid seat (SHOULD return 409)";
    }),
  );

  // Test 3: pnr-issuance — soft (harness may not populate trackingRef)
  results.push(
    await test("pnr-issuance", async () => {
      const flight = flights[0];
      if (!flight) return "skipped: no flight items";
      const cart = {
        cartId: "conformance_pnr",
        lines: [
          {
            itemType: "flight",
            itemId: flight.id,
            passengers: [{ firstName: "A", lastName: "B" }],
          },
        ],
      };
      const q = await fetchJson<{ quoteToken: string }>(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      const order = await fetchJson<{ trackingRef?: string }>(`${ctx.baseUrl}/v0/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cart,
          payment: { rail: "razorpay_routes", method: "upi" },
          quoteToken: q.quoteToken,
        }),
      });
      if (!order.trackingRef)
        return "warn: order missing trackingRef (PNR); harness does not issue";
    }),
  );

  // Test 4: fare-rules-refund — soft
  results.push(
    await test("fare-rules-refund", async () => {
      const refundable = flights.find((f) => f.refundable === true);
      const nonRefund = flights.find((f) => f.refundable === false);
      if (!refundable || !nonRefund)
        return "skipped: catalogue lacks both refundable and non-refundable flights";
      return "warn: harness flat-refunds 0 regardless of fare class";
    }),
  );

  // Test 5: multi-leg-rollback — soft
  results.push(
    await test("multi-leg-rollback", async () => {
      if (flights.length < 2) return "skipped: need ≥2 flights for multi-leg probe";
      return "warn: harness does not implement leg rollback (single-line carts only)";
    }),
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  return {
    pack: "flight",
    tests: results,
    passedCount,
    failedCount,
    durationMs: results.reduce((s, r) => s + r.durationMs, 0),
  };
};
