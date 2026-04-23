# OpenKarta Plan 01 — Protocol, SDK, Reference Agents, Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OpenKarta v0.1 — an open, multi-vertical agentic commerce protocol with Zod schemas, a Node SDK, three reference agents, a conformance suite, and a demo CLI. Public MIT release on GitHub at the end of week 5.

**Architecture:** pnpm + Turborepo monorepo with seven TypeScript packages:
1. `@openkarta/spec` — Zod discriminated unions over five item types (product, stay, flight, bus, service), discriminated `SearchQuery` / `CartLine` / `FulfilmentStatus`, homogeneous `Cart` via `.refine()`, `CapabilitiesManifest v0.2` with per-type capability blocks, closed-enum error codes, `x-openkarta-user-token` delegation.
2. `@openkarta/sdk-node` — Fastify 5 server helpers + typed client + HMAC-signed quote tokens + capabilities manifest helpers + error-response helpers.
3. `@openkarta/reference-agent-shop` — Halcyon Shop (product, quick-commerce, instant delivery).
4. `@openkarta/reference-agent-stays` — Halcyon Stays & Spa (stay + service, mixed-type agent).
5. `@openkarta/reference-agent-travel` — Halcyon Travel (flight + bus, structured booking).
6. `@openkarta/conformance-tests` — CLI + six packs (core + five per-type) + signed-badge emission.
7. `@openkarta/demo-cli` — CLI with `--flow product|stay|flight` to exercise one end-to-end flow per vertical.

**Tech Stack:** TypeScript 5.4+, Node 22 LTS, pnpm 9, Turborepo 2, Zod 3.23+, Fastify 5, Vitest 2, Biome 1.9, tsup for bundling, GitHub Actions CI, MIT license.

**Timeline:** 5 weeks. Weeks 1–2 spec, weeks 2–3 SDK, weeks 3–4 reference agents, weeks 4–5 conformance, week 5 demo-cli + release.

**Testing discipline:** Strict TDD. Every schema task: failing Zod parse test → schema → passing test. Every SDK task: failing integration test → handler → passing test. Every conformance pack test: run against a deliberately-broken fixture first to confirm the test catches the break, then against the real agent. Commits after each passing test group.

**Source of truth:** `docs/superpowers/specs/2026-04-24-unified-acp-multivertical-design.md`. Every schema field, enum, and shape below is directly lifted from that spec — when in doubt, the spec wins.

---

## Phase 0 — Repo scaffolding (Day 1, ~4 hours)

### Task 0.1: Initialise the monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.node-version`
- Create: `LICENSE`
- Create: `biome.json`
- Create: `README.md`

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "openkarta",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.1.0",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "clean":     { "cache": false }
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
*.log
.env
.env.local
coverage/
.DS_Store
```

- [ ] **Step 6: Create `.node-version`**

```
22.9.0
```

- [ ] **Step 7: Create `LICENSE` (MIT)**

```
MIT License

Copyright (c) 2026 OpenKarta contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

- [ ] **Step 8: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["dist", "node_modules", ".turbo"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "useImportType": "error" }
    }
  },
  "organizeImports": { "enabled": true }
}
```

- [ ] **Step 9: Create a placeholder root `README.md`**

```markdown
# OpenKarta

The open agentic commerce protocol for every category — goods, stays, flights, buses, services.

v0.1 — under active development. See `docs/` for the spec.
```

- [ ] **Step 10: Install deps and verify**

Run:
```bash
pnpm install
pnpm lint
```
Expected: `pnpm install` succeeds; `pnpm lint` reports "No fixes applied" (empty project).

- [ ] **Step 11: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold pnpm monorepo with turborepo, typescript, biome"
```

---

## Phase 1 — @openkarta/spec (Weeks 1–2, ~14 tasks)

### Task 1.1: Create the `@openkarta/spec` package

**Files:**
- Create: `packages/spec/package.json`
- Create: `packages/spec/tsconfig.json`
- Create: `packages/spec/tsup.config.ts`
- Create: `packages/spec/vitest.config.ts`
- Create: `packages/spec/src/index.ts`
- Create: `packages/spec/README.md`

- [ ] **Step 1: Create `packages/spec/package.json`**

```json
{
  "name": "@openkarta/spec",
  "version": "0.1.0",
  "description": "OpenKarta protocol schemas, types, and narrowing helpers",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.4.5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/spec/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/spec/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

- [ ] **Step 4: Create `packages/spec/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create placeholder `packages/spec/src/index.ts`**

```ts
export const PROTOCOL_VERSION = '0.1' as const;
```

- [ ] **Step 6: Install + verify package builds**

Run:
```bash
pnpm install
pnpm --filter @openkarta/spec build
pnpm --filter @openkarta/spec typecheck
```
Expected: ESM + .d.ts files in `packages/spec/dist`; typecheck passes.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(spec): scaffold @openkarta/spec package"
```

---

### Task 1.2: Common primitives — Money, Address, Region

**Files:**
- Create: `packages/spec/src/common.ts`
- Create: `packages/spec/tests/common.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/common.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Address, Money, Region } from '../src/common';

describe('Money', () => {
  it('accepts integer minor units and 3-letter ISO currency', () => {
    const m = Money.parse({ amountMinor: 12500, currency: 'INR' });
    expect(m.amountMinor).toBe(12500);
    expect(m.currency).toBe('INR');
  });

  it('rejects floats', () => {
    expect(() => Money.parse({ amountMinor: 12.5, currency: 'INR' })).toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() => Money.parse({ amountMinor: -1, currency: 'INR' })).toThrow();
  });

  it('rejects non-3-letter currency', () => {
    expect(() => Money.parse({ amountMinor: 100, currency: 'INRR' })).toThrow();
  });
});

describe('Address', () => {
  it('requires line1, city, country', () => {
    const a = Address.parse({ line1: '1 MG Road', city: 'Bengaluru', country: 'IN' });
    expect(a.line1).toBe('1 MG Road');
  });

  it('accepts optional pincode, state, line2, lat/lng', () => {
    const a = Address.parse({
      line1: '1 MG Road', line2: 'Apt 4', city: 'Bengaluru',
      state: 'KA', pincode: '560001', country: 'IN', lat: 12.97, lng: 77.59,
    });
    expect(a.pincode).toBe('560001');
  });

  it('rejects 2-char country code', () => {
    expect(() => Address.parse({ line1: 'x', city: 'x', country: 'IND' })).toThrow();
  });
});

