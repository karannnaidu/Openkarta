import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@openkarta/sdk-node';
import { bootAgent as bootShop, loadFixtures as fxShop } from '@openkarta/reference-agent-shop/src/agent';
import { bootAgent as bootStays, loadFixtures as fxStays } from '@openkarta/reference-agent-stays/src/agent';
import { bootAgent as bootTravel, loadFixtures as fxTravel } from '@openkarta/reference-agent-travel/src/agent';
import { executeProductFlow } from '../src/flows/product';
import { executeStayFlow } from '../src/flows/stay';
import { executeFlightFlow } from '../src/flows/flight';

const secret = 'x'.repeat(32);
let shopUrl = '', staysUrl = '', travelUrl = '';

beforeAll(async () => {
  shopUrl   = await bootShop(fxShop('./fixtures'),     0, secret);
  staysUrl  = await bootStays(fxStays('./fixtures'),   0, secret);
  travelUrl = await bootTravel(fxTravel('./fixtures'), 0, secret);
});

const expectedSequence = ['discover', 'search', 'quote', 'checkout', 'status', 'cancel'];

describe('demo-cli flows against reference agents', () => {
  it('product flow completes 6 steps and reaches cancelled state', async () => {
    const c = createClient({ baseUrl: shopUrl });
    const steps = await executeProductFlow(c);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.action)).toEqual(expectedSequence);
    const checkout = steps[3]!;
    expect(checkout.detail.paymentStatus).toBe('authorized');
    const cancelled = steps[5]!;
    expect(cancelled.summary).toContain('cancelled');
    const orderId = checkout.summary.replace('order ', '');
    expect(orderId).toMatch(/^ord_/);
  });

  it('stay flow completes 6 steps and reaches cancelled state', async () => {
    const c = createClient({ baseUrl: staysUrl });
    const steps = await executeStayFlow(c);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.action)).toEqual(expectedSequence);
    const checkout = steps[3]!;
    expect(checkout.detail.paymentStatus).toBe('authorized');
    const cancelled = steps[5]!;
    expect(cancelled.summary).toContain('cancelled');
    const orderId = checkout.summary.replace('order ', '');
    expect(orderId).toMatch(/^ord_/);
  });

  it('flight flow completes 6 steps and reaches cancelled state', async () => {
    const c = createClient({ baseUrl: travelUrl });
    const steps = await executeFlightFlow(c);
    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.action)).toEqual(expectedSequence);
    const checkout = steps[3]!;
    expect(checkout.detail.paymentStatus).toBe('authorized');
    const cancelled = steps[5]!;
    expect(cancelled.summary).toContain('cancelled');
    const orderId = checkout.summary.replace('order ', '');
    expect(orderId).toMatch(/^ord_/);
  });
});
