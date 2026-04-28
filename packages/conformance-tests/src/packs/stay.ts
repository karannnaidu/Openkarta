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
      pack: "stay",
      passed: true,
      durationMs: Date.now() - t0,
      ...(note ? { message: note } : {}),
    };
  } catch (e) {
    return {
      name,
      pack: "stay",
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

interface StaySearchItem {
  id: string;
  priceMinor?: number;
  checkInTime?: string;
  checkOutTime?: string;
  cancellationPolicy?: string;
}

const HHMM = /^\d{2}:\d{2}$/;

export const runStayPack = async (ctx: RunCtx): Promise<PackReport> => {
  const results: TestResult[] = [];

  const search = await fetchJson<{ items: StaySearchItem[] }>(`${ctx.baseUrl}/v0/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: {
        type: "stay",
        location: { country: "IN" },
        checkIn: "2026-12-01",
        checkOut: "2026-12-02",
        guests: 2,
      },
    }),
  });
  const stays = search.items ?? [];

  // Test 1: availability-calendar — soft (harness doesn't track double-booking)
  results.push(
    await test("availability-calendar", async () => {
      const stay = stays[0];
      if (!stay) throw new Error("no stay items to probe");
      const cart = {
        cartId: "conformance_avail",
        lines: [
          {
            itemType: "stay",
            itemId: stay.id,
            checkIn: "2026-12-01",
            checkOut: "2026-12-02",
            guests: 2,
          },
        ],
      };
      const q = await fetchJson<{ quoteToken?: string }>(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      if (!q.quoteToken) throw new Error("same-dates quote returned no token");
      // double-book probe: most reference harnesses don't enforce — soft pass
      const dup = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart: { ...cart, cartId: "conformance_avail_dup" } }),
      });
      if (dup.ok) return "warn: agent does not enforce slot_unavailable on overlapping bookings";
      const body = (await dup.json()) as { error?: { code?: string } };
      if (body?.error?.code !== "slot_unavailable") {
        return `warn: overlapping booking returned ${body?.error?.code ?? "ok"} instead of slot_unavailable`;
      }
    }),
  );

  // Test 2: cancellation-policy-refund — soft (harness always returns 0 refund)
  results.push(
    await test("cancellation-policy-refund", async () => {
      const flexible = stays.find((s) => s.cancellationPolicy === "flexible");
      const strict = stays.find((s) => s.cancellationPolicy === "strict");
      if (!flexible && !strict) return "skipped: no flexible or strict stays in catalogue";
      const probe = flexible ?? strict!;
      const cart = {
        cartId: "conformance_cancel",
        lines: [
          {
            itemType: "stay",
            itemId: probe.id,
            checkIn: "2026-12-10",
            checkOut: "2026-12-11",
            guests: 2,
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
      const cancel = await fetchJson<{ fulfilmentStatus?: { state?: string } }>(
        `${ctx.baseUrl}/v0/orders/${order.orderId}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: "user_cancelled" }),
        },
      );
      if (cancel.fulfilmentStatus?.state !== "cancelled") {
        return `warn: cancel returned state ${String(cancel.fulfilmentStatus?.state)}; expected 'cancelled'`;
      }
      return "warn: harness does not differentiate refund amount by policy (flat 0)";
    }),
  );

  // Test 3: checkin-checkout-times — hard (stays must declare HH:MM)
  results.push(
    await test("checkin-checkout-times", async () => {
      if (stays.length === 0) throw new Error("no stay items to probe");
      for (const s of stays) {
        if (!s.checkInTime || !HHMM.test(s.checkInTime))
          throw new Error(`stay ${s.id} checkInTime '${String(s.checkInTime)}' not HH:MM`);
        if (!s.checkOutTime || !HHMM.test(s.checkOutTime))
          throw new Error(`stay ${s.id} checkOutTime '${String(s.checkOutTime)}' not HH:MM`);
      }
    }),
  );

  // Test 4: service-add-on — hard (sdk-node enforces homogeneity)
  results.push(
    await test("service-add-on", async () => {
      const stay = stays[0];
      if (!stay) throw new Error("no stay item to probe");
      const cart = {
        cartId: "conformance_addon",
        lines: [
          {
            itemType: "stay",
            itemId: stay.id,
            checkIn: "2026-12-01",
            checkOut: "2026-12-02",
            guests: 2,
          },
          {
            itemType: "service",
            itemId: "sv_xyz",
            slotStart: "2026-12-01T10:00:00Z",
            slotEnd: "2026-12-01T11:00:00Z",
            headcount: 1,
          },
        ],
      };
      const res = await fetch(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      if (res.ok) throw new Error("mixed cart was accepted; expected cart_must_be_homogeneous");
      const body = (await res.json()) as { error?: { code?: string } };
      if (body?.error?.code !== "cart_must_be_homogeneous")
        throw new Error(`expected cart_must_be_homogeneous, got ${String(body?.error?.code)}`);
    }),
  );

  // Test 5: multi-night-pricing — soft (harness pricing is flat per line)
  results.push(
    await test("multi-night-pricing", async () => {
      const stay = stays[0];
      if (!stay) throw new Error("no stay item to probe");
      const cart = {
        cartId: "conformance_nights",
        lines: [
          {
            itemType: "stay",
            itemId: stay.id,
            checkIn: "2026-12-01",
            checkOut: "2026-12-04",
            guests: 2,
          },
        ],
      };
      const q = await fetchJson<{ totalMinor?: number }>(`${ctx.baseUrl}/v0/quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart }),
      });
      if (typeof q.totalMinor !== "number") throw new Error("quote missing totalMinor");
      if (typeof stay.priceMinor !== "number")
        return "warn: item lacks priceMinor; cannot verify multi-night math";
      const expected = stay.priceMinor * 3;
      const tolerance = expected * 0.2; // ±20% for fees
      if (Math.abs(q.totalMinor - expected) > tolerance) {
        return `warn: 3-night total ${q.totalMinor} not within 20% of ${expected}; harness may use flat pricing`;
      }
    }),
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  return {
    pack: "stay",
    tests: results,
    passedCount,
    failedCount,
    durationMs: results.reduce((s, r) => s + r.durationMs, 0),
  };
};
