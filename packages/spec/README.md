# @openkarta/spec

OpenKarta protocol schemas — Zod-first. Ships TypeScript types and runtime validators for:

- Five item types: `ProductItem`, `StayItem`, `FlightItem`, `BusItem`, `ServiceItem`, unified under `Item` (discriminated on `type`).
- Discriminated `SearchQuery` and `CartLine`; `Cart` enforces homogeneity via `.refine`.
- `Quote`, `Order`, `FulfilmentStatus` (per-type state machines), `Refund`.
- `CapabilitiesManifest` v0.2 with per-type capability blocks (`ProductCapabilities`, `StayCapabilities`, …).
- Closed-enum `ErrorCode` with deterministic HTTP status mapping (`errorStatusFor`).
- `UserTokenPayload` and `USER_TOKEN_HEADER` (`x-openkarta-user-token`) for human→agent delegation.

## Install

```bash
pnpm add @openkarta/spec zod
```

## Usage

```ts
import { Item, isProduct } from '@openkarta/spec';

const parsed = Item.parse(payload);
if (isProduct(parsed)) {
  // parsed is narrowed to ProductItem
}
```
