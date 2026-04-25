import type { OrchestratorOptions, SearchPlan, RankedResult, RegistrySnapshot } from './types.js';
import { loadRegistry, filterAgents, DEFAULT_REGISTRY_URL, type AgentFilter } from './registry.js';
import { createManifestCache } from './discover.js';
import { searchAcrossAgents } from './search.js';
import { rankResults, lowestPriceFirst, type RankStrategy } from './rank.js';

export interface Orchestrator {
  search(plan: SearchPlan, ranker?: RankStrategy): Promise<RankedResult[]>;
}

export function createOrchestrator(opts: OrchestratorOptions = {}): Orchestrator {
  const cache = createManifestCache({
    ...(opts.cacheTtlMs !== undefined ? { ttlMs: opts.cacheTtlMs } : {}),
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    ...(opts.perAgentTimeoutMs !== undefined ? { perAgentTimeoutMs: opts.perAgentTimeoutMs } : {}),
  });

  let registryPromise: Promise<RegistrySnapshot> | null = opts.registry
    ? Promise.resolve(opts.registry)
    : null;

  async function getRegistry(): Promise<RegistrySnapshot> {
    if (registryPromise) return registryPromise;
    registryPromise = loadRegistry({
      url: opts.registryUrl ?? DEFAULT_REGISTRY_URL,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    });
    return registryPromise;
  }

  return {
    async search(plan, ranker = lowestPriceFirst) {
      const reg = await getRegistry();
      const filter: AgentFilter = {
        itemType: plan.itemType,
        ...(plan.region?.country ? { country: plan.region.country } : {}),
        ...(plan.region?.city ? { city: plan.region.city } : {}),
        ...(plan.region?.pincode ? { pincode: plan.region.pincode } : {}),
        ...(plan.agentIds ? { agentIds: plan.agentIds } : {}),
      };
      const agents = filterAgents(reg.agents, filter);
      const results = await searchAcrossAgents({
        agents,
        plan,
        manifestCache: cache,
        ...(opts.perAgentTimeoutMs !== undefined ? { perAgentTimeoutMs: opts.perAgentTimeoutMs } : {}),
        ...(opts.searchConcurrency !== undefined ? { concurrency: opts.searchConcurrency } : {}),
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      });
      return rankResults(results, ranker);
    },
  };
}
