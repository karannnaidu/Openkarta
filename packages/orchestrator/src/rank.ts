import type { RankedResult } from './types.js';

export type RankStrategy = (a: RankedResult, b: RankedResult) => number;

export const lowestPriceFirst: RankStrategy = (a, b) => {
  const pa = (a.item as { priceMinor?: number }).priceMinor ?? Number.MAX_SAFE_INTEGER;
  const pb = (b.item as { priceMinor?: number }).priceMinor ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return a.agentId.localeCompare(b.agentId);
};

export function rankResults(results: RankedResult[], strategy: RankStrategy = lowestPriceFirst): RankedResult[] {
  const sorted = [...results].sort(strategy);
  const n = sorted.length;
  // Deterministic score: higher = ranked earlier. Useful for downstream callers.
  for (let i = 0; i < n; i++) sorted[i]!.rankScore = n - i;
  return sorted;
}
