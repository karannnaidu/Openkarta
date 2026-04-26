#!/usr/bin/env node
import arg from 'arg';
import chalk from 'chalk';
import { runAll } from './runner.js';
import { signBadge } from './badge.js';
import type { PackName } from './types.js';

const args = arg({
  '--target':     String,
  '--user-token': String,
  '--secret':     String,
  '--json':       Boolean,
  '--help':       Boolean,
});

if (args['--help'] || !args['--target']) {
  console.log(`Usage: openkarta-conformance run --target <url> [--user-token <jwt>] [--secret <hmac-secret>] [--json]`);
  process.exit(args['--help'] ? 0 : 1);
}

const target = args['--target']!;
const { manifest, packReports } = await runAll(target, args['--user-token']);

const passedCount = packReports.reduce((s, r) => s + r.passedCount, 0);
const failedCount = packReports.reduce((s, r) => s + r.failedCount, 0);
const packsPassed: PackName[] = packReports.filter((r) => r.failedCount === 0).map((r) => r.pack);

const badge = signBadge({
  agentId:         manifest.agentId,
  protocolVersion: '0.1',
  tierDetected:    manifest.tier,
  packsPassed,
  testsPassed:     passedCount,
  testsFailed:     failedCount,
  signedAt:        new Date().toISOString(),
}, args['--secret'] ?? 'unsigned-dev');

if (args['--json']) {
  console.log(JSON.stringify({ badge, reports: packReports }, null, 2));
} else {
  for (const r of packReports) {
    console.log(`\n[${chalk.cyan(r.pack)}] ${chalk.green(r.passedCount + ' passed')}, ${r.failedCount > 0 ? chalk.red(r.failedCount + ' failed') : '0 failed'} (${r.durationMs}ms)`);
    for (const t of r.tests) {
      const tag = t.passed ? chalk.green('pass') : chalk.red('FAIL');
      console.log(`  ${tag} ${t.name}${t.message ? ' — ' + chalk.dim(t.message) : ''}`);
    }
  }
  console.log(`\nTotal: ${chalk.green(passedCount + ' passed')}, ${failedCount > 0 ? chalk.red(failedCount + ' failed') : '0 failed'}`);
  console.log(`Badge:\n${JSON.stringify(badge, null, 2)}`);
}

process.exit(failedCount === 0 ? 0 : 1);
