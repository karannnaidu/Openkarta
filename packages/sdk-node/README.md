# @openkarta/sdk-node

Node 22+ SDK for OpenKarta v0.1.

- `createServer({ handlers, secret })` — Fastify app wiring the 8 protocol actions. Handlers throw `{ code: ErrorCode }` to produce deterministic error responses.
- `createClient({ baseUrl, timeoutMs?, userToken?, fetchImpl? })` — typed HTTP client wrapping all 8 verbs. Returns spec-typed values (`CapabilitiesManifest`, `Quote`, `Order`, `Refund`, …) and exposes the configured `baseUrl`. Failures raise `OpenKartaError` with `{ code, httpStatus, message, details? }`. Per-call `timeoutMs` aborts long-running requests via `AbortController`.
- `signQuoteToken(payload, secret)` / `verifyQuoteToken(token, secret)` — HMAC-SHA256, expiry-aware.
- `toErrorResponse(code, message, retryable, details)` — turn an `ErrorCode` into a `{ status, body }` pair.

## Install

```bash
pnpm add @openkarta/sdk-node @openkarta/spec zod fastify
```
