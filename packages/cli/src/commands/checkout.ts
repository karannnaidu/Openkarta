import { Command } from 'commander';
import { quoteCart, checkoutCart, createOrderStore, type OrchestratorCart } from '@openkarta/orchestrator';
import { readState, ORDERS_FILE } from '../storage.js';
import { info, ok, error as printError, formatPrice } from '../output.js';

export function checkoutCommand(): Command {
  return new Command('checkout')
    .description('Quote the cart and place the order')
    .requiredOption('--payment <method>', 'cod | razorpay_routes | stripe_connect | …')
    .option('--payment-ref <ref>', 'optional payment reference')
    .option('-y, --yes', 'skip the price-confirmation prompt', false)
    .action(async (opts: { payment: string; paymentRef?: string; yes: boolean }) => {
      try {
        const s = await readState();
        const cart = (s as { cart?: OrchestratorCart } | null)?.cart;
        if (!cart || cart.lines.length === 0) {
          printError('cart is empty');
          process.exitCode = 1;
          return;
        }

        info('quoting cart…');
        const q = await quoteCart(cart);
        info(`total: ${formatPrice(q.totalMinor, q.currency)} (expires ${q.expiresAt})`);

        if (!opts.yes) {
          info('re-run with --yes to confirm');
          return;
        }

        const store = createOrderStore({ ordersFile: ORDERS_FILE });
        const order = await checkoutCart({
          cart,
          quote: q,
          payment: {
            method: opts.payment,
            ...(opts.paymentRef ? { ref: opts.paymentRef } : {}),
          },
          store,
        });
        ok(`placed: ${order.orderId}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });
}