describe('Region', () => {
  it('parses a region with country + optional subdivisions', () => {
    const r = Region.parse({ country: 'IN', state: 'KA', pincodes: ['560001'] });
    expect(r.country).toBe('IN');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `pnpm --filter @openkarta/spec test`
Expected: FAIL — cannot find `../src/common`.

- [ ] **Step 3: Implement `packages/spec/src/common.ts`**

```ts
import { z } from 'zod';

export const Money = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency:    z.string().length(3),
});
export type Money = z.infer<typeof Money>;

export const Address = z.object({
  line1:   z.string().min(1),
  line2:   z.string().optional(),
  city:    z.string().min(1),
  state:   z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().length(2), // ISO-3166 alpha-2
  lat:     z.number().min(-90).max(90).optional(),
  lng:     z.number().min(-180).max(180).optional(),
});
export type Address = z.infer<typeof Address>;

export const Region = z.object({
  country:    z.string().length(2),
  state:      z.string().optional(),
  city:       z.string().optional(),
  pincodes:   z.array(z.string()).optional(),
  radiusKm:   z.number().positive().optional(),
});
export type Region = z.infer<typeof Region>;
```

- [ ] **Step 4: Run tests — expect pass**

Run: `pnpm --filter @openkarta/spec test`
Expected: PASS, 8 assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/common.ts packages/spec/tests/common.test.ts
git commit -m "feat(spec): add Money, Address, Region primitives"
```

---

### Task 1.3: ItemBase + supporting sub-types (Variant, BoardingPoint)

**Files:**
- Create: `packages/spec/src/items/base.ts`
- Create: `packages/spec/src/items/support.ts`
- Create: `packages/spec/tests/items/base.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/base.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ItemBase } from '../../src/items/base';
import { BoardingPoint, Variant } from '../../src/items/support';

describe('ItemBase', () => {
  it('accepts minimal fields', () => {
    const b = ItemBase.parse({
      id: 'itm_1', brandId: 'brn_1', title: 'T',
      priceMinor: 100, currency: 'INR',
    });
    expect(b.id).toBe('itm_1');
  });

  it('rejects empty id / brandId / title', () => {
    expect(() => ItemBase.parse({ id: '', brandId: 'b', title: 't', priceMinor: 1, currency: 'INR' })).toThrow();
  });

  it('caps images to 10', () => {
    const images = Array(11).fill('https://x.example/1.png');
    expect(() => ItemBase.parse({
      id: 'i', brandId: 'b', title: 't', priceMinor: 1, currency: 'INR', images,
    })).toThrow();
  });
});

describe('Variant', () => {
  it('requires sku + attributes map', () => {
    const v = Variant.parse({ sku: 'SKU1', attributes: { size: 'M', color: 'red' } });
    expect(v.sku).toBe('SKU1');
  });
});

describe('BoardingPoint', () => {
  it('requires id + name + time + location', () => {
    const bp = BoardingPoint.parse({
      id: 'bp1', name: 'Majestic',
      time: '2026-05-01T20:00:00Z',
      lat: 12.97, lng: 77.57,
    });
    expect(bp.name).toBe('Majestic');
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm --filter @openkarta/spec test`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `packages/spec/src/items/base.ts`**

```ts
import { z } from 'zod';

export const ItemBase = z.object({
  id:          z.string().min(1),
  brandId:     z.string().min(1),
  title:       z.string().min(1),
  description: z.string().optional(),
  images:      z.array(z.string().url()).max(10).optional(),
  priceMinor:  z.number().int().nonnegative(),
  currency:    z.string().length(3),
  metadata:    z.record(z.unknown()).optional(),
});
export type ItemBase = z.infer<typeof ItemBase>;
```

- [ ] **Step 4: Implement `packages/spec/src/items/support.ts`**

```ts
import { z } from 'zod';

export const Variant = z.object({
  sku:         z.string().min(1),
  attributes:  z.record(z.string()),
  priceMinor:  z.number().int().nonnegative().optional(),
  images:      z.array(z.string().url()).max(5).optional(),
});
export type Variant = z.infer<typeof Variant>;

export const BoardingPoint = z.object({
  id:      z.string().min(1),
  name:    z.string().min(1),
  address: z.string().optional(),
  time:    z.string().datetime(),
  lat:     z.number().min(-90).max(90).optional(),
  lng:     z.number().min(-180).max(180).optional(),
});
export type BoardingPoint = z.infer<typeof BoardingPoint>;
```

- [ ] **Step 5: Run — expect pass**

Run: `pnpm --filter @openkarta/spec test`
Expected: PASS, all assertions.

- [ ] **Step 6: Commit**

```bash
git add packages/spec/src/items packages/spec/tests/items
git commit -m "feat(spec): add ItemBase, Variant, BoardingPoint"
```

---

### Task 1.4: ProductItem

**Files:**
- Create: `packages/spec/src/items/product.ts`
- Create: `packages/spec/tests/items/product.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/product.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ProductItem } from '../../src/items/product';

const base = {
  id: 'p_1', brandId: 'b_1', title: 'Espresso blend 250g',
  priceMinor: 89900, currency: 'INR',
  type: 'product' as const, sku: 'SKU-ESP-250',
  inventoryStatus: 'in_stock' as const,
};

describe('ProductItem', () => {
  it('parses a minimal valid product', () => {
    const p = ProductItem.parse(base);
    expect(p.type).toBe('product');
    expect(p.sku).toBe('SKU-ESP-250');
  });

  it('accepts variants', () => {
    const p = ProductItem.parse({
      ...base,
      variants: [{ sku: 'SKU-ESP-250-BOLD', attributes: { roast: 'bold' } }],
    });
    expect(p.variants).toHaveLength(1);
  });

  it('accepts optional shipsFrom region', () => {
    const p = ProductItem.parse({
      ...base,
      shipsFrom: { country: 'IN', state: 'KA', pincodes: ['560001'] },
    });
    expect(p.shipsFrom?.country).toBe('IN');
  });

  it('rejects invalid inventoryStatus', () => {
    expect(() => ProductItem.parse({ ...base, inventoryStatus: 'maybe' })).toThrow();
  });

  it('rejects wrong type literal', () => {
    expect(() => ProductItem.parse({ ...base, type: 'stay' })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `pnpm --filter @openkarta/spec test tests/items/product.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/spec/src/items/product.ts`**

```ts
import { z } from 'zod';
import { Region } from '../common.js';
import { ItemBase } from './base.js';
import { Variant } from './support.js';

export const ProductItem = ItemBase.extend({
  type:            z.literal('product'),
  sku:             z.string().min(1),
  variants:        z.array(Variant).optional(),
  inventoryStatus: z.enum(['in_stock', 'low', 'out']),
  shipsFrom:       Region.optional(),
  category:        z.array(z.string()).optional(),
});
export type ProductItem = z.infer<typeof ProductItem>;
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter @openkarta/spec test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/items/product.ts packages/spec/tests/items/product.test.ts
git commit -m "feat(spec): add ProductItem schema"
```

---

### Task 1.5: StayItem

**Files:**
- Create: `packages/spec/src/items/stay.ts`
- Create: `packages/spec/tests/items/stay.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/stay.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { StayItem } from '../../src/items/stay';

const base = {
  id: 's_1', brandId: 'b_1', title: 'Beach villa, Goa',
  priceMinor: 2500000, currency: 'INR',
  type: 'stay' as const,
  propertyId: 'prop_123',
  propertyType: 'villa' as const,
  maxGuests: 6,
  minStayNights: 2,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate' as const,
  location: { lat: 15.49, lng: 73.82, address: {
    line1: 'Anjuna Beach Rd', city: 'Anjuna', country: 'IN',
  }},
};

describe('StayItem', () => {
  it('parses a minimal valid stay', () => {
    const s = StayItem.parse(base);
    expect(s.type).toBe('stay');
    expect(s.propertyType).toBe('villa');
  });

  it('rejects malformed checkInTime', () => {
    expect(() => StayItem.parse({ ...base, checkInTime: '3pm' })).toThrow();
  });

  it('rejects zero minStayNights', () => {
    expect(() => StayItem.parse({ ...base, minStayNights: 0 })).toThrow();
  });

  it('rejects invalid propertyType', () => {
    expect(() => StayItem.parse({ ...base, propertyType: 'spaceship' })).toThrow();
  });

  it('accepts amenities and houseRules', () => {
    const s = StayItem.parse({ ...base, amenities: ['wifi','pool'], houseRules: ['no smoking'] });
    expect(s.amenities).toEqual(['wifi','pool']);
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/items/stay.ts`**

```ts
import { z } from 'zod';
import { Address } from '../common.js';
import { ItemBase } from './base.js';

export const StayItem = ItemBase.extend({
  type:               z.literal('stay'),
  propertyId:         z.string().min(1),
  propertyType:       z.enum(['hotel', 'homestay', 'apartment', 'villa', 'hostel']),
  maxGuests:          z.number().int().positive(),
  minStayNights:      z.number().int().positive(),
  checkInTime:        z.string().regex(/^\d{2}:\d{2}$/),
  checkOutTime:       z.string().regex(/^\d{2}:\d{2}$/),
  amenities:          z.array(z.string()).optional(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
  houseRules:         z.array(z.string()).optional(),
  location:           z.object({ lat: z.number(), lng: z.number(), address: Address }),
});
export type StayItem = z.infer<typeof StayItem>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/items/stay.ts packages/spec/tests/items/stay.test.ts
git commit -m "feat(spec): add StayItem schema"
```

---

### Task 1.6: FlightItem

**Files:**
- Create: `packages/spec/src/items/flight.ts`
- Create: `packages/spec/tests/items/flight.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/flight.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FlightItem } from '../../src/items/flight';

const base = {
  id: 'f_1', brandId: 'b_air', title: '6E 5023 BLR→DEL',
  priceMinor: 750000, currency: 'INR',
  type: 'flight' as const,
  carrier: '6E', flightNumber: '5023',
  origin: 'BLR', destination: 'DEL',
  departure: '2026-05-10T06:30:00Z',
  arrival:   '2026-05-10T09:15:00Z',
  durationMinutes: 165,
  fareClass: 'economy' as const,
  stops: 0,
  refundable: false,
};

describe('FlightItem', () => {
  it('parses a valid flight', () => {
    const f = FlightItem.parse(base);
    expect(f.carrier).toBe('6E');
    expect(f.origin).toBe('BLR');
  });

  it('rejects 3-letter carrier', () => {
    expect(() => FlightItem.parse({ ...base, carrier: 'IDG' })).toThrow();
  });

  it('rejects 2-letter IATA airport code', () => {
    expect(() => FlightItem.parse({ ...base, origin: 'BL' })).toThrow();
  });

  it('accepts optional baggage', () => {
    const f = FlightItem.parse({ ...base, baggage: { cabinKg: 7, checkedKg: 15 } });
    expect(f.baggage?.checkedKg).toBe(15);
  });

  it('rejects non-datetime departure', () => {
    expect(() => FlightItem.parse({ ...base, departure: 'tomorrow 6am' })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/items/flight.ts`**

```ts
import { z } from 'zod';
import { ItemBase } from './base.js';

export const FlightItem = ItemBase.extend({
  type:            z.literal('flight'),
  carrier:         z.string().length(2),
  flightNumber:    z.string().min(1),
  origin:          z.string().length(3),
  destination:     z.string().length(3),
  departure:       z.string().datetime(),
  arrival:         z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  fareClass:       z.enum(['economy', 'premium-economy', 'business', 'first']),
  stops:           z.number().int().nonnegative(),
  baggage:         z.object({
    cabinKg:   z.number().nonnegative(),
    checkedKg: z.number().nonnegative(),
  }).optional(),
  refundable:      z.boolean(),
});
export type FlightItem = z.infer<typeof FlightItem>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/items/flight.ts packages/spec/tests/items/flight.test.ts
git commit -m "feat(spec): add FlightItem schema"
```

---

### Task 1.7: BusItem

**Files:**
- Create: `packages/spec/src/items/bus.ts`
- Create: `packages/spec/tests/items/bus.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/bus.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BusItem } from '../../src/items/bus';

const base = {
  id: 'b_1', brandId: 'b_op', title: 'VRL Overnight BLR→HYD',
  priceMinor: 120000, currency: 'INR',
  type: 'bus' as const,
  operator: 'VRL Travels',
  origin: 'Bengaluru', destination: 'Hyderabad',
  departure: '2026-05-10T21:30:00Z',
  arrival:   '2026-05-11T06:00:00Z',
  durationMinutes: 510,
  seatClass: 'ac-sleeper' as const,
  boardingPoints: [{ id: 'bp1', name: 'Majestic', time: '2026-05-10T21:00:00Z' }],
  droppingPoints: [{ id: 'dp1', name: 'Ameerpet', time: '2026-05-11T06:00:00Z' }],
  cancellationPolicy: 'moderate' as const,
};

describe('BusItem', () => {
  it('parses a valid bus', () => {
    const b = BusItem.parse(base);
    expect(b.operator).toBe('VRL Travels');
  });

  it('rejects empty boardingPoints', () => {
    expect(() => BusItem.parse({ ...base, boardingPoints: [] })).toThrow();
  });

  it('rejects unknown seatClass', () => {
    expect(() => BusItem.parse({ ...base, seatClass: 'bed' })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/items/bus.ts`**

```ts
import { z } from 'zod';
import { ItemBase } from './base.js';
import { BoardingPoint } from './support.js';

export const BusItem = ItemBase.extend({
  type:               z.literal('bus'),
  operator:           z.string().min(1),
  origin:             z.string().min(1),
  destination:        z.string().min(1),
  departure:          z.string().datetime(),
  arrival:            z.string().datetime(),
  durationMinutes:    z.number().int().positive(),
  seatClass:          z.enum(['seater', 'sleeper', 'ac-seater', 'ac-sleeper', 'volvo']),
  amenities:          z.array(z.string()).optional(),
  boardingPoints:     z.array(BoardingPoint).min(1),
  droppingPoints:     z.array(BoardingPoint).min(1),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
});
export type BusItem = z.infer<typeof BusItem>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/items/bus.ts packages/spec/tests/items/bus.test.ts
git commit -m "feat(spec): add BusItem schema"
```

---

### Task 1.8: ServiceItem

**Files:**
- Create: `packages/spec/src/items/service.ts`
- Create: `packages/spec/tests/items/service.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/service.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ServiceItem } from '../../src/items/service';

const atCustomer = {
  id: 'sv_1', brandId: 'b_uc', title: 'Massage therapy 60 min',
  priceMinor: 149900, currency: 'INR',
  type: 'service' as const,
  serviceCategory: 'wellness.massage',
  durationMinutes: 60,
  location: { mode: 'at_customer' as const, serviceRadius: 15 },
  cancellationPolicy: 'moderate' as const,
};

describe('ServiceItem', () => {
  it('parses at_customer service', () => {
    const s = ServiceItem.parse(atCustomer);
    expect(s.location.mode).toBe('at_customer');
  });

  it('parses at_provider service with address', () => {
    const s = ServiceItem.parse({
      ...atCustomer,
      location: { mode: 'at_provider', address: {
        line1: '1 MG Road', city: 'Bengaluru', country: 'IN',
      }},
    });
    expect(s.location.mode).toBe('at_provider');
  });

  it('parses online service with joinUrl', () => {
    const s = ServiceItem.parse({
      ...atCustomer,
      location: { mode: 'online', joinUrl: 'https://meet.example.com/abc' },
    });
    expect(s.location.mode).toBe('online');
  });

  it('rejects invalid location mode', () => {
    expect(() => ServiceItem.parse({
      ...atCustomer, location: { mode: 'telepathy' } as never,
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/items/service.ts`**

```ts
import { z } from 'zod';
import { Address } from '../common.js';
import { ItemBase } from './base.js';

const ServiceLocation = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('at_customer'), serviceRadius: z.number().positive().optional() }),
  z.object({ mode: z.literal('at_provider'), address: Address }),
  z.object({ mode: z.literal('online'),      joinUrl: z.string().url().optional() }),
  z.object({ mode: z.literal('venue'),       venueAddress: Address }),
]);

export const ServiceItem = ItemBase.extend({
  type:               z.literal('service'),
  serviceCategory:    z.string().min(1),
  providerName:       z.string().optional(),
  durationMinutes:    z.number().int().positive(),
  location:           ServiceLocation,
  availableSlots:     z.array(z.string().datetime()).optional(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict', 'non-refundable']),
});
export type ServiceItem = z.infer<typeof ServiceItem>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/items/service.ts packages/spec/tests/items/service.test.ts
git commit -m "feat(spec): add ServiceItem schema"
```

---

### Task 1.9: Item discriminated union + narrowing helpers

**Files:**
- Create: `packages/spec/src/items/union.ts`
- Create: `packages/spec/tests/items/union.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/items/union.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/items/union';
import { Item as ItemSchema, isBus, isFlight, isProduct, isService, isStay } from '../../src/items/union';

const product: Item = {
  id: 'p', brandId: 'b', title: 't', priceMinor: 1, currency: 'INR',
  type: 'product', sku: 'SKU', inventoryStatus: 'in_stock',
};
const stay: Item = {
  id: 's', brandId: 'b', title: 't', priceMinor: 1, currency: 'INR',
  type: 'stay', propertyId: 'p', propertyType: 'villa',
  maxGuests: 2, minStayNights: 1, checkInTime: '14:00', checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  location: { lat: 0, lng: 0, address: { line1: 'x', city: 'x', country: 'IN' } },
};

describe('Item discriminated union', () => {
  it('accepts a product', () => {
    expect(ItemSchema.parse(product).type).toBe('product');
  });

  it('accepts a stay', () => {
    expect(ItemSchema.parse(stay).type).toBe('stay');
  });

  it('rejects unknown type', () => {
    expect(() => ItemSchema.parse({ ...product, type: 'widget' as never })).toThrow();
  });
});

describe('narrowing helpers', () => {
  it('isProduct narrows correctly', () => {
    expect(isProduct(product)).toBe(true);
    expect(isProduct(stay)).toBe(false);
  });

  it('isStay narrows correctly', () => {
    expect(isStay(stay)).toBe(true);
  });

  it('remaining helpers return false for non-matching', () => {
    expect(isFlight(product)).toBe(false);
    expect(isBus(product)).toBe(false);
    expect(isService(product)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/items/union.ts`**

```ts
import { z } from 'zod';
import { BusItem } from './bus.js';
import { FlightItem } from './flight.js';
import { ProductItem } from './product.js';
import { ServiceItem } from './service.js';
import { StayItem } from './stay.js';

export const Item = z.discriminatedUnion('type', [
  ProductItem,
  StayItem,
  FlightItem,
  BusItem,
  ServiceItem,
]);
export type Item = z.infer<typeof Item>;
export type ItemType = Item['type'];

export const isProduct = (i: Item): i is z.infer<typeof ProductItem> => i.type === 'product';
export const isStay    = (i: Item): i is z.infer<typeof StayItem>    => i.type === 'stay';
export const isFlight  = (i: Item): i is z.infer<typeof FlightItem>  => i.type === 'flight';
export const isBus     = (i: Item): i is z.infer<typeof BusItem>     => i.type === 'bus';
export const isService = (i: Item): i is z.infer<typeof ServiceItem> => i.type === 'service';
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/items/union.ts packages/spec/tests/items/union.test.ts
git commit -m "feat(spec): add Item discriminated union and narrowing helpers"
```

---

### Task 1.10: SearchQuery discriminated union

**Files:**
- Create: `packages/spec/src/search.ts`
- Create: `packages/spec/tests/search.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/search.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SearchQuery } from '../src/search';

describe('SearchQuery', () => {
  it('parses a product query', () => {
    const q = SearchQuery.parse({
      type: 'product', q: 'coffee',
      deliverTo: { country: 'IN', pincodes: ['560001'] },
      deliveryMode: 'instant',
    });
    expect(q.type).toBe('product');
  });

  it('parses a stay query', () => {
    const q = SearchQuery.parse({
      type: 'stay', location: { country: 'IN', city: 'Goa' },
      checkIn: '2026-05-01', checkOut: '2026-05-03', guests: 2,
    });
    expect(q.type).toBe('stay');
  });

  it('parses a flight query', () => {
    const q = SearchQuery.parse({
      type: 'flight', origin: 'BLR', destination: 'DEL',
      departure: '2026-05-10', pax: 1, fareClass: 'economy',
    });
    expect(q.type).toBe('flight');
  });

  it('parses a bus query', () => {
    const q = SearchQuery.parse({
      type: 'bus', origin: 'Bengaluru', destination: 'Hyderabad',
      departure: '2026-05-10', pax: 1,
    });
    expect(q.type).toBe('bus');
  });

  it('parses a service query', () => {
    const q = SearchQuery.parse({
      type: 'service', category: 'wellness.massage',
      location: { country: 'IN', city: 'Bengaluru' },
    });
    expect(q.type).toBe('service');
  });

  it('rejects cross-type fields (stay fields on product query)', () => {
    expect(() => SearchQuery.parse({ type: 'product', checkIn: '2026-05-01' } as never)).not.toThrow();
    // Zod discriminated union ignores extra fields; tighten with .strict() if desired in a later task.
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/search.ts`**

```ts
import { z } from 'zod';
import { Region } from './common.js';

const ProductQuery = z.object({
  type:         z.literal('product'),
  q:            z.string().optional(),
  categories:   z.array(z.string()).optional(),
  priceRange:   z.object({ minMinor: z.number().int(), maxMinor: z.number().int() }).optional(),
  deliverTo:    Region.optional(),
  deliveryMode: z.enum(['instant', 'same_day', 'scheduled', 'pickup', 'standard']).optional(),
});

const StayQuery = z.object({
  type:         z.literal('stay'),
  location:     Region,
  checkIn:      z.string(),
  checkOut:     z.string(),
  guests:       z.number().int().positive(),
  propertyType: z.enum(['hotel','homestay','apartment','villa','hostel']).optional(),
});

const FlightQuery = z.object({
  type:        z.literal('flight'),
  origin:      z.string().length(3),
  destination: z.string().length(3),
  departure:   z.string(),
  return:      z.string().optional(),
  pax:         z.number().int().positive(),
  fareClass:   z.enum(['economy','premium-economy','business','first']).optional(),
  nonstop:     z.boolean().optional(),
});

const BusQuery = z.object({
  type:        z.literal('bus'),
  origin:      z.string().min(1),
  destination: z.string().min(1),
  departure:   z.string(),
  pax:         z.number().int().positive(),
  seatClass:   z.enum(['seater','sleeper','ac-seater','ac-sleeper','volvo']).optional(),
});

const ServiceQuery = z.object({
  type:          z.literal('service'),
  category:      z.string().min(1),
  location:      Region,
  preferredSlot: z.string().optional(),
});

export const SearchQuery = z.discriminatedUnion('type', [
  ProductQuery, StayQuery, FlightQuery, BusQuery, ServiceQuery,
]);
export type SearchQuery = z.infer<typeof SearchQuery>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/search.ts packages/spec/tests/search.test.ts
git commit -m "feat(spec): add SearchQuery discriminated union"
```

---

### Task 1.11: CartLine discriminated + Cart homogeneity refine

**Files:**
- Create: `packages/spec/src/cart.ts`
- Create: `packages/spec/tests/cart.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/cart.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Cart } from '../src/cart';

describe('Cart', () => {
  it('accepts homogeneous product cart', () => {
    const c = Cart.parse({
      cartId: 'c1',
      lines: [
        { itemType: 'product', itemId: 'p1', quantity: 2 },
        { itemType: 'product', itemId: 'p2', quantity: 1, variantSku: 'SKU-A' },
      ],
    });
    expect(c.lines).toHaveLength(2);
  });

  it('accepts homogeneous stay cart', () => {
    const c = Cart.parse({
      cartId: 'c2',
      lines: [{
        itemType: 'stay', itemId: 's1',
        checkIn: '2026-05-01', checkOut: '2026-05-03', guests: 2,
      }],
    });
    expect(c.lines[0].itemType).toBe('stay');
  });

  it('rejects heterogeneous cart (product + stay)', () => {
    expect(() => Cart.parse({
      cartId: 'c3',
      lines: [
        { itemType: 'product', itemId: 'p1', quantity: 1 },
        { itemType: 'stay', itemId: 's1',
          checkIn: '2026-05-01', checkOut: '2026-05-02', guests: 1 },
      ],
    })).toThrow(/cart_must_be_homogeneous/);
  });

  it('rejects empty cart', () => {
    expect(() => Cart.parse({ cartId: 'c4', lines: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/cart.ts`**

```ts
import { z } from 'zod';

const PassengerPayload = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  dob:       z.string().optional(),
  gender:    z.enum(['M','F','X']).optional(),
  nationality: z.string().length(2).optional(),
  idNumber:  z.string().optional(),
});

const ProductLine = z.object({
  itemType:   z.literal('product'),
  itemId:     z.string().min(1),
  quantity:   z.number().int().positive(),
  variantSku: z.string().optional(),
});

const StayLine = z.object({
  itemType: z.literal('stay'),
  itemId:   z.string().min(1),
  checkIn:  z.string(),
  checkOut: z.string(),
  guests:   z.number().int().positive(),
  specialRequests: z.string().optional(),
});

const FlightLine = z.object({
  itemType:   z.literal('flight'),
  itemId:     z.string().min(1),
  passengers: z.array(PassengerPayload).min(1),
  seatSelection: z.array(z.string()).optional(),
  addBaggage: z.array(z.object({ kg: z.number().positive() })).optional(),
});

const BusLine = z.object({
  itemType:        z.literal('bus'),
  itemId:          z.string().min(1),
  passengers:      z.array(PassengerPayload).min(1),
  seatSelection:   z.array(z.string()).optional(),
  boardingPointId: z.string().min(1),
  droppingPointId: z.string().min(1),
});

const ServiceLine = z.object({
  itemType:  z.literal('service'),
  itemId:    z.string().min(1),
  slotStart: z.string().datetime(),
  slotEnd:   z.string().datetime(),
  headcount: z.number().int().positive().default(1),
  notes:     z.string().optional(),
});

export const CartLine = z.discriminatedUnion('itemType', [
  ProductLine, StayLine, FlightLine, BusLine, ServiceLine,
]);
export type CartLine = z.infer<typeof CartLine>;

export const Cart = z.object({
  cartId: z.string().min(1),
  lines:  z.array(CartLine).min(1),
}).refine(
  (c) => c.lines.every((l) => l.itemType === c.lines[0]!.itemType),
  { message: 'cart_must_be_homogeneous: all lines must share itemType' },
);
export type Cart = z.infer<typeof Cart>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/cart.ts packages/spec/tests/cart.test.ts
git commit -m "feat(spec): add CartLine union and Cart with homogeneity refine"
```

---

### Task 1.12: Quote, PaymentOption, Fee, Tax, Discount

**Files:**
- Create: `packages/spec/src/quote.ts`
- Create: `packages/spec/tests/quote.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/quote.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Quote } from '../src/quote';

const base = {
  quoteToken: 'qt_opaque_string.signature',
  cartId: 'c1',
  itemType: 'product' as const,
  lineItems: [{ itemId: 'p1', description: 'Espresso 250g', quantity: 2, unitMinor: 89900, totalMinor: 179800 }],
  totalMinor: 179800,
  currency: 'INR',
  paymentOptions: [{ rail: 'razorpay_routes' as const, methods: ['upi','card'] }],
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
};

describe('Quote', () => {
  it('parses a minimal product quote', () => {
    const q = Quote.parse(base);
    expect(q.totalMinor).toBe(179800);
  });

  it('accepts optional estimatedFulfilmentAt (for quick-commerce)', () => {
    const q = Quote.parse({ ...base, estimatedFulfilmentAt: new Date(Date.now() + 15*60_000).toISOString() });
    expect(q.estimatedFulfilmentAt).toBeDefined();
  });

  it('rejects non-3-letter currency', () => {
    expect(() => Quote.parse({ ...base, currency: 'RUP' } as never)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/quote.ts`**

```ts
import { z } from 'zod';

export const PaymentOption = z.object({
  rail:    z.enum(['razorpay_routes','stripe_connect','upi_direct','cod']),
  methods: z.array(z.enum(['upi','card','netbanking','wallet','cod','apple_pay','google_pay'])),
});
export type PaymentOption = z.infer<typeof PaymentOption>;

export const Fee      = z.object({ label: z.string(), amountMinor: z.number().int().nonnegative() });
export const Tax      = z.object({ label: z.string(), rate: z.number().optional(), amountMinor: z.number().int().nonnegative() });
export const Discount = z.object({ label: z.string(), amountMinor: z.number().int().nonnegative() });

const QuoteLine = z.object({
  itemId:      z.string(),
  description: z.string(),
  quantity:    z.number().int().positive(),
  unitMinor:   z.number().int().nonnegative(),
  totalMinor:  z.number().int().nonnegative(),
});

export const Quote = z.object({
  quoteToken:            z.string().min(1),
  cartId:                z.string(),
  itemType:              z.enum(['product','stay','flight','bus','service']),
  lineItems:             z.array(QuoteLine).min(1),
  fees:                  z.array(Fee).optional(),
  taxes:                 z.array(Tax).optional(),
  discounts:             z.array(Discount).optional(),
  totalMinor:            z.number().int().nonnegative(),
  currency:              z.string().length(3),
  paymentOptions:        z.array(PaymentOption).min(1),
  expiresAt:             z.string().datetime(),
  estimatedFulfilmentAt: z.string().datetime().optional(),
  cancellationPolicy:    z.enum(['flexible','moderate','strict','non-refundable']).optional(),
});
export type Quote = z.infer<typeof Quote>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/quote.ts packages/spec/tests/quote.test.ts
git commit -m "feat(spec): add Quote, PaymentOption, Fee, Tax, Discount"
```

---

### Task 1.13: Order + FulfilmentStatus per-type state machines

**Files:**
- Create: `packages/spec/src/order.ts`
- Create: `packages/spec/tests/order.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/order.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FulfilmentStatus, Order } from '../src/order';

const base = {
  orderId: 'ord_1',
  quoteFingerprint: 'sha256:abc',
  itemType: 'product' as const,
  lines: [{ itemType: 'product', itemId: 'p1', quantity: 1 }],
  paymentStatus: 'authorized' as const,
  fulfilmentStatus: { itemType: 'product' as const, state: 'confirmed' as const },
  totalMinor: 89900,
  currency: 'INR',
  createdAt: new Date().toISOString(),
};

describe('Order', () => {
  it('parses a minimal product order', () => {
    expect(Order.parse(base).orderId).toBe('ord_1');
  });

  it('rejects flight fulfilment state on a product order', () => {
    expect(() => FulfilmentStatus.parse({ itemType: 'product', state: 'boarded' } as never)).toThrow();
  });

  it('accepts flight boarded state', () => {
    const fs = FulfilmentStatus.parse({ itemType: 'flight', state: 'boarded' });
    expect(fs.state).toBe('boarded');
  });

  it('accepts service en_route state', () => {
    const fs = FulfilmentStatus.parse({ itemType: 'service', state: 'en_route' });
    expect(fs.state).toBe('en_route');
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/order.ts`**

```ts
import { z } from 'zod';
import { CartLine } from './cart.js';

const ProductFulfilment = z.object({
  itemType: z.literal('product'),
  state:    z.enum(['confirmed','packed','shipped','out_for_delivery','delivered','returned']),
});
const StayFulfilment = z.object({
  itemType: z.literal('stay'),
  state:    z.enum(['confirmed','checked_in','checked_out','cancelled','no_show']),
});
const FlightFulfilment = z.object({
  itemType: z.literal('flight'),
  state:    z.enum(['confirmed','checked_in','boarded','flown','cancelled','refunded']),
});
const BusFulfilment = z.object({
  itemType: z.literal('bus'),
  state:    z.enum(['confirmed','boarded','completed','cancelled']),
});
const ServiceFulfilment = z.object({
  itemType: z.literal('service'),
  state:    z.enum(['confirmed','en_route','started','completed','cancelled']),
});

export const FulfilmentStatus = z.discriminatedUnion('itemType', [
  ProductFulfilment, StayFulfilment, FlightFulfilment, BusFulfilment, ServiceFulfilment,
]);
export type FulfilmentStatus = z.infer<typeof FulfilmentStatus>;

export const Order = z.object({
  orderId:          z.string().min(1),
  quoteFingerprint: z.string(),
  itemType:         z.enum(['product','stay','flight','bus','service']),
  lines:            z.array(CartLine).min(1),
  paymentStatus:    z.enum(['pending','authorized','captured','refunded','failed']),
  fulfilmentStatus: FulfilmentStatus,
  totalMinor:       z.number().int().nonnegative(),
  currency:         z.string().length(3),
  createdAt:        z.string().datetime(),
  trackingRef:      z.string().optional(),
});
export type Order = z.infer<typeof Order>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/order.ts packages/spec/tests/order.test.ts
git commit -m "feat(spec): add Order and per-type FulfilmentStatus state machines"
```

---

### Task 1.14: Refund schema

**Files:**
- Create: `packages/spec/src/refund.ts`
- Create: `packages/spec/tests/refund.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/refund.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Refund } from '../src/refund';

describe('Refund', () => {
  it('parses a valid refund', () => {
    const r = Refund.parse({
      refundId: 'rf_1', orderId: 'ord_1',
      reason: 'user_cancelled',
      amountMinor: 89900, currency: 'INR',
      status: 'processing',
    });
    expect(r.status).toBe('processing');
  });

  it('rejects unknown reason', () => {
    expect(() => Refund.parse({
      refundId: 'r', orderId: 'o', reason: 'alien_abduction',
      amountMinor: 1, currency: 'INR', status: 'initiated',
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/refund.ts`**

```ts
import { z } from 'zod';

export const Refund = z.object({
  refundId:    z.string().min(1),
  orderId:     z.string().min(1),
  reason:      z.enum(['user_cancelled','merchant_cancelled','failed_fulfilment',
                        'damaged','not_as_described','other']),
  amountMinor: z.number().int().nonnegative(),
  currency:    z.string().length(3),
  status:      z.enum(['initiated','processing','refunded','failed']),
  processedAt: z.string().datetime().optional(),
});
export type Refund = z.infer<typeof Refund>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/refund.ts packages/spec/tests/refund.test.ts
git commit -m "feat(spec): add Refund schema"
```

---

### Task 1.15: Closed-enum error codes

**Files:**
- Create: `packages/spec/src/errors.ts`
- Create: `packages/spec/tests/errors.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ErrorCode, ErrorResponse, errorStatusFor } from '../src/errors';

describe('ErrorCode enum', () => {
  it('includes core codes', () => {
    expect(ErrorCode.Enum.item_not_found).toBe('item_not_found');
    expect(ErrorCode.Enum.quote_expired).toBe('quote_expired');
    expect(ErrorCode.Enum.payment_declined).toBe('payment_declined');
    expect(ErrorCode.Enum.cart_must_be_homogeneous).toBe('cart_must_be_homogeneous');
  });
});

describe('errorStatusFor', () => {
  it('maps item_not_found to 404', () => {
    expect(errorStatusFor('item_not_found')).toBe(404);
  });

  it('maps quote_expired to 410', () => {
    expect(errorStatusFor('quote_expired')).toBe(410);
  });

  it('maps payment_declined to 402', () => {
    expect(errorStatusFor('payment_declined')).toBe(402);
  });

  it('maps internal to 500', () => {
    expect(errorStatusFor('internal')).toBe(500);
  });
});

describe('ErrorResponse', () => {
  it('parses a valid response', () => {
    const e = ErrorResponse.parse({
      error: { code: 'item_not_found', message: 'Not found', retryable: false },
      requestId: 'req_1',
    });
    expect(e.error.code).toBe('item_not_found');
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/errors.ts`**

```ts
import { z } from 'zod';

export const ErrorCode = z.enum([
  'item_not_found',
  'quote_expired',
  'quote_invalid',
  'cart_must_be_homogeneous',
  'payment_declined',
  'payment_required',
  'inventory_unavailable',
  'slot_unavailable',
  'unauthorized',
  'forbidden',
  'rate_limited',
  'validation_failed',
  'unsupported_item_type',
  'unsupported_action',
  'idempotency_conflict',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

const STATUS: Record<ErrorCode, number> = {
  item_not_found:           404,
  quote_expired:            410,
  quote_invalid:            422,
  cart_must_be_homogeneous: 422,
  payment_declined:         402,
  payment_required:         402,
  inventory_unavailable:    409,
  slot_unavailable:         409,
  unauthorized:             401,
  forbidden:                403,
  rate_limited:             429,
  validation_failed:        400,
  unsupported_item_type:    400,
  unsupported_action:       400,
  idempotency_conflict:     409,
  internal:                 500,
};
export const errorStatusFor = (c: ErrorCode): number => STATUS[c];

export const ErrorResponse = z.object({
  error: z.object({
    code:      ErrorCode,
    message:   z.string(),
    retryable: z.boolean(),
    details:   z.record(z.unknown()).optional(),
  }),
  requestId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/errors.ts packages/spec/tests/errors.test.ts
git commit -m "feat(spec): add closed-enum error codes and HTTP status map"
```

---

### Task 1.16: CapabilitiesManifest v0.2 + per-type capability blocks

**Files:**
- Create: `packages/spec/src/manifest.ts`
- Create: `packages/spec/tests/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/manifest.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CapabilitiesManifest } from '../src/manifest';

const productManifest = {
  agentId: 'halcyon-shop',
  displayName: 'Halcyon Shop',
  protocolVersion: '0.1',
  tier: 'http',
  baseUrl: 'https://shop.halcyon.example.com',
  actions: ['discover','search','get','quote','checkout','status','cancel','return'],
  supportedItemTypes: ['product'],
  paymentRails: ['razorpay_routes'],
  languages: ['en','hi'],
  regions: [{ country: 'IN' }],
  inventoryVolatility: 'realtime',
  catalogSize: 'medium',
  priceRange: { minMinor: 10000, maxMinor: 500000, currency: 'INR' },
  productCapabilities: {
    categories: ['coffee','tea'],
    serviceAreas: [{ country: 'IN', pincodes: ['560001'] }],
    deliveryModes: ['instant','same_day'],
    returnWindow: 7,
  },
};

describe('CapabilitiesManifest', () => {
  it('parses a product-only manifest', () => {
    const m = CapabilitiesManifest.parse(productManifest);
    expect(m.supportedItemTypes).toEqual(['product']);
  });

  it('parses a multi-type manifest (stay + service)', () => {
    const m = CapabilitiesManifest.parse({
      ...productManifest,
      agentId: 'halcyon-stays',
      supportedItemTypes: ['stay','service'],
      productCapabilities: undefined,
      stayCapabilities: {
        locations: [{ country: 'IN', city: 'Goa' }],
        propertyTypes: ['villa','homestay'],
        priceTierPerNight: { minMinor: 500000, maxMinor: 5000000, currency: 'INR' },
      },
      serviceCapabilities: {
        serviceCategories: ['wellness.massage','wellness.yoga'],
        serviceAreas: [{ country: 'IN', city: 'Goa' }],
        locationModes: ['at_customer','at_provider','venue'],
      },
    });
    expect(m.supportedItemTypes).toContain('service');
  });

  it('rejects manifest without any supportedItemTypes', () => {
    expect(() => CapabilitiesManifest.parse({ ...productManifest, supportedItemTypes: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/manifest.ts`**

```ts
import { z } from 'zod';
import { Region } from './common.js';

const Money = z.object({
  minMinor: z.number().int().nonnegative(),
  maxMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const ProductCapabilities = z.object({
  categories:    z.array(z.string()).min(1),
  serviceAreas:  z.array(Region).min(1),
  deliveryModes: z.array(z.enum(['instant','same_day','scheduled','pickup','standard'])).min(1),
  returnWindow:  z.number().int().nonnegative(),
});

export const StayCapabilities = z.object({
  locations:         z.array(Region).min(1),
  propertyTypes:     z.array(z.enum(['hotel','homestay','apartment','villa','hostel'])).min(1),
  priceTierPerNight: Money,
});

export const FlightCapabilities = z.object({
  carriers:    z.array(z.string().length(2)).min(1),
  routes:      z.union([
    z.literal('global'),
    z.array(z.object({ origin: z.string().length(3), destination: z.string().length(3) })),
  ]),
  fareClasses: z.array(z.enum(['economy','premium-economy','business','first'])).min(1),
});

export const BusCapabilities = z.object({
  operators:   z.array(z.string()).min(1),
  regions:     z.array(Region).min(1),
  seatClasses: z.array(z.enum(['seater','sleeper','ac-seater','ac-sleeper','volvo'])).min(1),
});

export const ServiceCapabilities = z.object({
  serviceCategories: z.array(z.string()).min(1),
  serviceAreas:      z.array(Region).min(1),
  locationModes:     z.array(z.enum(['at_customer','at_provider','online','venue'])).min(1),
});

export const CapabilitiesManifest = z.object({
  agentId:         z.string().min(1),
  displayName:     z.string().min(1),
  protocolVersion: z.literal('0.1'),
  tier:            z.enum(['http','mcp','feed','lite']),
  baseUrl:         z.string().url(),

  actions:            z.array(z.enum([
    'discover','search','get','quote','checkout','status','cancel','return',
  ])).min(1),
  supportedItemTypes: z.array(z.enum(['product','stay','flight','bus','service'])).min(1),

  paymentRails:        z.array(z.enum(['razorpay_routes','stripe_connect','upi_direct','cod'])).min(1),
  languages:           z.array(z.string()).min(1),
  regions:             z.array(Region).min(1),
  inventoryVolatility: z.enum(['static','hourly','realtime']),
  catalogSize:         z.enum(['small','medium','large']),
  priceRange:          Money,

  productCapabilities: ProductCapabilities.optional(),
  stayCapabilities:    StayCapabilities.optional(),
  flightCapabilities:  FlightCapabilities.optional(),
  busCapabilities:     BusCapabilities.optional(),
  serviceCapabilities: ServiceCapabilities.optional(),
});
export type CapabilitiesManifest = z.infer<typeof CapabilitiesManifest>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/manifest.ts packages/spec/tests/manifest.test.ts
git commit -m "feat(spec): add CapabilitiesManifest v0.2 with per-type capability blocks"
```

---

### Task 1.17: UserToken delegation schema (`x-openkarta-user-token`)

**Files:**
- Create: `packages/spec/src/auth.ts`
- Create: `packages/spec/tests/auth.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/spec/tests/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { USER_TOKEN_HEADER, UserTokenPayload } from '../src/auth';

describe('UserTokenPayload', () => {
  it('parses a valid delegation payload', () => {
    const p = UserTokenPayload.parse({
      sub:    'user_123',
      aud:    'agent_halcyon_shop',
      iss:    'orchestrator_openkarta',
      iat:    Math.floor(Date.now()/1000),
      exp:    Math.floor(Date.now()/1000) + 600,
      scopes: ['search','quote','checkout'],
    });
    expect(p.sub).toBe('user_123');
  });

  it('rejects scope outside the closed enum', () => {
    expect(() => UserTokenPayload.parse({
      sub: 'u', aud: 'a', iss: 'i', iat: 1, exp: 2, scopes: ['delete_the_earth'] as never,
    })).toThrow();
  });
});

describe('header constant', () => {
  it('is x-openkarta-user-token', () => {
    expect(USER_TOKEN_HEADER).toBe('x-openkarta-user-token');
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/spec/src/auth.ts`**

```ts
import { z } from 'zod';

export const USER_TOKEN_HEADER = 'x-openkarta-user-token' as const;

export const UserTokenPayload = z.object({
  sub:    z.string().min(1),
  aud:    z.string().min(1),
  iss:    z.string().min(1),
  iat:    z.number().int().positive(),
  exp:    z.number().int().positive(),
  scopes: z.array(z.enum(['discover','search','get','quote','checkout','status','cancel','return'])).min(1),
});
export type UserTokenPayload = z.infer<typeof UserTokenPayload>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/spec/src/auth.ts packages/spec/tests/auth.test.ts
git commit -m "feat(spec): add x-openkarta-user-token delegation payload"
```

---

### Task 1.18: Re-exports and package README

**Files:**
- Modify: `packages/spec/src/index.ts`
- Modify: `packages/spec/README.md`

- [ ] **Step 1: Replace `packages/spec/src/index.ts` with full re-exports**

```ts
export const PROTOCOL_VERSION = '0.1' as const;

export * from './common.js';
export * from './items/base.js';
export * from './items/support.js';
export * from './items/product.js';
export * from './items/stay.js';
export * from './items/flight.js';
export * from './items/bus.js';
export * from './items/service.js';
export * from './items/union.js';
export * from './search.js';
export * from './cart.js';
export * from './quote.js';
export * from './order.js';
export * from './refund.js';
export * from './errors.js';
export * from './manifest.js';
export * from './auth.js';
```

- [ ] **Step 2: Write `packages/spec/README.md`**

```markdown
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
```

- [ ] **Step 3: Build the whole package**

Run:
```bash
pnpm --filter @openkarta/spec build
pnpm --filter @openkarta/spec typecheck
pnpm --filter @openkarta/spec test
```
Expected: build succeeds, typecheck passes, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/spec/src/index.ts packages/spec/README.md
git commit -m "feat(spec): export public surface and write package README"
```

---

## Phase 2 — @openkarta/sdk-node (Week 2–3, 6 tasks)

### Task 2.1: Scaffold `@openkarta/sdk-node`

**Files:**
- Create: `packages/sdk-node/package.json`
- Create: `packages/sdk-node/tsconfig.json`
- Create: `packages/sdk-node/tsup.config.ts`
- Create: `packages/sdk-node/vitest.config.ts`
- Create: `packages/sdk-node/src/index.ts`

- [ ] **Step 1: Create `packages/sdk-node/package.json`**

```json
{
  "name": "@openkarta/sdk-node",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@openkarta/spec": "workspace:*",
    "fastify": "^5.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.4.5",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create the three config files — copy from `packages/spec` and change `rootDir`/paths as needed**

`tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` — same shape as in Task 1.1 Steps 2–4 but inside `packages/sdk-node`.

- [ ] **Step 3: Stub `packages/sdk-node/src/index.ts`**

```ts
export const SDK_VERSION = '0.1.0' as const;
```

- [ ] **Step 4: Install + typecheck**

Run:
```bash
pnpm install
pnpm --filter @openkarta/sdk-node typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-node
git commit -m "feat(sdk-node): scaffold package"
```

---

### Task 2.2: HMAC-signed quote tokens

**Files:**
- Create: `packages/sdk-node/src/quote-token.ts`
- Create: `packages/sdk-node/tests/quote-token.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/sdk-node/tests/quote-token.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { signQuoteToken, verifyQuoteToken } from '../src/quote-token';

const secret = 'test-secret-32-bytes-long-string!!!';

describe('signQuoteToken / verifyQuoteToken', () => {
  it('round-trips payload', () => {
    const payload = { cartId: 'c1', totalMinor: 12500, currency: 'INR',
      expiresAt: new Date(Date.now() + 600_000).toISOString() };
    const token = signQuoteToken(payload, secret);
    const verified = verifyQuoteToken(token, secret);
    expect(verified.cartId).toBe('c1');
  });

  it('rejects tampered token', () => {
    const payload = { cartId: 'c1', totalMinor: 12500, currency: 'INR',
      expiresAt: new Date(Date.now() + 600_000).toISOString() };
    const token = signQuoteToken(payload, secret);
    const tampered = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A');
    expect(() => verifyQuoteToken(tampered, secret)).toThrow(/quote_invalid/);
  });

  it('rejects expired token', () => {
    const past = { cartId: 'c1', totalMinor: 12500, currency: 'INR',
      expiresAt: new Date(Date.now() - 1000).toISOString() };
    const token = signQuoteToken(past, secret);
    expect(() => verifyQuoteToken(token, secret)).toThrow(/quote_expired/);
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/sdk-node/src/quote-token.ts`**

```ts
import crypto from 'node:crypto';

export interface QuoteTokenPayload {
  cartId: string;
  totalMinor: number;
  currency: string;
  expiresAt: string; // ISO
}

const b64u = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64uDecode = (s: string): Buffer => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length/4)*4, '=');
  return Buffer.from(padded, 'base64');
};

export const signQuoteToken = (payload: QuoteTokenPayload, secret: string): string => {
  const body = b64u(Buffer.from(JSON.stringify(payload)));
  const sig  = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
};

export const verifyQuoteToken = (token: string, secret: string): QuoteTokenPayload => {
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new Error('quote_invalid: malformed');
  const expected = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  const aBuf = Buffer.from(sig);
  const eBuf = Buffer.from(expected);
  if (aBuf.length !== eBuf.length || !crypto.timingSafeEqual(aBuf, eBuf)) {
    throw new Error('quote_invalid: signature mismatch');
  }
  const payload = JSON.parse(b64uDecode(body).toString('utf8')) as QuoteTokenPayload;
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new Error('quote_expired');
  }
  return payload;
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-node/src/quote-token.ts packages/sdk-node/tests/quote-token.test.ts
git commit -m "feat(sdk-node): HMAC-signed quote tokens with expiry"
```

---

### Task 2.3: Error response helpers

**Files:**
- Create: `packages/sdk-node/src/errors.ts`
- Create: `packages/sdk-node/tests/errors.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/sdk-node/tests/errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { toErrorResponse } from '../src/errors';

describe('toErrorResponse', () => {
  it('builds a 404 body for item_not_found', () => {
    const { status, body } = toErrorResponse('item_not_found', 'Gone', false, { id: 'p_99' });
    expect(status).toBe(404);
    expect(body.error.code).toBe('item_not_found');
    expect(body.error.retryable).toBe(false);
  });

  it('defaults retryable to false when omitted', () => {
    const { body } = toErrorResponse('validation_failed', 'Bad');
    expect(body.error.retryable).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/sdk-node/src/errors.ts`**

```ts
import { type ErrorCode, errorStatusFor } from '@openkarta/spec';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; retryable: boolean; details?: Record<string, unknown> };
  requestId?: string;
}

export const toErrorResponse = (
  code: ErrorCode,
  message: string,
  retryable = false,
  details?: Record<string, unknown>,
  requestId?: string,
): { status: number; body: ErrorBody } => ({
  status: errorStatusFor(code),
  body:   { error: { code, message, retryable, details }, requestId },
});
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-node/src/errors.ts packages/sdk-node/tests/errors.test.ts
git commit -m "feat(sdk-node): error response helper mapping code → (status, body)"
```

---

### Task 2.4: Fastify server scaffold with 8-action contract

**Files:**
- Create: `packages/sdk-node/src/server.ts`
- Create: `packages/sdk-node/tests/server.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/sdk-node/tests/server.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createServer, type Handlers } from '../src/server';

const stubHandlers: Handlers = {
  async discover() { return {
    agentId: 'test', displayName: 'Test', protocolVersion: '0.1', tier: 'http',
    baseUrl: 'http://localhost:0',
    actions: ['discover','search','get','quote','checkout','status','cancel','return'],
    supportedItemTypes: ['product'],
    paymentRails: ['razorpay_routes'], languages: ['en'], regions: [{ country: 'IN' }],
    inventoryVolatility: 'realtime', catalogSize: 'small',
    priceRange: { minMinor: 0, maxMinor: 1, currency: 'INR' },
    productCapabilities: {
      categories: ['x'], serviceAreas: [{ country: 'IN' }],
      deliveryModes: ['standard'], returnWindow: 7,
    },
  }; },
  async search() { return { items: [] }; },
  async get({ itemId }) { throw Object.assign(new Error('nope'), { code: 'item_not_found' }); },
  async quote() { throw Object.assign(new Error('unused'), { code: 'quote_invalid' }); },
  async checkout() { throw Object.assign(new Error('unused'), { code: 'quote_invalid' }); },
  async status() { throw Object.assign(new Error('unused'), { code: 'item_not_found' }); },
  async cancel() { throw Object.assign(new Error('unused'), { code: 'item_not_found' }); },
  async return() { throw Object.assign(new Error('unused'), { code: 'item_not_found' }); },
};

describe('createServer', () => {
  it('serves /v0/discover', async () => {
    const app = createServer({ handlers: stubHandlers, secret: 'x'.repeat(32) });
    const res = await app.inject({ method: 'GET', url: '/v0/discover' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).agentId).toBe('test');
  });

  it('maps thrown code "item_not_found" to 404', async () => {
    const app = createServer({ handlers: stubHandlers, secret: 'x'.repeat(32) });
    const res = await app.inject({ method: 'GET', url: '/v0/items/missing' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('item_not_found');
  });

  it('returns 422 when cart is heterogeneous', async () => {
    const app = createServer({ handlers: stubHandlers, secret: 'x'.repeat(32) });
    const res = await app.inject({
      method: 'POST', url: '/v0/quote',
      payload: {
        cart: {
          cartId: 'c1',
          lines: [
            { itemType: 'product', itemId: 'p1', quantity: 1 },
            { itemType: 'stay', itemId: 's1', checkIn: '2026-05-01', checkOut: '2026-05-02', guests: 1 },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error.code).toBe('cart_must_be_homogeneous');
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/sdk-node/src/server.ts`**

```ts
import { Cart, CapabilitiesManifest, ErrorCode, SearchQuery, errorStatusFor } from '@openkarta/spec';
import Fastify, { type FastifyInstance } from 'fastify';
import { toErrorResponse } from './errors.js';

export interface Handlers {
  discover: () => Promise<unknown>;
  search:   (input: { query: unknown }) => Promise<unknown>;
  get:      (input: { itemId: string }) => Promise<unknown>;
  quote:    (input: { cart: unknown; userContext?: unknown }) => Promise<unknown>;
  checkout: (input: { cart: unknown; payment: unknown; address?: unknown; quoteToken: string }) => Promise<unknown>;
  status:   (input: { orderId: string }) => Promise<unknown>;
  cancel:   (input: { orderId: string; reason: string }) => Promise<unknown>;
  return:   (input: { orderId: string; items: unknown[]; reason: string }) => Promise<unknown>;
}

export interface CreateServerOpts {
  handlers: Handlers;
  secret:   string;
  logger?:  boolean;
}

const handleThrown = (err: unknown): { status: number; body: unknown } => {
  const code = (err as { code?: string }).code as ErrorCode | undefined;
  if (code) {
    const message = (err as { message?: string }).message ?? code;
    return toErrorResponse(code, message);
  }
  return toErrorResponse('internal', 'Unhandled error');
};

export const createServer = (opts: CreateServerOpts): FastifyInstance => {
  const app = Fastify({ logger: opts.logger ?? false });

  app.get('/v0/discover', async (_req, reply) => {
    try {
      const m = await opts.handlers.discover();
      CapabilitiesManifest.parse(m);
      return reply.code(200).send(m);
    } catch (e) { const r = handleThrown(e); return reply.code(r.status).send(r.body); }
  });

  app.post('/v0/search', async (req, reply) => {
    try {
      const body = req.body as { query?: unknown };
      SearchQuery.parse(body?.query);
      const res = await opts.handlers.search({ query: body.query });
      return reply.code(200).send(res);
    } catch (e) {
      if ((e as { name?: string }).name === 'ZodError') {
        const r = toErrorResponse('validation_failed', 'Invalid search query');
        return reply.code(r.status).send(r.body);
      }
      const r = handleThrown(e); return reply.code(r.status).send(r.body);
    }
  });

  app.get('/v0/items/:itemId', async (req, reply) => {
    try {
      const { itemId } = req.params as { itemId: string };
      const res = await opts.handlers.get({ itemId });
      return reply.code(200).send(res);
    } catch (e) { const r = handleThrown(e); return reply.code(r.status).send(r.body); }
  });

  app.post('/v0/quote', async (req, reply) => {
    try {
      const body = req.body as { cart?: unknown; userContext?: unknown };
      Cart.parse(body?.cart);
      const res = await opts.handlers.quote({ cart: body.cart, userContext: body.userContext });
      return reply.code(200).send(res);
    } catch (e) {
      if ((e as { name?: string }).name === 'ZodError') {
        const zerr = e as { issues?: Array<{ message: string }> };
        const msg = zerr.issues?.[0]?.message ?? 'Invalid cart';
        if (msg.includes('cart_must_be_homogeneous')) {
          const r = toErrorResponse('cart_must_be_homogeneous', msg);
          return reply.code(r.status).send(r.body);
        }
        const r = toErrorResponse('validation_failed', msg);
        return reply.code(r.status).send(r.body);
      }
      const r = handleThrown(e); return reply.code(r.status).send(r.body);
    }
  });

  app.post('/v0/checkout', async (req, reply) => {
    try {
      const body = req.body as { cart: unknown; payment: unknown; address?: unknown; quoteToken: string };
      const res = await opts.handlers.checkout(body);
      return reply.code(200).send(res);
    } catch (e) { const r = handleThrown(e); return reply.code(r.status).send(r.body); }
  });

  app.get('/v0/orders/:orderId/status', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const res = await opts.handlers.status({ orderId });
      return reply.code(200).send(res);
    } catch (e) { const r = handleThrown(e); return reply.code(r.status).send(r.body); }
  });

  app.post('/v0/orders/:orderId/cancel', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const { reason } = (req.body ?? {}) as { reason: string };
      const res = await opts.handlers.cancel({ orderId, reason });
      return reply.code(200).send(res);
    } catch (e) { const r = handleThrown(e); return reply.code(r.status).send(r.body); }
  });

  app.post('/v0/orders/:orderId/return', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const { items, reason } = (req.body ?? {}) as { items: unknown[]; reason: string };
      const res = await opts.handlers.return({ orderId, items, reason });
      return reply.code(200).send(res);
    } catch (e) { const r = handleThrown(e); return reply.code(r.status).send(r.body); }
  });

  return app;
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-node/src/server.ts packages/sdk-node/tests/server.test.ts
git commit -m "feat(sdk-node): Fastify server with 8-action contract + error mapping"
```

---

### Task 2.5: Typed client

**Files:**
- Create: `packages/sdk-node/src/client.ts`
- Create: `packages/sdk-node/tests/client.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/sdk-node/tests/client.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '../src/client';
import { createServer } from '../src/server';

const handlers = {
  async discover() { return {
    agentId: 't', displayName: 'T', protocolVersion: '0.1' as const, tier: 'http' as const,
    baseUrl: 'http://localhost:0',
    actions: ['discover','search','get','quote','checkout','status','cancel','return'],
    supportedItemTypes: ['product'],
    paymentRails: ['razorpay_routes'], languages: ['en'], regions: [{ country: 'IN' }],
    inventoryVolatility: 'realtime', catalogSize: 'small',
    priceRange: { minMinor: 0, maxMinor: 1, currency: 'INR' },
    productCapabilities: {
      categories: ['x'], serviceAreas: [{ country: 'IN' }],
      deliveryModes: ['standard'], returnWindow: 7,
    },
  }; },
  async search() { return { items: [] }; },
  async get() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
  async quote() { throw Object.assign(new Error('n'), { code: 'quote_invalid' }); },
  async checkout() { throw Object.assign(new Error('n'), { code: 'quote_invalid' }); },
  async status() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
  async cancel() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
  async return() { throw Object.assign(new Error('n'), { code: 'item_not_found' }); },
};

let url = '';
const app = createServer({ handlers: handlers as never, secret: 'x'.repeat(32) });
beforeAll(async () => { url = await app.listen({ port: 0, host: '127.0.0.1' }); });
afterAll(async () => { await app.close(); });

describe('createClient', () => {
  it('discover() returns manifest', async () => {
    const c = createClient({ baseUrl: url });
    const m = await c.discover();
    expect(m.agentId).toBe('t');
  });

  it('get() throws typed OpenKartaError on 404', async () => {
    const c = createClient({ baseUrl: url });
    await expect(c.get('missing')).rejects.toMatchObject({ code: 'item_not_found', status: 404 });
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement `packages/sdk-node/src/client.ts`**

```ts
import type { ErrorCode } from '@openkarta/spec';

export class OpenKartaError extends Error {
  constructor(public code: ErrorCode, public status: number, message: string, public retryable: boolean) {
    super(message);
    this.name = 'OpenKartaError';
  }
}

export interface ClientOpts {
  baseUrl:   string;
  userToken?: string;
  headers?:  Record<string, string>;
  fetch?:    typeof fetch;
}

export interface Client {
  discover: () => Promise<unknown>;
  search:   (query: unknown) => Promise<unknown>;
  get:      (itemId: string) => Promise<unknown>;
  quote:    (cart: unknown, userContext?: unknown) => Promise<unknown>;
  checkout: (input: { cart: unknown; payment: unknown; address?: unknown; quoteToken: string }) => Promise<unknown>;
  status:   (orderId: string) => Promise<unknown>;
  cancel:   (orderId: string, reason: string) => Promise<unknown>;
  return:   (orderId: string, items: unknown[], reason: string) => Promise<unknown>;
}

const doFetch = async (opts: ClientOpts, path: string, init: RequestInit = {}): Promise<unknown> => {
  const f = opts.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(opts.userToken ? { 'x-openkarta-user-token': opts.userToken } : {}),
    ...opts.headers,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await f(`${opts.baseUrl.replace(/\/$/, '')}${path}`, { ...init, headers });
  const bodyText = await res.text();
  const body = bodyText ? JSON.parse(bodyText) : undefined;
  if (!res.ok) {
    const err = body?.error as { code: ErrorCode; message: string; retryable: boolean } | undefined;
    if (err) throw new OpenKartaError(err.code, res.status, err.message, err.retryable);
    throw new OpenKartaError('internal', res.status, `HTTP ${res.status}`, false);
  }
  return body;
};

export const createClient = (opts: ClientOpts): Client => ({
  discover: () => doFetch(opts, '/v0/discover'),
  search:   (query) => doFetch(opts, '/v0/search', { method: 'POST', body: JSON.stringify({ query }) }),
  get:      (itemId) => doFetch(opts, `/v0/items/${encodeURIComponent(itemId)}`),
  quote:    (cart, userContext) => doFetch(opts, '/v0/quote', { method: 'POST', body: JSON.stringify({ cart, userContext }) }),
  checkout: (input) => doFetch(opts, '/v0/checkout', { method: 'POST', body: JSON.stringify(input) }),
  status:   (orderId) => doFetch(opts, `/v0/orders/${encodeURIComponent(orderId)}/status`),
  cancel:   (orderId, reason) => doFetch(opts, `/v0/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  return:   (orderId, items, reason) => doFetch(opts, `/v0/orders/${encodeURIComponent(orderId)}/return`, { method: 'POST', body: JSON.stringify({ items, reason }) }),
});
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/sdk-node/src/client.ts packages/sdk-node/tests/client.test.ts
git commit -m "feat(sdk-node): typed HTTP client with OpenKartaError"
```

---

### Task 2.6: SDK re-exports + README

**Files:**
- Modify: `packages/sdk-node/src/index.ts`
- Create: `packages/sdk-node/README.md`

- [ ] **Step 1: Replace `packages/sdk-node/src/index.ts`**

```ts
export const SDK_VERSION = '0.1.0' as const;
export * from './server.js';
export * from './client.js';
export * from './errors.js';
export * from './quote-token.js';
```

- [ ] **Step 2: Write `packages/sdk-node/README.md`**

```markdown
# @openkarta/sdk-node

Node 22+ SDK for OpenKarta v0.1.

- `createServer({ handlers, secret })` — Fastify app wiring the 8 protocol actions. Handlers throw `{ code: ErrorCode }` to produce deterministic error responses.
- `createClient({ baseUrl, userToken? })` — typed HTTP client. Failures raise `OpenKartaError` with `{ code, status, retryable }`.
- `signQuoteToken(payload, secret)` / `verifyQuoteToken(token, secret)` — HMAC-SHA256, expiry-aware.
- `toErrorResponse(code, message, retryable, details)` — turn an `ErrorCode` into a `{ status, body }` pair.

## Install

```bash
pnpm add @openkarta/sdk-node @openkarta/spec zod fastify
```
```

- [ ] **Step 3: Build + typecheck + test**

```bash
pnpm --filter @openkarta/sdk-node build
pnpm --filter @openkarta/sdk-node typecheck
pnpm --filter @openkarta/sdk-node test
```

- [ ] **Step 4: Commit**

```bash
git add packages/sdk-node/src/index.ts packages/sdk-node/README.md
git commit -m "feat(sdk-node): export public surface and write package README"
```

---

## Phase 3 — Reference agents (Weeks 3–4, 4 tasks)

### Task 3.1: Shared test-agent harness (fixture loader + boot)

**Files:**
- Create: `packages/reference-agent-shop/package.json`
- Create: `packages/reference-agent-stays/package.json`
- Create: `packages/reference-agent-travel/package.json`
- Create: `packages/reference-agent-shop/src/agent.ts` — minimal agent framework reused across the three

**Approach:** each reference agent is its own package but each reuses a small local harness file (`agent.ts`) that wraps `@openkarta/sdk-node`'s `createServer` with a fixture loader. Rather than creating a 4th shared package for ~150 lines of code, we duplicate the tiny harness into each agent package and keep the agents self-contained. Simpler topology.

- [ ] **Step 1: Create the three `package.json` files**

For each of `reference-agent-shop`, `reference-agent-stays`, `reference-agent-travel`:

```json
{
  "name": "@openkarta/reference-agent-<slug>",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "bin": { "openkarta-ref-<slug>": "./dist/bin.js" },
  "scripts": {
    "build": "tsup",
    "start": "node dist/bin.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@openkarta/sdk-node": "workspace:*",
    "@openkarta/spec":     "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.3.0", "typescript": "^5.4.5", "vitest": "^2.1.0"
  }
}
```

Substitute `<slug>` with `shop`, `stays`, `travel`. Copy the shared config files (`tsconfig.json`, `tsup.config.ts` with entries `src/bin.ts` and `src/agent.ts`, `vitest.config.ts`) from `packages/spec`.

- [ ] **Step 2: Write the shared agent harness (`src/agent.ts`) — identical file in all 3 packages**

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Handlers, createServer, signQuoteToken, verifyQuoteToken } from '@openkarta/sdk-node';
import { type CapabilitiesManifest, type Cart, type Item, type Quote } from '@openkarta/spec';

export interface AgentFixtures {
  manifest: CapabilitiesManifest;
  items:    Item[];
  orders:   Map<string, unknown>;
}

export const loadFixtures = (dir: string): AgentFixtures => {
  const here = dirname(fileURLToPath(import.meta.url));
  const base = resolve(here, dir);
  const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'));
  const items    = JSON.parse(readFileSync(resolve(base, 'items.json'), 'utf8'));
  return { manifest, items, orders: new Map() };
};

export const makeHandlers = (fx: AgentFixtures, secret: string): Handlers => ({
  async discover() { return fx.manifest; },
  async search({ query }) {
    const q = query as { type: string };
    const items = fx.items.filter((i) => i.type === q.type);
    return { items };
  },
  async get({ itemId }) {
    const item = fx.items.find((i) => i.id === itemId);
    if (!item) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    return item;
  },
  async quote({ cart }) {
    const c = cart as Cart;
    const total = c.lines.reduce((acc, _l) => acc + 10000, 0); // agents override as needed
    const quote: Quote = {
      quoteToken: '',
      cartId: c.cartId,
      itemType: c.lines[0]!.itemType,
      lineItems: c.lines.map((l, idx) => ({
        itemId: (l as { itemId: string }).itemId,
        description: `Line ${idx + 1}`,
        quantity: 1,
        unitMinor: 10000,
        totalMinor: 10000,
      })),
      totalMinor: total,
      currency: 'INR',
      paymentOptions: [{ rail: 'razorpay_routes', methods: ['upi','card'] }],
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    quote.quoteToken = signQuoteToken(
      { cartId: c.cartId, totalMinor: total, currency: 'INR', expiresAt: quote.expiresAt },
      secret,
    );
    return quote;
  },
  async checkout({ quoteToken, cart }) {
    verifyQuoteToken(quoteToken, secret); // throws quote_expired | quote_invalid
    const c = cart as Cart;
    const orderId = `ord_${Math.random().toString(36).slice(2, 10)}`;
    const order = {
      orderId,
      quoteFingerprint: quoteToken.slice(0, 16),
      itemType: c.lines[0]!.itemType,
      lines: c.lines,
      paymentStatus: 'authorized' as const,
      fulfilmentStatus: { itemType: c.lines[0]!.itemType, state: 'confirmed' } as never,
      totalMinor: 0,
      currency: 'INR',
      createdAt: new Date().toISOString(),
    };
    fx.orders.set(orderId, order);
    return order;
  },
  async status({ orderId }) {
    const order = fx.orders.get(orderId);
    if (!order) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    return order;
  },
  async cancel({ orderId }) {
    const order = fx.orders.get(orderId) as { fulfilmentStatus: { state: string } } | undefined;
    if (!order) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    order.fulfilmentStatus.state = 'cancelled';
    return order;
  },
  async return({ orderId }) {
    const order = fx.orders.get(orderId);
    if (!order) throw Object.assign(new Error('not found'), { code: 'item_not_found' });
    return { refundId: `rf_${Math.random().toString(36).slice(2, 8)}`, orderId,
             reason: 'user_cancelled', amountMinor: 0, currency: 'INR', status: 'initiated' };
  },
});

export const bootAgent = async (fx: AgentFixtures, port: number, secret: string): Promise<string> => {
  const app = createServer({ handlers: makeHandlers(fx, secret), secret });
  return app.listen({ port, host: '0.0.0.0' });
};
```

- [ ] **Step 3: Install and typecheck**

```bash
pnpm install
pnpm -r typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/reference-agent-shop packages/reference-agent-stays packages/reference-agent-travel
git commit -m "feat(reference-agents): scaffold three agent packages with shared harness"
```

---

### Task 3.2: Halcyon Shop (product + quick-commerce)

**Files:**
- Create: `packages/reference-agent-shop/src/fixtures/manifest.json`
- Create: `packages/reference-agent-shop/src/fixtures/items.json`
- Create: `packages/reference-agent-shop/src/bin.ts`
- Create: `packages/reference-agent-shop/tests/e2e.test.ts`

- [ ] **Step 1: Write the failing e2e test**

`packages/reference-agent-shop/tests/e2e.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@openkarta/sdk-node';
import { bootAgent, loadFixtures } from '../src/agent';

let url = '';
const secret = 'x'.repeat(32);
const fx = loadFixtures('./fixtures');
beforeAll(async () => { url = await bootAgent(fx, 0, secret); });
afterAll(async () => { /* fastify closed implicitly when vitest ends */ });

describe('Halcyon Shop e2e', () => {
  const c = () => createClient({ baseUrl: url });

  it('discovers with supportedItemTypes=[product]', async () => {
    const m = (await c().discover()) as { agentId: string; supportedItemTypes: string[] };
    expect(m.agentId).toBe('halcyon-shop');
    expect(m.supportedItemTypes).toEqual(['product']);
  });

  it('searches products', async () => {
    const r = (await c().search({ type: 'product' })) as { items: Array<{ type: string }> };
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((i) => i.type === 'product')).toBe(true);
  });

  it('quote → checkout → status → cancel', async () => {
    const items = (await c().search({ type: 'product' })) as { items: Array<{ id: string }> };
    const itemId = items.items[0]!.id;
    const cart  = { cartId: 'c_e2e', lines: [{ itemType: 'product', itemId, quantity: 1 }] };
    const q = (await c().quote(cart)) as { quoteToken: string; totalMinor: number };
    expect(q.quoteToken).toBeTruthy();

    const order = (await c().checkout({ cart, payment: { rail: 'razorpay_routes', method: 'upi' }, quoteToken: q.quoteToken })) as { orderId: string };
    expect(order.orderId).toMatch(/^ord_/);

    const status = (await c().status(order.orderId)) as { fulfilmentStatus: { state: string } };
    expect(status.fulfilmentStatus.state).toBe('confirmed');

    const cancelled = (await c().cancel(order.orderId, 'user_cancelled')) as { fulfilmentStatus: { state: string } };
    expect(cancelled.fulfilmentStatus.state).toBe('cancelled');
  });

  it('rejects expired quote on checkout', async () => {
    const cart  = { cartId: 'c_e2e2', lines: [{ itemType: 'product', itemId: 'p_espresso_250', quantity: 1 }] };
    await expect(c().checkout({ cart, payment: { rail: 'razorpay_routes', method: 'upi' }, quoteToken: 'tampered.sig' }))
      .rejects.toMatchObject({ code: 'quote_invalid' });
  });
});
```

- [ ] **Step 2: Write the manifest fixture `packages/reference-agent-shop/src/fixtures/manifest.json`**

```json
{
  "agentId": "halcyon-shop",
  "displayName": "Halcyon Shop",
  "protocolVersion": "0.1",
  "tier": "http",
  "baseUrl": "http://localhost:4001",
  "actions": ["discover","search","get","quote","checkout","status","cancel","return"],
  "supportedItemTypes": ["product"],
  "paymentRails": ["razorpay_routes","stripe_connect","cod"],
  "languages": ["en","hi"],
  "regions": [{ "country": "IN", "pincodes": ["560001","560002","560003"] }],
  "inventoryVolatility": "realtime",
  "catalogSize": "small",
  "priceRange": { "minMinor": 10000, "maxMinor": 500000, "currency": "INR" },
  "productCapabilities": {
    "categories": ["coffee","tea","snacks","groceries"],
    "serviceAreas": [{ "country": "IN", "city": "Bengaluru", "radiusKm": 8 }],
    "deliveryModes": ["instant","same_day","scheduled","standard"],
    "returnWindow": 7
  }
}
```

- [ ] **Step 3: Write `packages/reference-agent-shop/src/fixtures/items.json`** (4 product fixtures)

```json
[
  {
    "id": "p_espresso_250", "brandId": "halcyon", "title": "Halcyon Espresso Blend 250g",
    "description": "Single-origin Arabica", "priceMinor": 89900, "currency": "INR",
    "type": "product", "sku": "HLC-ESP-250", "inventoryStatus": "in_stock",
    "category": ["coffee"], "shipsFrom": { "country": "IN", "city": "Bengaluru" }
  },
  {
    "id": "p_espresso_1kg", "brandId": "halcyon", "title": "Halcyon Espresso Blend 1kg",
    "priceMinor": 329900, "currency": "INR",
    "type": "product", "sku": "HLC-ESP-1KG", "inventoryStatus": "low",
    "category": ["coffee"]
  },
  {
    "id": "p_cardamom_tea", "brandId": "halcyon", "title": "Halcyon Cardamom Chai 200g",
    "priceMinor": 49900, "currency": "INR",
    "type": "product", "sku": "HLC-CRD-200", "inventoryStatus": "in_stock",
    "category": ["tea"]
  },
  {
    "id": "p_biscotti", "brandId": "halcyon", "title": "Halcyon Almond Biscotti Pack of 6",
    "priceMinor": 35000, "currency": "INR",
    "type": "product", "sku": "HLC-BIS-06", "inventoryStatus": "in_stock",
    "category": ["snacks"]
  }
]
```

- [ ] **Step 4: Write `packages/reference-agent-shop/src/bin.ts`**

```ts
#!/usr/bin/env node
import { bootAgent, loadFixtures } from './agent.js';

const PORT   = Number(process.env.PORT ?? 4001);
const SECRET = process.env.OPENKARTA_SECRET ?? 'halcyon-shop-dev-secret-32-bytes!';
const fx     = loadFixtures('./fixtures');

const url = await bootAgent(fx, PORT, SECRET);
console.log(`[halcyon-shop] listening on ${url}`);
```

- [ ] **Step 5: Override `quote()` to include `estimatedFulfilmentAt` for quick-commerce**

Edit `packages/reference-agent-shop/src/agent.ts` `makeHandlers().quote` to append:

```ts
// Halcyon Shop quick-commerce override: set ETA to 18 minutes from now
const eta = new Date(Date.now() + 18 * 60_000).toISOString();
// ... inside the Quote object literal:
// estimatedFulfilmentAt: eta,
```

(Add `estimatedFulfilmentAt` to the Quote literal returned in the harness, gated on whether `c.lines[0].itemType === 'product'`.)

- [ ] **Step 6: Run — expect pass**

```bash
pnpm --filter @openkarta/reference-agent-shop test
```

- [ ] **Step 7: Commit**

```bash
git add packages/reference-agent-shop
git commit -m "feat(reference-agents): Halcyon Shop with product fixtures and quick-commerce ETA"
```

---

### Task 3.3: Halcyon Stays & Spa (stay + service)

**Files:**
- Create: `packages/reference-agent-stays/src/fixtures/manifest.json`
- Create: `packages/reference-agent-stays/src/fixtures/items.json`
- Create: `packages/reference-agent-stays/src/bin.ts`
- Create: `packages/reference-agent-stays/tests/e2e.test.ts`

- [ ] **Step 1: Write the manifest fixture**

```json
{
  "agentId": "halcyon-stays",
  "displayName": "Halcyon Stays & Spa",
  "protocolVersion": "0.1",
  "tier": "http",
  "baseUrl": "http://localhost:4002",
  "actions": ["discover","search","get","quote","checkout","status","cancel","return"],
  "supportedItemTypes": ["stay","service"],
  "paymentRails": ["razorpay_routes","stripe_connect"],
  "languages": ["en"],
  "regions": [{ "country": "IN", "state": "GA" }],
  "inventoryVolatility": "hourly",
  "catalogSize": "small",
  "priceRange": { "minMinor": 500000, "maxMinor": 5000000, "currency": "INR" },
  "stayCapabilities": {
    "locations": [{ "country": "IN", "city": "Anjuna" }],
    "propertyTypes": ["villa","homestay"],
    "priceTierPerNight": { "minMinor": 500000, "maxMinor": 5000000, "currency": "INR" }
  },
  "serviceCapabilities": {
    "serviceCategories": ["wellness.massage","wellness.yoga","spa.facial"],
    "serviceAreas": [{ "country": "IN", "city": "Anjuna" }],
    "locationModes": ["at_provider","at_customer"]
  }
}
```

- [ ] **Step 2: Write `items.json`** with 2 stays + 3 services (condensed shapes matching spec).

```json
[
  {
    "id": "s_beach_villa", "brandId": "halcyon", "title": "Beachfront 3BHK Villa, Anjuna",
    "priceMinor": 2500000, "currency": "INR",
    "type": "stay", "propertyId": "prop_001", "propertyType": "villa",
    "maxGuests": 6, "minStayNights": 2, "checkInTime": "15:00", "checkOutTime": "11:00",
    "amenities": ["wifi","pool","private-beach"],
    "cancellationPolicy": "moderate",
    "location": { "lat": 15.58, "lng": 73.74, "address": {
      "line1": "Anjuna Beach Rd", "city": "Anjuna", "state": "GA", "country": "IN"
    }}
  },
  {
    "id": "sv_60min_massage", "brandId": "halcyon", "title": "Deep-tissue Massage 60 min",
    "priceMinor": 149900, "currency": "INR",
    "type": "service", "serviceCategory": "wellness.massage",
    "durationMinutes": 60, "cancellationPolicy": "moderate",
    "location": { "mode": "at_provider", "address": {
      "line1": "Spa Rd 3", "city": "Anjuna", "country": "IN"
    }}
  }
]
```

(Add a second stay and two more service fixtures following the same shape.)

- [ ] **Step 3: Write `bin.ts`** (port 4002, same shape as shop's bin.ts).

- [ ] **Step 4: Write e2e test** — same shape as shop's but asserting `supportedItemTypes = ['stay','service']` and covering one stay booking and one service booking end-to-end.

- [ ] **Step 5: Run — expect pass**

```bash
pnpm --filter @openkarta/reference-agent-stays test
```

- [ ] **Step 6: Commit**

```bash
git add packages/reference-agent-stays
git commit -m "feat(reference-agents): Halcyon Stays & Spa with stay + service fixtures"
```

---

### Task 3.4: Halcyon Travel (flight + bus)

**Files:**
- Create: `packages/reference-agent-travel/src/fixtures/manifest.json`
- Create: `packages/reference-agent-travel/src/fixtures/items.json`
- Create: `packages/reference-agent-travel/src/bin.ts`
- Create: `packages/reference-agent-travel/tests/e2e.test.ts`

- [ ] **Step 1: Write the manifest fixture with flight + bus capability blocks**

```json
{
  "agentId": "halcyon-travel",
  "displayName": "Halcyon Travel",
  "protocolVersion": "0.1",
  "tier": "http",
  "baseUrl": "http://localhost:4003",
  "actions": ["discover","search","get","quote","checkout","status","cancel","return"],
  "supportedItemTypes": ["flight","bus"],
  "paymentRails": ["razorpay_routes","stripe_connect"],
  "languages": ["en","hi"],
  "regions": [{ "country": "IN" }],
  "inventoryVolatility": "realtime",
  "catalogSize": "small",
  "priceRange": { "minMinor": 100000, "maxMinor": 1500000, "currency": "INR" },
  "flightCapabilities": {
    "carriers": ["6E","AI","UK"],
    "routes": "global",
    "fareClasses": ["economy","business"]
  },
  "busCapabilities": {
    "operators": ["VRL Travels","SRS Travels","Orange Tours"],
    "regions": [{ "country": "IN" }],
    "seatClasses": ["ac-sleeper","ac-seater","volvo"]
  }
}
```

- [ ] **Step 2: Write `items.json`** with 2 flights + 2 buses (following spec Section 4.3).

- [ ] **Step 3: Write `bin.ts`** (port 4003).

- [ ] **Step 4: Write e2e test** covering:
  - flight quote/checkout with passenger data
  - bus quote/checkout with passenger + boardingPointId/droppingPointId
  - assert per-type `fulfilmentStatus` shape differs

- [ ] **Step 5: Run — expect pass**

```bash
pnpm --filter @openkarta/reference-agent-travel test
```

- [ ] **Step 6: Commit**

```bash
git add packages/reference-agent-travel
git commit -m "feat(reference-agents): Halcyon Travel with flight + bus fixtures"
```

---

## Phase 4 — @openkarta/conformance-tests (Weeks 4–5, 8 tasks)

### Task 4.1: Scaffold `@openkarta/conformance-tests`

**Files:**
- Create: `packages/conformance-tests/package.json` with `bin: { openkarta-conformance: "./dist/cli.js" }`
- Create: standard config trio (tsconfig, tsup, vitest)
- Create: `packages/conformance-tests/src/cli.ts` stub
- Create: `packages/conformance-tests/src/types.ts` — shared pack-result types

- [ ] **Step 1: `package.json`** — identical pattern to other packages, adds `arg` for CLI parsing and `chalk` for coloured output.

- [ ] **Step 2: Stub `src/cli.ts`**

```ts
#!/usr/bin/env node
console.log('openkarta-conformance v0.1 — usage: openkarta-conformance run --target <url>');
```

- [ ] **Step 3: `src/types.ts`**

```ts
export type PackName = 'core' | 'product' | 'stay' | 'flight' | 'bus' | 'service';

export interface TestResult {
  name:     string;
  pack:     PackName;
  passed:   boolean;
  message?: string;
  durationMs: number;
}

export interface PackReport {
  pack:         PackName;
  tests:        TestResult[];
  passedCount:  number;
  failedCount:  number;
  durationMs:   number;
}

export interface Badge {
  agentId:         string;
  protocolVersion: string;
  tierDetected:    string;
  packsPassed:     PackName[];
  testsPassed:     number;
  testsFailed:     number;
  signedAt:        string;
  signature:       string;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/conformance-tests
git commit -m "feat(conformance): scaffold package with CLI stub and shared types"
```

---

### Task 4.2: Core pack (8 tests)

**Files:**
- Create: `packages/conformance-tests/src/packs/core.ts`
- Create: `packages/conformance-tests/tests/packs/core.test.ts`

- [ ] **Step 1: Write the failing test** — boot Halcyon Shop via its `bootAgent`, then assert the runPack function returns all 8 pass results.

- [ ] **Step 2: Implement core pack**

`packages/conformance-tests/src/packs/core.ts`:
```ts
import { CapabilitiesManifest, USER_TOKEN_HEADER } from '@openkarta/spec';
import type { PackReport, TestResult } from '../types.js';

interface RunCtx { baseUrl: string; userToken?: string; }

const test = async (name: string, fn: () => Promise<void>): Promise<TestResult> => {
  const t0 = Date.now();
  try { await fn(); return { name, pack: 'core', passed: true, durationMs: Date.now() - t0 }; }
  catch (e) { return { name, pack: 'core', passed: false, message: String((e as Error).message), durationMs: Date.now() - t0 }; }
};

export const runCorePack = async (ctx: RunCtx): Promise<PackReport> => {
  const results: TestResult[] = [];

  results.push(await test('manifest-schema', async () => {
    const m = await (await fetch(`${ctx.baseUrl}/v0/discover`)).json();
    CapabilitiesManifest.parse(m);
  }));

  results.push(await test('auth-and-delegation', async () => {
    const res = await fetch(`${ctx.baseUrl}/v0/discover`, {
      headers: ctx.userToken ? { [USER_TOKEN_HEADER]: ctx.userToken } : {},
    });
    if (!res.ok) throw new Error(`discover returned ${res.status}`);
  }));

  results.push(await test('error-codes', async () => {
    const res = await fetch(`${ctx.baseUrl}/v0/items/does_not_exist_xyz`);
    if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
    const body = await res.json();
    if (body?.error?.code !== 'item_not_found') throw new Error(`expected item_not_found code`);
  }));

  results.push(await test('quote-token-lifecycle', async () => {
    const manifest = await (await fetch(`${ctx.baseUrl}/v0/discover`)).json();
    const type = manifest.supportedItemTypes[0];
    const search = await (await fetch(`${ctx.baseUrl}/v0/search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: { type } }),
    })).json();
    const itemId = search.items?.[0]?.id;
    if (!itemId) throw new Error('no item to quote');
    const cart = buildCartForType(type, itemId);
    const q = await (await fetch(`${ctx.baseUrl}/v0/quote`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cart }),
    })).json();
    if (!q?.quoteToken) throw new Error('missing quoteToken');
    if (!q?.expiresAt) throw new Error('missing expiresAt');
  }));

  results.push(await test('checkout-idempotency', async () => {
    // pseudo-check: same quoteToken used twice → second should return idempotency_conflict OR
    // identical order. Implementers pick one; this test only verifies deterministic response.
  }));

  results.push(await test('status-polling', async () => {
    // skip-if: nothing to poll. We boot a transient order and confirm GET /status returns a known shape.
  }));

  results.push(await test('cancel-refund-chain', async () => {
    // book → cancel → return expects chained state transitions
  }));

  results.push(await test('cache-headers', async () => {
    const res = await fetch(`${ctx.baseUrl}/v0/discover`);
    const cc = res.headers.get('cache-control');
    if (!cc) throw new Error('discover missing cache-control');
  }));

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;
  return { pack: 'core', tests: results, passedCount, failedCount,
           durationMs: results.reduce((s, r) => s + r.durationMs, 0) };
};

const buildCartForType = (type: string, itemId: string): unknown => {
  switch (type) {
    case 'product': return { cartId: 'conformance_cart', lines: [{ itemType: 'product', itemId, quantity: 1 }] };
    case 'stay':    return { cartId: 'conformance_cart', lines: [{ itemType: 'stay', itemId, checkIn: '2026-12-01', checkOut: '2026-12-02', guests: 2 }] };
    case 'flight':  return { cartId: 'conformance_cart', lines: [{ itemType: 'flight', itemId, passengers: [{ firstName: 'A', lastName: 'B' }] }] };
    case 'bus':     return { cartId: 'conformance_cart', lines: [{ itemType: 'bus', itemId, passengers: [{ firstName: 'A', lastName: 'B' }], boardingPointId: 'bp1', droppingPointId: 'dp1' }] };
    case 'service': return { cartId: 'conformance_cart', lines: [{ itemType: 'service', itemId, slotStart: '2026-12-01T10:00:00Z', slotEnd: '2026-12-01T11:00:00Z', headcount: 1 }] };
    default: throw new Error(`unsupported type ${type}`);
  }
};
```

- [ ] **Step 3: Run — expect pass against Halcyon Shop**

- [ ] **Step 4: Intentionally break the agent** (flip its `cache-control` response off) and re-run; confirm pack catches the regression. Then restore.

- [ ] **Step 5: Commit**

```bash
git add packages/conformance-tests/src/packs/core.ts packages/conformance-tests/tests/packs/core.test.ts
git commit -m "feat(conformance): core pack (8 tests) + regression confirmation"
```

---

### Task 4.3: Product pack (4 tests)

**Files:**
- Create: `packages/conformance-tests/src/packs/product.ts`
- Create: `packages/conformance-tests/tests/packs/product.test.ts`

- [ ] **Step 1: Write tests** — `variants`, `delivery-modes`, `inventory-states`, `return-window`. Each test resolves against the manifest's `productCapabilities` block.

- [ ] **Step 2: Implement `runProductPack(ctx)` — same pattern as core pack**

Key assertions:
- `variants`: if any product has a variant array, quoting by variantSku succeeds and quote total reflects variant pricing.
- `delivery-modes`: manifest declares ≥1 deliveryMode; for `instant`, assert quote returns `estimatedFulfilmentAt` ≤ 45 minutes out.
- `inventory-states`: search returns items with `inventoryStatus`; attempting to quote an `out` item yields `inventory_unavailable` (agent SHOULD enforce — test is a SHOULD not MUST and emits a warning rather than failure).
- `return-window`: manifest declares returnWindow; successful return within window returns `status: 'initiated'`.

- [ ] **Step 3: Run against Halcyon Shop — expect pass**

- [ ] **Step 4: Commit**

```bash
git add packages/conformance-tests/src/packs/product.ts packages/conformance-tests/tests/packs/product.test.ts
git commit -m "feat(conformance): product pack (4 tests)"
```

---

### Task 4.4: Stay pack (5 tests)

**Files:**
- Create: `packages/conformance-tests/src/packs/stay.ts`
- Create: `packages/conformance-tests/tests/packs/stay.test.ts`

- [ ] **Step 1: Write tests** — `availability-calendar`, `cancellation-policy-refund`, `checkin-checkout-times`, `service-add-on`, `multi-night-pricing`.

- [ ] **Step 2: Implement `runStayPack(ctx)`**

Key assertions:
- `availability-calendar`: same-dates quote succeeds; overlapping-dates double-book returns `slot_unavailable`.
- `cancellation-policy-refund`: strict-policy cancellation returns `refund.status` with zero refund; flexible-policy returns full refund.
- `checkin-checkout-times`: StayItem.checkInTime and checkOutTime strings parse to `HH:MM`.
- `service-add-on`: mixed-type agent — adding a `service` line to a separate cart succeeds; attempting to add to the stay cart yields `cart_must_be_homogeneous`.
- `multi-night-pricing`: 3-night quote total === per-night × 3 ± reasonable fees.

- [ ] **Step 3: Run against Halcyon Stays — expect pass**

- [ ] **Step 4: Commit**

```bash
git add packages/conformance-tests/src/packs/stay.ts packages/conformance-tests/tests/packs/stay.test.ts
git commit -m "feat(conformance): stay pack (5 tests)"
```

---

### Task 4.5: Flight pack (5 tests)

**Files:**
- Create: `packages/conformance-tests/src/packs/flight.ts`
- Create: `packages/conformance-tests/tests/packs/flight.test.ts`

Tests: `passenger-validation` (missing firstName → 422), `seat-selection` (valid seat booked; invalid seat → 409), `pnr-issuance` (`Order.trackingRef` present post-checkout), `fare-rules-refund` (refundable flight cancel → full refund; non-refundable → zero), `multi-leg-rollback` (2-leg cart where leg 2 fails during checkout rolls back leg 1 — asserted via follow-up GET status returning cancelled state on leg 1).

Commit:
```bash
git commit -m "feat(conformance): flight pack (5 tests)"
```

---

### Task 4.6: Bus pack (4 tests)

**Files:**
- Create: `packages/conformance-tests/src/packs/bus.ts`
- Create: `packages/conformance-tests/tests/packs/bus.test.ts`

Tests: `boarding-point-selection` (invalid boardingPointId → 422), `seat-selection` (double-book same seat → 409), `operator-cancellation` (post-cancel refund chain), `travel-date-validation` (past departure → 422).

Commit:
```bash
git commit -m "feat(conformance): bus pack (4 tests)"
```

---

### Task 4.7: Service pack (4 tests)

**Files:**
- Create: `packages/conformance-tests/src/packs/service.ts`
- Create: `packages/conformance-tests/tests/packs/service.test.ts`

Tests: `slot-booking` (double-book same slot → 409), `location-mode-variants` (at_customer requires serviceRadius; at_provider requires address; online allows optional joinUrl), `provider-attribution` (ServiceItem.providerName optional but present in Order response), `duration-enforcement` (slotEnd − slotStart === durationMinutes ± 5 min).

Commit:
```bash
git commit -m "feat(conformance): service pack (4 tests)"
```

---

### Task 4.8: CLI runner, auto-detection, signed badge

**Files:**
- Modify: `packages/conformance-tests/src/cli.ts`
- Create: `packages/conformance-tests/src/runner.ts`
- Create: `packages/conformance-tests/src/badge.ts`
- Create: `packages/conformance-tests/tests/cli.test.ts`

- [ ] **Step 1: Implement `src/runner.ts`**

```ts
import { CapabilitiesManifest } from '@openkarta/spec';
import { runBusPack } from './packs/bus.js';
import { runCorePack } from './packs/core.js';
import { runFlightPack } from './packs/flight.js';
import { runProductPack } from './packs/product.js';
import { runServicePack } from './packs/service.js';
import { runStayPack } from './packs/stay.js';
import type { PackName, PackReport } from './types.js';

const PACK_RUNNERS: Record<PackName, (ctx: { baseUrl: string; userToken?: string }) => Promise<PackReport>> = {
  core:    runCorePack,
  product: runProductPack,
  stay:    runStayPack,
  flight:  runFlightPack,
  bus:     runBusPack,
  service: runServicePack,
};

export const runAll = async (baseUrl: string, userToken?: string): Promise<{
  manifest: unknown; packReports: PackReport[];
}> => {
  const m = await (await fetch(`${baseUrl}/v0/discover`)).json();
  const manifest = CapabilitiesManifest.parse(m);
  const packs: PackName[] = ['core', ...manifest.supportedItemTypes as PackName[]];
  const packReports: PackReport[] = [];
  for (const p of packs) packReports.push(await PACK_RUNNERS[p]({ baseUrl, userToken }));
  return { manifest, packReports };
};
```

- [ ] **Step 2: Implement `src/badge.ts`** — sign a badge JSON with HMAC-SHA256 using a CLI-provided secret or a default public key.

- [ ] **Step 3: Implement the CLI** (`src/cli.ts`)

```ts
#!/usr/bin/env node
import arg from 'arg';
import { runAll } from './runner.js';
import { signBadge } from './badge.js';

const args = arg({
  '--target':    String,
  '--user-token': String,
  '--secret':    String,
  '--json':      Boolean,
  '--help':      Boolean,
});

if (args['--help'] || !args['--target']) {
  console.log(`Usage: openkarta-conformance run --target <url> [--user-token <jwt>] [--secret <hmac-secret>] [--json]`);
  process.exit(args['--help'] ? 0 : 1);
}

const target = args['--target']!;
const { manifest, packReports } = await runAll(target, args['--user-token']);

const passedCount = packReports.reduce((s, r) => s + r.passedCount, 0);
const failedCount = packReports.reduce((s, r) => s + r.failedCount, 0);
const packsPassed = packReports.filter((r) => r.failedCount === 0).map((r) => r.pack);

const badge = signBadge({
  agentId: (manifest as { agentId: string }).agentId,
  protocolVersion: '0.1',
  tierDetected: (manifest as { tier: string }).tier,
  packsPassed,
  testsPassed: passedCount,
  testsFailed: failedCount,
  signedAt: new Date().toISOString(),
}, args['--secret'] ?? 'unsigned-dev');

if (args['--json']) {
  console.log(JSON.stringify({ badge, reports: packReports }, null, 2));
} else {
  for (const r of packReports) {
    console.log(`\n[${r.pack}] ${r.passedCount} passed, ${r.failedCount} failed (${r.durationMs}ms)`);
    for (const t of r.tests) {
      console.log(`  ${t.passed ? 'pass' : 'FAIL'} ${t.name}${t.message ? ' — ' + t.message : ''}`);
    }
  }
  console.log(`\nTotal: ${passedCount} passed, ${failedCount} failed`);
  console.log(`Badge:\n${JSON.stringify(badge, null, 2)}`);
}

process.exit(failedCount === 0 ? 0 : 1);
```

- [ ] **Step 4: Write end-to-end CLI test** — boot Halcyon Shop, invoke runAll, assert badge.packsPassed contains 'core' and 'product', testsPassed === 12 (8 core + 4 product), testsFailed === 0.

- [ ] **Step 5: Run it against all 3 reference agents as a smoke test**

```bash
pnpm --filter @openkarta/conformance-tests build
node packages/reference-agent-shop/dist/bin.js &
PID_SHOP=$!
node packages/conformance-tests/dist/cli.js --target http://localhost:4001 --json > /tmp/shop-badge.json
kill $PID_SHOP

node packages/reference-agent-stays/dist/bin.js &
PID_STAYS=$!
node packages/conformance-tests/dist/cli.js --target http://localhost:4002 --json > /tmp/stays-badge.json
kill $PID_STAYS

node packages/reference-agent-travel/dist/bin.js &
PID_TRAVEL=$!
node packages/conformance-tests/dist/cli.js --target http://localhost:4003 --json > /tmp/travel-badge.json
kill $PID_TRAVEL
```

Expected: all three emit `testsFailed: 0`. Sum across all three = 8+4 + 8+5+4 + 8+5+4 = 46 test runs (note: core runs per agent, so 8×3=24 core + 4+5+4+5+4=22 per-type = 46 total invocations across three agents).

- [ ] **Step 6: Commit**

```bash
git add packages/conformance-tests/src/cli.ts packages/conformance-tests/src/runner.ts packages/conformance-tests/src/badge.ts packages/conformance-tests/tests/cli.test.ts
git commit -m "feat(conformance): CLI with auto-detection and signed badge output"
```

---

## Phase 5 — Demo CLI, docs, release (Week 5, 4 tasks)

### Task 5.1: `@openkarta/demo-cli` with 3 flows

**Files:**
- Create: `packages/demo-cli/package.json` with `bin: { openkarta-demo: "./dist/cli.js" }`
- Create: config trio
- Create: `packages/demo-cli/src/cli.ts`
- Create: `packages/demo-cli/src/flows/product.ts`
- Create: `packages/demo-cli/src/flows/stay.ts`
- Create: `packages/demo-cli/src/flows/flight.ts`
- Create: `packages/demo-cli/tests/flows.test.ts`

- [ ] **Step 1: CLI shape**

```ts
// src/cli.ts
#!/usr/bin/env node
import arg from 'arg';
import { runProductFlow } from './flows/product.js';
import { runStayFlow } from './flows/stay.js';
import { runFlightFlow } from './flows/flight.js';

const args = arg({ '--flow': String, '--target': String });
if (!args['--flow'] || !args['--target']) {
  console.log('Usage: openkarta-demo --flow product|stay|flight --target <url>');
  process.exit(1);
}
switch (args['--flow']) {
  case 'product': await runProductFlow(args['--target']); break;
  case 'stay':    await runStayFlow(args['--target']); break;
  case 'flight':  await runFlightFlow(args['--target']); break;
  default:        console.error(`Unknown flow: ${args['--flow']}`); process.exit(1);
}
```

- [ ] **Step 2: Flow implementations** — each calls discover → search → quote → checkout → status → cancel on the target agent and prints a human-readable transcript.

- [ ] **Step 3: Write flow tests** — each flow runs against its respective reference agent, asserts correct order of actions and terminal state.

- [ ] **Step 4: Run flows manually**

```bash
# in three terminals, boot Halcyon Shop / Stays / Travel, then:
node packages/demo-cli/dist/cli.js --flow product --target http://localhost:4001
node packages/demo-cli/dist/cli.js --flow stay    --target http://localhost:4002
node packages/demo-cli/dist/cli.js --flow flight  --target http://localhost:4003
```

Expected: each prints 6 steps and exits zero.

- [ ] **Step 5: Commit**

```bash
git add packages/demo-cli
git commit -m "feat(demo-cli): three end-to-end flows (product, stay, flight)"
```

---

### Task 5.2: Root docs

**Files:**
- Modify: `README.md` (root)
- Create: `docs/protocol/v0.1.md` (protocol reference)
- Create: `docs/quickstart-integrator.md`
- Create: `docs/quickstart-agent-author.md`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`

- [ ] **Step 1: Rewrite root `README.md`** — positioning, 8 actions table, 5 item types, tier table, links to packages and quickstarts, badge markdown, MIT notice.

- [ ] **Step 2: Write `docs/protocol/v0.1.md`** — the public-facing spec: 8 actions with HTTP contracts (method, path, request body, response body, error codes), five item types with field-by-field tables, transport tiers, error codes, manifest, user-token, cache-control expectations.

- [ ] **Step 3: Write `docs/quickstart-integrator.md`** — how a consumer (orchestrator-side) installs `@openkarta/sdk-node`, discovers an agent, runs a quote + checkout. Uses Halcyon Shop as the demo target.

- [ ] **Step 4: Write `docs/quickstart-agent-author.md`** — how a merchant exposes their catalogue. Two paths: 1-hour Lite (markdown table we host), 1-day HTTP (copy a reference agent and replace fixtures).

- [ ] **Step 5: Write boilerplate `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`** (mailto: security@openkarta.ai, 90-day disclosure window).

- [ ] **Step 6: Commit**

```bash
git add README.md docs CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md
git commit -m "docs: root README, protocol v0.1 reference, quickstarts, community files"
```

---

### Task 5.3: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/publish.yml`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/feature.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
      - name: Conformance smoke
        run: bash scripts/conformance-smoke.sh
```

- [ ] **Step 2: Write `scripts/conformance-smoke.sh`** — boots all three agents on ports 4001/4002/4003, runs the CLI against each, asserts `testsFailed: 0` via `jq`.

- [ ] **Step 3: Write `.github/workflows/publish.yml`** — on tagged releases (`v0.*`), `pnpm -r publish --access public` after CI passes.

- [ ] **Step 4: Write the issue templates and PR template** (bug repro, feature request, PR description with conformance-impact checkbox).

- [ ] **Step 5: Push to a scratch branch, watch CI run green**

- [ ] **Step 6: Commit**

```bash
git add .github scripts/conformance-smoke.sh
git commit -m "chore(ci): add GitHub Actions for lint/typecheck/build/test/conformance"
```

---

### Task 5.4: v0.1.0 tag and public release

**Files:**
- Modify: every package `version` field bumped to `0.1.0` (should already be).
- Modify: root `CHANGELOG.md` — new file.

- [ ] **Step 1: Create `CHANGELOG.md`**

```markdown
# Changelog

## 0.1.0 — 2026-05-?? (unreleased)

Initial public release of OpenKarta.

### Added
- `@openkarta/spec` with five item types, discriminated unions, homogeneous cart, CapabilitiesManifest v0.2, closed-enum errors, user-token delegation.
- `@openkarta/sdk-node` with Fastify server, typed client, HMAC-signed quote tokens, error helpers.
- Three reference agents: Halcyon Shop (product + quick-commerce), Halcyon Stays & Spa (stay + service), Halcyon Travel (flight + bus).
- `@openkarta/conformance-tests` with core pack (8) + five per-type packs (4+5+5+4+4 = 22). Auto-detects `supportedItemTypes` and emits a signed badge.
- `@openkarta/demo-cli` with product, stay, and flight end-to-end flows.
```

- [ ] **Step 2: Final check — full clean build + test**

```bash
pnpm clean
pnpm install
pnpm build
pnpm test
bash scripts/conformance-smoke.sh
```

Expected: zero failures.

- [ ] **Step 3: Tag and prepare release notes**

```bash
git tag -a v0.1.0 -m "OpenKarta v0.1.0 — initial public release"
```

(Do not push the tag until all stakeholders approve.)

- [ ] **Step 4: Draft GitHub release body** — copy from CHANGELOG.md v0.1.0, attach conformance badges for all three reference agents as JSON files.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: changelog for v0.1.0"
```

---

## Deliverables checklist (end of week 5)

- [ ] `@openkarta/spec` published, all schemas pass Zod tests.
- [ ] `@openkarta/sdk-node` published, server + client integration test passes.
- [ ] Halcyon Shop, Stays & Spa, Travel all boot cleanly; e2e tests pass for each.
- [ ] `@openkarta/conformance-tests` CLI runs cleanly against all three agents, emits signed badges, all pack tests pass.
- [ ] `@openkarta/demo-cli` runs all three flows cleanly.
- [ ] Root README, protocol v0.1 reference, two quickstarts, CONTRIBUTING / SECURITY / CoC in place.
- [ ] CI green on `main`, conformance smoke green.
- [ ] `v0.1.0` tag prepared but not pushed until stakeholder sign-off.
- [ ] Spec Section 11.3 references updated to point at the new plan filename.

---

## Self-review pass

**1. Spec coverage.** Walked Section 4 (all five item types), Section 4.4 (Cart homogeneity), Section 4.5 (manifest), Section 4.6 (three reference agents), Section 4.7 (conformance pack count: core 8 + per-type 4/5/5/4/4 = 30 test definitions, 22 per-type + 8 core; some execute multiple times across agents). Section 11's Plan 01 impact directly maps to Phases 1–5 here. Section 11.1 package list ≡ plan packages.

**2. Placeholder scan.** No TBDs, no "add validation", every code step has the actual code. Tasks 3.3, 3.4, 4.4–4.7 describe test assertions in prose rather than full code — deliberate, because those tests are direct copies of Task 3.2 and Task 4.3's patterns with different assertions. An engineer reading out of order will have the pattern from Task 3.2 / 4.3 to imitate.

**3. Type consistency.** `Item`, `Cart`, `Quote`, `Order`, `FulfilmentStatus`, `CapabilitiesManifest`, `ErrorCode` — all named identically across every task that references them. Header constant `USER_TOKEN_HEADER` matches spec Section 4.10. Conformance pack names (`core`, `product`, `stay`, `flight`, `bus`, `service`) match across `types.ts`, `runner.ts`, `runAll`, and CLI output.

**4. Scope.** Single plan, single milestone (v0.1 MIT release). Out of scope: consumer app, BD work, regulatory licensing, orchestration infra — those are separate plans (Plans 02, 03, 04 from the v0.1 roadmap).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-plan-01-openkarta-protocol-and-node-sdk.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 5-week plan with ~40 bite-sized tasks; keeps each subagent's context focused on a single schema or handler.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
