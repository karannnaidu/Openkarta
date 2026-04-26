# @openkarta/orchestrator

Embed the OpenKarta consumer flow in any Node app.

## Install

```bash
npm install @openkarta/orchestrator
```

## Quick start

```ts
import {
  createOrchestrator,
  newCart, addLine,
  quoteCart, checkoutCart,
  createOrderStore,
} from '@openkarta/orchestrator';

const orch = createOrchestrator();   // uses the public registry by default

const results = await orch.search({
  itemType: 'product',
  q: 'coffee',
  region: { country: 'IN' },
});
const top = results[0]!;

let cart = newCart({
  agentId: top.agentId,
  agentBaseUrl: top.manifest.baseUrl,
  itemType: 'product',
  currency: 'INR',
});
cart = addLine(cart, { itemId: top.item.id, quantity: 1 });

const quote = await quoteCart(cart);
const order = await checkoutCart({
  cart, quote,
  payment: { method: 'cod' },
  store: createOrderStore(),
});
console.log('placed', order.orderId);
```

## API

- `createOrchestrator(opts)` — factory. Pass `registryUrl`, `cacheTtlMs`, `perAgentTimeoutMs`, etc.
- `newCart`, `addLine` — immutable cart builder; carts are bound to a single agent + item type.
- `quoteCart(cart)` — returns a `Quote` with a signed `quoteToken`. Pass it to `checkoutCart` unchanged.
- `checkoutCart({ cart, quote, payment, store })` — places the order. The store records it locally.
- `getOrderStatus`, `cancelOrder`, `returnOrder` — order lifecycle, all keyed by `orderId`.
- `chatOnce(history, dispatch, { baseURL, model, apiKey? })` — generic chat-completions tool loop. Point `baseURL` at any endpoint that speaks the standard `chat/completions` wire format: hosted (OpenRouter, OpenAI, Together, Groq, …) or local (Ollama, llama.cpp, vLLM, …). `apiKey` is optional for local servers. Combine with `createDispatcher` and `newState` for a multi-turn REPL.

See [`docs/protocol/v0.1.md`](protocol/v0.1.md) for the wire contract this composes.
