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
