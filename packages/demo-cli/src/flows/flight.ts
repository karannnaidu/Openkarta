import { type Client, createClient } from '@openkarta/sdk-node';
import { type TranscriptStep, printTranscript } from '../transcript.js';

interface Manifest    { agentId: string; supportedItemTypes: string[]; tier: string }
interface SearchRes   { items: Array<{ id: string; title: string }> }
interface QuoteRes    { quoteToken: string; totalMinor: number; currency: string; expiresAt: string }
interface OrderRes    { orderId: string; paymentStatus: string; fulfilmentStatus: { state: string } }

export const executeFlightFlow = async (c: Client): Promise<TranscriptStep[]> => {
  const steps: TranscriptStep[] = [];

  const manifest = (await c.discover()) as Manifest;
  steps.push({
    step: 1, action: 'discover',
    summary: `agent ${manifest.agentId} (tier=${manifest.tier})`,
    detail: { supportedItemTypes: manifest.supportedItemTypes },
  });

  const search = (await c.search({
    type:        'flight',
    origin:      'BLR',
    destination: 'BOM',
    departure:   '2026-05-10',
    pax:         1,
  })) as SearchRes;
  const itemId = search.items[0]!.id;
  steps.push({
    step: 2, action: 'search',
    summary: `${search.items.length} flights found`,
    detail: { firstItemId: itemId, firstTitle: search.items[0]!.title },
  });

  const cart = {
    cartId: `c_${Math.random().toString(36).slice(2, 8)}`,
    lines: [{
      itemType:   'flight' as const,
      itemId,
      passengers: [{ firstName: 'Karan', lastName: 'Singh' }],
    }],
  };
  const quote = (await c.quote(cart)) as QuoteRes;
  steps.push({
    step: 3, action: 'quote',
    summary: `total ${quote.totalMinor} ${quote.currency}`,
    detail: { expiresAt: quote.expiresAt, quoteToken: `${quote.quoteToken.slice(0, 12)}…` },
  });

  const order = (await c.checkout({ cart, payment: { rail: 'razorpay_routes', method: 'upi' }, quoteToken: quote.quoteToken })) as OrderRes;
  steps.push({
    step: 4, action: 'checkout',
    summary: `order ${order.orderId}`,
    detail: { paymentStatus: order.paymentStatus, state: order.fulfilmentStatus.state },
  });

  const status = (await c.status(order.orderId)) as OrderRes;
  steps.push({
    step: 5, action: 'status',
    summary: `state ${status.fulfilmentStatus.state}`,
    detail: { orderId: order.orderId },
  });

  const cancelled = (await c.cancel(order.orderId, 'user_cancelled')) as OrderRes;
  steps.push({
    step: 6, action: 'cancel',
    summary: `state ${cancelled.fulfilmentStatus.state}`,
    detail: { orderId: order.orderId, reason: 'user_cancelled' },
  });

  return steps;
};

export const runFlightFlow = async (target: string): Promise<void> => {
  const c = createClient({ baseUrl: target });
  const steps = await executeFlightFlow(c);
  printTranscript(`Flight flow → ${target}`, steps);
};
