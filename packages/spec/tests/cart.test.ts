import { describe, expect, it } from "vitest";
import { Cart } from "../src/cart";

describe("Cart", () => {
  it("accepts homogeneous product cart", () => {
    const c = Cart.parse({
      cartId: "c1",
      lines: [
        { itemType: "product", itemId: "p1", quantity: 2 },
        { itemType: "product", itemId: "p2", quantity: 1, variantSku: "SKU-A" },
      ],
    });
    expect(c.lines).toHaveLength(2);
  });

  it("accepts homogeneous stay cart", () => {
    const c = Cart.parse({
      cartId: "c2",
      lines: [
        {
          itemType: "stay",
          itemId: "s1",
          checkIn: "2026-05-01",
          checkOut: "2026-05-03",
          guests: 2,
        },
      ],
    });
    expect(c.lines[0].itemType).toBe("stay");
  });

  it("rejects heterogeneous cart (product + stay)", () => {
    expect(() =>
      Cart.parse({
        cartId: "c3",
        lines: [
          { itemType: "product", itemId: "p1", quantity: 1 },
          {
            itemType: "stay",
            itemId: "s1",
            checkIn: "2026-05-01",
            checkOut: "2026-05-02",
            guests: 1,
          },
        ],
      }),
    ).toThrow(/cart_must_be_homogeneous/);
  });

  it("rejects empty cart", () => {
    expect(() => Cart.parse({ cartId: "c4", lines: [] })).toThrow();
  });
});
