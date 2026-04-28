import { describe, expect, it } from "vitest";
import { ItemBase } from "../../src/items/base";
import { BoardingPoint, Variant } from "../../src/items/support";

describe("ItemBase", () => {
  it("accepts minimal fields", () => {
    const b = ItemBase.parse({
      id: "itm_1",
      brandId: "brn_1",
      title: "T",
      priceMinor: 100,
      currency: "INR",
    });
    expect(b.id).toBe("itm_1");
  });

  it("rejects empty id / brandId / title", () => {
    expect(() =>
      ItemBase.parse({ id: "", brandId: "b", title: "t", priceMinor: 1, currency: "INR" }),
    ).toThrow();
  });

  it("caps images to 10", () => {
    const images = Array(11).fill("https://x.example/1.png");
    expect(() =>
      ItemBase.parse({
        id: "i",
        brandId: "b",
        title: "t",
        priceMinor: 1,
        currency: "INR",
        images,
      }),
    ).toThrow();
  });
});

describe("Variant", () => {
  it("requires sku + attributes map", () => {
    const v = Variant.parse({ sku: "SKU1", attributes: { size: "M", color: "red" } });
    expect(v.sku).toBe("SKU1");
  });
});

describe("BoardingPoint", () => {
  it("requires id + name + time + location", () => {
    const bp = BoardingPoint.parse({
      id: "bp1",
      name: "Majestic",
      time: "2026-05-01T20:00:00Z",
      lat: 12.97,
      lng: 77.57,
    });
    expect(bp.name).toBe("Majestic");
  });

  it("accepts IST offset times", () => {
    const bp = BoardingPoint.parse({
      id: "bp1",
      name: "Majestic",
      time: "2026-05-01T20:00:00+05:30",
      lat: 12.97,
      lng: 77.57,
    });
    expect(bp.time).toBe("2026-05-01T20:00:00+05:30");
  });
});
