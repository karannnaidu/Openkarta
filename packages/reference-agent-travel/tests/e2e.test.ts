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

describe("Halcyon Travel e2e", () => {
  const c = () => createClient({ baseUrl: url });

  it("discovers with supportedItemTypes=[flight,bus]", async () => {
    const m = (await c().discover()) as { agentId: string; supportedItemTypes: string[] };
    expect(m.agentId).toBe("halcyon-travel");
    expect(m.supportedItemTypes).toEqual(["flight", "bus"]);
  });

  it("flight booking: quote → checkout with passenger data", async () => {
    const cart = {
      cartId: "c_flight_e2e",
      lines: [
        {
          itemType: "flight",
          itemId: "f_blr_bom_6e123",
          passengers: [
            { firstName: "Asha", lastName: "Rao", gender: "F" },
            { firstName: "Karan", lastName: "Naidu", gender: "M" },
          ],
        },
      ],
    };
    const q = (await c().quote(cart)) as { quoteToken: string; itemType: string };
    expect(q.quoteToken).toBeTruthy();
    expect(q.itemType).toBe("flight");

    const order = (await c().checkout({
      cart,
      payment: { rail: "razorpay_routes", method: "card" },
      quoteToken: q.quoteToken,
    })) as {
      orderId: string;
      itemType: string;
      fulfilmentStatus: { itemType: string; state: string };
    };
    expect(order.orderId).toMatch(/^ord_/);
    expect(order.itemType).toBe("flight");
    expect(order.fulfilmentStatus.itemType).toBe("flight");
    // Flight state machine: 'confirmed' is the initial allowed state
    expect(order.fulfilmentStatus.state).toBe("confirmed");
  });

  it("bus booking: quote → checkout with passengers + boardingPointId + droppingPointId", async () => {
    const cart = {
      cartId: "c_bus_e2e",
      lines: [
        {
          itemType: "bus",
          itemId: "b_blr_pune_vrl",
          passengers: [{ firstName: "Maya", lastName: "Iyer", gender: "F" }],
          boardingPointId: "bp_blr_majestic",
          droppingPointId: "dp_pune_swargate",
        },
      ],
    };
    const q = (await c().quote(cart)) as { quoteToken: string; itemType: string };
    expect(q.quoteToken).toBeTruthy();
    expect(q.itemType).toBe("bus");

    const order = (await c().checkout({
      cart,
      payment: { rail: "razorpay_routes", method: "upi" },
      quoteToken: q.quoteToken,
    })) as {
      orderId: string;
      itemType: string;
      fulfilmentStatus: { itemType: string; state: string };
    };
    expect(order.orderId).toMatch(/^ord_/);
    expect(order.itemType).toBe("bus");
    expect(order.fulfilmentStatus.itemType).toBe("bus");
    expect(order.fulfilmentStatus.state).toBe("confirmed");
  });

  it("per-type fulfilmentStatus shape differs (flight vs bus discriminator)", async () => {
    // Flight order
    const flightCart = {
      cartId: "c_flight_disc",
      lines: [
        {
          itemType: "flight",
          itemId: "f_del_blr_ai501",
          passengers: [{ firstName: "Ravi", lastName: "Kumar" }],
        },
      ],
    };
    const fq = (await c().quote(flightCart)) as { quoteToken: string };
    const fOrder = (await c().checkout({
      cart: flightCart,
      payment: { rail: "stripe_connect", method: "card" },
      quoteToken: fq.quoteToken,
    })) as { fulfilmentStatus: { itemType: string; state: string } };

    // Bus order
    const busCart = {
      cartId: "c_bus_disc",
      lines: [
        {
          itemType: "bus",
          itemId: "b_hyd_blr_srs",
          passengers: [{ firstName: "Priya", lastName: "S" }],
          boardingPointId: "bp_hyd_lakdikapul",
          droppingPointId: "dp_blr_majestic",
        },
      ],
    };
    const bq = (await c().quote(busCart)) as { quoteToken: string };
    const bOrder = (await c().checkout({
      cart: busCart,
      payment: { rail: "razorpay_routes", method: "upi" },
      quoteToken: bq.quoteToken,
    })) as { fulfilmentStatus: { itemType: string; state: string } };

    // Discriminators differ
    expect(fOrder.fulfilmentStatus.itemType).toBe("flight");
    expect(bOrder.fulfilmentStatus.itemType).toBe("bus");
    expect(fOrder.fulfilmentStatus.itemType).not.toBe(bOrder.fulfilmentStatus.itemType);

    // Sanity: flight state machine includes 'flown' (bus does not); bus includes 'completed' (flight does not).
    // Both start at 'confirmed'.
    const flightStates = ["confirmed", "checked_in", "boarded", "flown", "cancelled", "refunded"];
    const busStates = ["confirmed", "boarded", "completed", "cancelled"];
    expect(flightStates).toContain(fOrder.fulfilmentStatus.state);
    expect(busStates).toContain(bOrder.fulfilmentStatus.state);
    expect(flightStates).toContain("flown");
    expect(busStates).not.toContain("flown");
    expect(busStates).toContain("completed");
    expect(flightStates).not.toContain("completed");
  });
});
