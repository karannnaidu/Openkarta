import { createClient } from "@openkarta/sdk-node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootAgent, loadFixtures } from "../src/agent";

let url = "";
const secret = "x".repeat(32);
const fx = loadFixtures("./fixtures");
beforeAll(async () => {
  url = await bootAgent(fx, 0, secret);
});
afterAll(async () => {
  /* fastify closed implicitly when vitest ends */
});

describe("Halcyon Stays & Spa e2e", () => {
  const c = () => createClient({ baseUrl: url });

  it("discovers with supportedItemTypes=[stay,service]", async () => {
    const m = (await c().discover()) as { agentId: string; supportedItemTypes: string[] };
    expect(m.agentId).toBe("halcyon-stays");
    expect(m.supportedItemTypes).toEqual(["stay", "service"]);
  });

  it("searches stays", async () => {
    const r = (await c().search({
      type: "stay",
      location: { country: "IN", city: "Anjuna" },
      checkIn: "2026-05-01",
      checkOut: "2026-05-04",
      guests: 2,
    })) as { items: Array<{ type: string }> };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.type === "stay")).toBe(true);
  });

  it("searches services", async () => {
    const r = (await c().search({
      type: "service",
      category: "wellness.massage",
      location: { country: "IN", city: "Anjuna" },
    })) as { items: Array<{ type: string }> };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.type === "service")).toBe(true);
  });

  it("stay booking: quote → checkout → status → cancel", async () => {
    const cart = {
      cartId: "c_stay_e2e",
      lines: [
        {
          itemType: "stay",
          itemId: "s_beach_villa",
          checkIn: "2026-05-01",
          checkOut: "2026-05-04",
          guests: 4,
        },
      ],
    };
    const q = (await c().quote(cart)) as { quoteToken: string; itemType: string };
    expect(q.quoteToken).toBeTruthy();
    expect(q.itemType).toBe("stay");

    const order = (await c().checkout({
      cart,
      payment: { rail: "razorpay_routes", method: "upi" },
      quoteToken: q.quoteToken,
    })) as { orderId: string; fulfilmentStatus: { itemType: string; state: string } };
    expect(order.orderId).toMatch(/^ord_/);
    expect(order.fulfilmentStatus.itemType).toBe("stay");
    expect(order.fulfilmentStatus.state).toBe("confirmed");

    const status = (await c().status(order.orderId)) as { fulfilmentStatus: { state: string } };
    expect(status.fulfilmentStatus.state).toBe("confirmed");

    const cancelled = (await c().cancel(order.orderId, "user_cancelled")) as {
      fulfilmentStatus: { state: string };
    };
    expect(cancelled.fulfilmentStatus.state).toBe("cancelled");
  });

  it("service booking: quote → checkout → status → cancel", async () => {
    const cart = {
      cartId: "c_service_e2e",
      lines: [
        {
          itemType: "service",
          itemId: "sv_60min_massage",
          slotStart: "2026-05-02T10:00:00.000Z",
          slotEnd: "2026-05-02T11:00:00.000Z",
          headcount: 1,
        },
      ],
    };
    const q = (await c().quote(cart)) as { quoteToken: string; itemType: string };
    expect(q.quoteToken).toBeTruthy();
    expect(q.itemType).toBe("service");

    const order = (await c().checkout({
      cart,
      payment: { rail: "razorpay_routes", method: "card" },
      quoteToken: q.quoteToken,
    })) as { orderId: string; fulfilmentStatus: { itemType: string; state: string } };
    expect(order.orderId).toMatch(/^ord_/);
    expect(order.fulfilmentStatus.itemType).toBe("service");
    expect(order.fulfilmentStatus.state).toBe("confirmed");

    const status = (await c().status(order.orderId)) as { fulfilmentStatus: { state: string } };
    expect(status.fulfilmentStatus.state).toBe("confirmed");

    const cancelled = (await c().cancel(order.orderId, "user_cancelled")) as {
      fulfilmentStatus: { state: string };
    };
    expect(cancelled.fulfilmentStatus.state).toBe("cancelled");
  });
});
