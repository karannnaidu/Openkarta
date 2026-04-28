import { createClient } from "@openkarta/sdk-node";
import type { SearchQuery } from "@openkarta/spec";
import type { ManifestCache } from "./discover.js";
import type { RankedResult, RegistryAgent, SearchPlan } from "./types.js";

export interface SearchInput {
  agents: RegistryAgent[];
  plan: SearchPlan;
  manifestCache: ManifestCache;
  perAgentTimeoutMs?: number;
  concurrency?: number;
  fetchImpl?: typeof fetch;
}

export async function searchAcrossAgents(input: SearchInput): Promise<RankedResult[]> {
  const concurrency = Math.max(1, input.concurrency ?? 5);
  const timeoutMs = input.perAgentTimeoutMs ?? 8_000;
  const queue = [...input.agents];
  const results: RankedResult[] = [];

  async function worker() {
    while (queue.length > 0) {
      const agent = queue.shift();
      if (!agent) return;
      try {
        const manifest = await input.manifestCache.get(agent.baseUrl);
        const client = createClient({
          baseUrl: agent.baseUrl,
          timeoutMs,
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        });
        const query = buildQuery(input.plan);
        const res = await client.search(query);
        for (const item of res.items) {
          results.push({
            agentId: agent.agentId,
            agentDisplayName: agent.displayName,
            manifest,
            item,
            rankScore: 0,
          });
        }
      } catch {
        // dead/timeout agents are silently dropped — observable via metrics, not exceptions
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// SearchQuery is a discriminated union on `type`; cast lets each agent handle unknown sub-fields.
// `plan.extra` carries vertical-specific required fields (e.g. checkIn/checkOut for stays,
// origin/destination for flights) that are merged in before the wire call.
function buildQuery(plan: SearchPlan): SearchQuery {
  return {
    ...plan.extra,
    type: plan.itemType,
    q: plan.q,
    region: plan.region,
  } as SearchQuery;
}
