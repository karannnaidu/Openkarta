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
      reply.header('cache-control', 'public, max-age=300');
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
