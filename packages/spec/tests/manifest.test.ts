import { describe, expect, it } from "vitest";
import { CapabilitiesManifest } from "../src/manifest";

const productManifest = {
  agentId: "halcyon-shop",
  displayName: "Halcyon Shop",
  protocolVersion: "0.1",
  tier: "http",
  baseUrl: "https://shop.halcyon.example.com",
  actions: ["discover", "search", "get", "quote", "checkout", "status", "cancel", "return"],
  supportedItemTypes: ["product"],
  paymentRails: ["razorpay_routes"],
  languages: ["en", "hi"],
  regions: [{ country: "IN" }],
  inventoryVolatility: "realtime",
  catalogSize: "medium",
  priceRange: { minMinor: 10000, maxMinor: 500000, currency: "INR" },
  productCapabilities: {
    categories: ["coffee", "tea"],
    serviceAreas: [{ country: "IN", pincodes: ["560001"] }],
    deliveryModes: ["instant", "same_day"],
    returnWindow: 7,
  },
};

describe("CapabilitiesManifest", () => {
  it("parses a product-only manifest", () => {
    const m = CapabilitiesManifest.parse(productManifest);
    expect(m.supportedItemTypes).toEqual(["product"]);
  });

  it("parses a multi-type manifest (stay + service)", () => {
    const m = CapabilitiesManifest.parse({
      ...productManifest,
      agentId: "halcyon-stays",
      supportedItemTypes: ["stay", "service"],
      productCapabilities: undefined,
      stayCapabilities: {
        locations: [{ country: "IN", city: "Goa" }],
        propertyTypes: ["villa", "homestay"],
        priceTierPerNight: { minMinor: 500000, maxMinor: 5000000, currency: "INR" },
      },
      serviceCapabilities: {
        serviceCategories: ["wellness.massage", "wellness.yoga"],
        serviceAreas: [{ country: "IN", city: "Goa" }],
        locationModes: ["at_customer", "at_provider", "venue"],
      },
    });
    expect(m.supportedItemTypes).toContain("service");
  });

  it("rejects manifest without any supportedItemTypes", () => {
    expect(() =>
      CapabilitiesManifest.parse({ ...productManifest, supportedItemTypes: [] }),
    ).toThrow();
  });
});
