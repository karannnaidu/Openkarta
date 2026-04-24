# Changelog

## 0.1.0 — 2026-05-?? (unreleased)

Initial public release of OpenKarta.

### Added

- `@openkarta/spec` with five item types, discriminated unions, homogeneous cart, CapabilitiesManifest v0.2, closed-enum errors, user-token delegation.
- `@openkarta/sdk-node` with Fastify server, typed client, HMAC-signed quote tokens, error helpers.
- Three reference agents: Halcyon Shop (product + quick-commerce), Halcyon Stays & Spa (stay + service), Halcyon Travel (flight + bus).
- `@openkarta/conformance-tests` with core pack (8) + five per-type packs (4+5+5+4+4 = 22). Auto-detects `supportedItemTypes` and emits a signed badge.
- `@openkarta/demo-cli` with product, stay, and flight end-to-end flows.
