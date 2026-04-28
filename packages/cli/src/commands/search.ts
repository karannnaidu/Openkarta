import { createOrchestrator } from "@openkarta/orchestrator";
import type { ItemType } from "@openkarta/spec";
import { Command } from "commander";
import { info, error as printError, searchTable } from "../output.js";

export function searchCommand(): Command {
  return new Command("search")
    .description("Search across registered OpenKarta agents")
    .requiredOption("-t, --type <itemType>", "product | stay | flight | bus | service")
    .option("-q, --query <text>", "Free-text query")
    .option("--country <code>", "Two-letter country code, e.g. IN")
    .option("--city <name>", "City filter")
    .option("--pincode <code>", "Pincode filter")
    .option("--registry <url>", "Override registry URL")
    .action(
      async (opts: {
        type: string;
        query?: string;
        country?: string;
        city?: string;
        pincode?: string;
        registry?: string;
      }) => {
        try {
          const orch = createOrchestrator(opts.registry ? { registryUrl: opts.registry } : {});
          const results = await orch.search({
            itemType: opts.type as ItemType,
            ...(opts.query ? { q: opts.query } : {}),
            ...(opts.country
              ? {
                  region: {
                    country: opts.country,
                    ...(opts.city ? { city: opts.city } : {}),
                    ...(opts.pincode ? { pincode: opts.pincode } : {}),
                  },
                }
              : {}),
          });
          if (results.length === 0) {
            info("no results");
            return;
          }
          process.stdout.write(
            `\n${searchTable(
              results.map((r) => ({
                agentId: r.agentId,
                agentDisplayName: r.agentDisplayName,
                itemId: r.item.id,
                title: r.item.title,
                priceMinor: r.item.priceMinor,
                currency: r.item.currency,
              })),
            )}\n\n`,
          );
        } catch (err) {
          printError(err instanceof Error ? err.message : String(err));
          process.exitCode = 1;
        }
      },
    );
}
