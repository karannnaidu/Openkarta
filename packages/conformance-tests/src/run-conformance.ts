import { signBadge } from './badge.js';
import { runAll } from './runner.js';
import type { Badge, PackName } from './types.js';

const BADGE_SECRET_DEFAULT = process.env.OPENKARTA_BADGE_SECRET ?? 'unsigned-dev';

export interface RunConformanceOptions {
  baseUrl: string;
  userToken?: string;
  badgeSecret?: string;
}

export interface ConformanceResult {
  passed: boolean;
  testsPassed: number;
  testsFailed: number;
  packs: PackName[];
  errorSummary?: string;
  signedBadge: Badge;
}

export async function runConformance(opts: RunConformanceOptions): Promise<ConformanceResult> {
  const { manifest, packReports } = await runAll(opts.baseUrl, opts.userToken);
  const testsPassed = packReports.reduce((s, r) => s + r.passedCount, 0);
  const testsFailed = packReports.reduce((s, r) => s + r.failedCount, 0);
  const packsPassed: PackName[] = packReports.filter((r) => r.failedCount === 0).map((r) => r.pack);
  const passed = testsFailed === 0;

  const failures = packReports.flatMap((r) =>
    r.tests.filter((t) => !t.passed).map((t) => `${r.pack}/${t.name}: ${t.message ?? 'failed'}`),
  );
  const errorSummary = failures.length > 0 ? failures.slice(0, 5).join('; ') : undefined;

  const signedBadge = signBadge(
    {
      agentId: manifest.agentId,
      protocolVersion: '0.1',
      tierDetected: manifest.tier,
      packsPassed,
      testsPassed,
      testsFailed,
      signedAt: new Date().toISOString(),
    },
    opts.badgeSecret ?? BADGE_SECRET_DEFAULT,
  );

  const out: ConformanceResult = {
    passed,
    testsPassed,
    testsFailed,
    packs: packReports.map((r) => r.pack),
    signedBadge,
  };
  if (errorSummary !== undefined) out.errorSummary = errorSummary;
  return out;
}
