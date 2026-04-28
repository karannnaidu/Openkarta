#!/usr/bin/env node
import arg from "arg";
import { runFlightFlow } from "./flows/flight.js";
import { runProductFlow } from "./flows/product.js";
import { runStayFlow } from "./flows/stay.js";

const args = arg({ "--flow": String, "--target": String });
if (!args["--flow"] || !args["--target"]) {
  console.log("Usage: openkarta-demo --flow product|stay|flight --target <url>");
  process.exit(1);
}
switch (args["--flow"]) {
  case "product":
    await runProductFlow(args["--target"]);
    break;
  case "stay":
    await runStayFlow(args["--target"]);
    break;
  case "flight":
    await runFlightFlow(args["--target"]);
    break;
  default:
    console.error(`Unknown flow: ${args["--flow"]}`);
    process.exit(1);
}
