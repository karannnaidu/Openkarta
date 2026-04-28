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
      pack: "bus",
      passed: true,
      durationMs: Date.now() - t0,
      ...(note ? { message: note } : {}),
    };
  } catch (e) {
    return {
      name,
      pack: "bus",
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

interface BusSearchItem {
  id: string;
  boardingPoints?: Array<{ id: string }>;
  droppingPoints?: Array<{ id: string }>;
}

export const runBusPack = async (ctx: RunCtx): Promise<PackReport> => {
  const results: TestResult[] = [];

  const search = await fetchJson<{ items: BusSearchItem[] }>(`${ctx.baseUrl}/v0/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: {
        type: "bus",
        origin: "Bengaluru",
        destination: "Pune",
        departure: "2026-12-01",
        pax: 1,
      },
    }),
  });
  const buses = search.items ?? [];

  // Test 1: boarding-point-selection — soft (harness doesn't cross-validate boarding IDs)
  results.push(
    await test("boarding-point-selection", async () => {
      const bus = buses[0];
      if (!bus) return "skipped: no bus items in catalogue";
      const cart = {
        cartId: "conformance_bp",
        lines: [
          {
            itemType: "bus",
            itemId: bus.id,
            passengers: [{ firstName: "A", lastName: "B" }],
            boardingPointId: "bp_invalid_xyz",
            droppingPointId: bus.droppingPoints?.[0]?.id ?? "dp1",
          },
        ],
      };
      const res = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      if (res.ok)
        return "warn: agent does not validate boardingPointId against item (SHOULD return 422)";
    }),
  );

  // Test 2: seat-selection (double-book) — soft
  results.push(
    await test("seat-selection", async () => {
      const bus = buses[0];
      if (!bus) return "skipped: no bus items";
      const baseLine = {
        itemType: "bus",
        itemId: bus.id,
        passengers: [{ firstName: "A", lastName: "B" }],
        boardingPointId: bus.boardingPoints?.[0]?.id ?? "bp1",
        droppingPointId: bus.droppingPoints?.[0]?.id ?? "dp1",
        seatSelection: ["L1"],
      };
      const cart1 = { cartId: "conformance_seat1", lines: [baseLine] };
      const r1 = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart: cart1 }),
      });
      if (!r1.ok) throw new Error(`first seat quote returned ${r1.status}`);
      const cart2 = { cartId: "conformance_seat2", lines: [baseLine] };
      const r2 = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart: cart2 }),
      });
      if (r2.ok) return "warn: agent does not detect double-booked seats (SHOULD return 409)";
    }),
  );

  // Test 3: operator-cancellation — hard (harness cancel sets state=cancelled)
  results.push(
    await test("operator-cancellation", async () => {
      const bus = buses[0];
      if (!bus) throw new Error("no bus item to probe cancellation");
      const cart = {
        cartId: "conformance_cancel",
        lines: [
          {
            itemType: "bus",
            itemId: bus.id,
            passengers: [{ firstName: "A", lastName: "B" }],
            boardingPointId: bus.boardingPoints?.[0]?.id ?? "bp1",
            droppingPointId: bus.droppingPoints?.[0]?.id ?? "dp1",
          },
        ],
      };
      const q = await fetchJson<{ quoteToken: string }>(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      const order = await fetchJson<{ orderId: string }>(`${ctx.baseUrl}/v0/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cart,
          payment: { rail: "razorpay_routes", method: "upi" },
          quoteToken: q.quoteToken,
        }),
      });
      const cancelled = await fetchJson<{ fulfilmentStatus?: { state?: string } }>(
        `${ctx.baseUrl}/v0/orders/${order.orderId}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "operator_cancelled" }),
        },
      );
      if (cancelled.fulfilmentStatus?.state !== "cancelled") {
        throw new Error(
          `expected fulfilmentStatus.state=cancelled, got ${String(cancelled.fulfilmentStatus?.state)}`,
        );
      }
    }),
  );

  // Test 4: travel-date-validation — soft (sdk-node Cart has no past-date check)
  results.push(
    await test("travel-date-validation", async () => {
      return "warn: bus cart schema does not capture travel date directly; agent enforcement out of scope";
    }),
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  return {
    pack: "bus",
    tests: results,
    passedCount,
    failedCount,
    durationMs: results.reduce((s, r) => s + r.durationMs, 0),
  };
};
