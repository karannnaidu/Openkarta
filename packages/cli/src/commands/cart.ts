import { type OrchestratorCart, addLine, newCart } from "@openkarta/orchestrator";
import type { ItemType } from "@openkarta/spec";
import { Command } from "commander";
import { info, ok, error as printError } from "../output.js";
import { clearState, readState, writeState } from "../storage.js";

async function loadCart(): Promise<OrchestratorCart | null> {
  const s = await readState();
  return (s as { cart?: OrchestratorCart } | null)?.cart ?? null;
}

async function saveCart(cart: OrchestratorCart): Promise<void> {
  await writeState({ cart });
}

export function cartCommand(): Command {
  const c = new Command("cart").description("Manage the local cart");

  c.command("init")
    .description("Initialise an empty cart bound to an agent + item type")
    .requiredOption("--agent-id <id>", "agentId from a search result")
    .requiredOption("--base-url <url>", "agent baseUrl")
    .requiredOption("--type <itemType>", "product | stay | flight | bus | service")
    .option("--currency <code>", "currency code", "INR")
    .action(async (opts: { agentId: string; baseUrl: string; type: string; currency: string }) => {
      const cart = newCart({
        agentId: opts.agentId,
        agentBaseUrl: opts.baseUrl,
        itemType: opts.type as ItemType,
        currency: opts.currency,
      });
      await saveCart(cart);
      ok(`new cart for ${opts.agentId} (${opts.type})`);
    });

  c.command("add")
    .description("Add a line to the current cart")
    .requiredOption("--item-id <id>", "itemId from a search result")
    .option("-n, --quantity <n>", "quantity", "1")
    .action(async (opts: { itemId: string; quantity: string }) => {
      const cart = await loadCart();
      if (!cart) {
        printError('no cart — run "openkarta cart init" first');
        process.exitCode = 1;
        return;
      }
      const updated = addLine(cart, {
        itemId: opts.itemId,
        quantity: Number.parseInt(opts.quantity, 10),
      });
      await saveCart(updated);
      ok(`added ${opts.quantity} × ${opts.itemId} (${updated.lines.length} lines total)`);
    });

  c.command("show")
    .description("Print the current cart")
    .action(async () => {
      const cart = await loadCart();
      if (!cart) {
        info("cart is empty");
        return;
      }
      process.stdout.write(`${JSON.stringify(cart, null, 2)}\n`);
    });

  c.command("clear")
    .description("Clear the current cart")
    .action(async () => {
      await clearState();
      ok("cart cleared");
    });

  return c;
}
