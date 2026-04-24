# Quickstart — Integrator

Five minutes from `npm install` to a confirmed order against the Halcyon Shop reference agent.

---

## 1. Install

```bash
npm install @openkarta/sdk-node @openkarta/spec
```

Node 22+ required (uses native `fetch`).

## 2. Boot a target agent

For this walkthrough we'll use Halcyon Shop, which ships in this monorepo. In a real integration this would be a public URL.

```bash
git clone https://github.com/openkarta/openkarta.git
cd openkarta
pnpm install && pnpm build
node packages/reference-agent-shop/dist/bin.js
# → [halcyon-shop] listening on http://0.0.0.0:4001
```

## 3. Discover the agent

```ts
import { createClient } from '@openkarta/sdk-node';

const c = createClient({ baseUrl: 'http://localhost:4001' });

const manifest = await c.discover() as {
  agentId: string;
  supportedItemTypes: string[];
  paymentRails: string[];
  tier: string;
};
console.log(manifest.agentId);             // 'halcyon-shop'
console.log(manifest.supportedItemTypes);  // ['product']
console.log(manifest.tier);                // 'http'
```

## 4. Search for items

```ts
const search = await c.search({ type: 'product' }) as {
  items: Array<{ id: string; title: string; priceMinor: number; currency: string }>;
};
console.log(`Found ${search.items.length} products`);
const itemId = search.items[0]!.id;
```

## 5. Build a cart and quote

```ts
const cart = {
  cartId: 'c_first_quote',
  lines:  [{ itemType: 'product', itemId, quantity: 1 }],
};

const quote = await c.quote(cart) as {
  quoteToken: string;
  totalMinor: number;
  currency:   string;
  expiresAt:  string;
  paymentOptions: Array<{ rail: string; methods: string[] }>;
};

console.log(`Quoted ${quote.totalMinor} ${quote.currency} until ${quote.expiresAt}`);
```

The `quoteToken` is HMAC-signed by the agent. Treat it as opaque and echo it back unmodified on checkout. It is bound to `(cartId, totalMinor, currency, expiresAt)` — tampering yields `quote_invalid`; using it after `expiresAt` yields `quote_expired`.

## 6. Check out

```ts
const order = await c.checkout({
  cart,
  payment:    { rail: 'razorpay_routes', method: 'upi' },
  quoteToken: quote.quoteToken,
}) as {
  orderId:          string;
  paymentStatus:    string;
  fulfilmentStatus: { state: string };
};

console.log(`Order ${order.orderId} — ${order.paymentStatus}, ${order.fulfilmentStatus.state}`);
```

## 7. Track and (optionally) cancel

```ts
const status = await c.status(order.orderId) as { fulfilmentStatus: { state: string } };
console.log(status.fulfilmentStatus.state);   // 'confirmed'

const cancelled = await c.cancel(order.orderId, 'user_cancelled') as {
  fulfilmentStatus: { state: string };
};
console.log(cancelled.fulfilmentStatus.state);  // 'cancelled'
```

---

## Handling errors

Every non-2xx response throws an `OpenKartaError` with a typed `code`:

```ts
import { OpenKartaError } from '@openkarta/sdk-node';

try {
  await c.checkout({ cart, payment, quoteToken: 'tampered' });
} catch (e) {
  if (e instanceof OpenKartaError) {
    if (e.code === 'quote_invalid' || e.code === 'quote_expired') {
      // re-quote and retry
    } else if (e.retryable) {
      // back off and retry
    } else {
      // surface the message to the user
    }
  }
}
```

The closed enum of error codes is defined in [`packages/spec/src/errors.ts`](../../packages/spec/src/errors.ts) and described in the [protocol reference](protocol/v0.1.md#errors).

## Delegating user identity

If the user has authorised your agent to act on their behalf (e.g. via OAuth), pass their JWT on the client:

```ts
const c = createClient({
  baseUrl:   'https://agent.example.com',
  userToken: '<JWT signed by your consumer-agent identity>',
});
```

The SDK puts it in `x-openkarta-user-token`. See [protocol reference — user-token delegation](protocol/v0.1.md#authentication--user-token-delegation) for the JWT payload contract.

## Next steps

- **Run the conformance harness** against any agent: `npx openkarta-conformance --target <url>`. Returns a signed badge; see [`packages/conformance-tests`](../packages/conformance-tests/).
- **Try the demo CLI** end-to-end across all three flows: `node packages/demo-cli/dist/cli.js --flow stay --target http://localhost:4002`.
- **Read the protocol reference**: [`docs/protocol/v0.1.md`](protocol/v0.1.md).
