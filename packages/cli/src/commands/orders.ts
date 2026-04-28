import {
  cancelOrder,
  createOrderStore,
  getOrderStatus,
  returnOrder,
} from "@openkarta/orchestrator";
import { Command } from "commander";
import { info, ok, error as printError } from "../output.js";
import { ORDERS_FILE } from "../storage.js";

const store = () => createOrderStore({ ordersFile: ORDERS_FILE });

export function ordersCommand(): Command {
  const c = new Command("orders").description("Manage placed orders");

  c.command("list")
    .description("List locally tracked orders")
    .action(async () => {
      const all = await store().list();
      if (all.length === 0) {
        info("no orders yet");
        return;
      }
      for (const o of all) {
        process.stdout.write(`${o.orderId}\t${o.agentId}\t${o.itemType}\t${o.placedAt}\n`);
      }
    });

  c.command("status <orderId>")
    .description("Read the latest fulfilment status")
    .action(async (orderId: string) => {
      try {
        const order = await getOrderStatus(orderId, { store: store() });
        process.stdout.write(`${JSON.stringify(order, null, 2)}\n`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });

  c.command("cancel <orderId>")
    .description("Cancel an order")
    .requiredOption("--reason <text>", "why cancel")
    .action(async (orderId: string, opts: { reason: string }) => {
      try {
        const order = await cancelOrder(orderId, opts.reason, { store: store() });
        ok(`payment: ${order.paymentStatus}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });

  c.command("return <orderId>")
    .description("Initiate a return")
    .requiredOption("--reason <text>", "why return")
    .action(async (orderId: string, opts: { reason: string }) => {
      try {
        const refund = await returnOrder(orderId, opts.reason, { store: store() });
        ok(`refund ${refund.refundId}: ${refund.status}`);
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });

  return c;
}
