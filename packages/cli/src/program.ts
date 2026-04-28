import { Command } from "commander";
import { cartCommand } from "./commands/cart.js";
import { chatCommand } from "./commands/chat.js";
import { checkoutCommand } from "./commands/checkout.js";
import { ordersCommand } from "./commands/orders.js";
import { searchCommand } from "./commands/search.js";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("openkarta")
    .description("OpenKarta consumer CLI — discover agents, build carts, check out")
    .version("0.2.0");

  program.addCommand(searchCommand());
  program.addCommand(cartCommand());
  program.addCommand(checkoutCommand());
  program.addCommand(ordersCommand());
  program.addCommand(chatCommand());
  return program;
}
