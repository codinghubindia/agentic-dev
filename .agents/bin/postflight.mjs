#!/usr/bin/env node
/**
 * .agents/bin/postflight.mjs
 * Neural Orchestra v5.3 - Single-Call Post-Flight Verification Engine
 *
 * Replaces separate symbol indexing and quality gate runs with a single command (<1s):
 * 1. Incrementally updates AST symbol registry & progress ledger.
 * 2. Runs the full deterministic quality gate (git conflicts, typescript, UI craft,
 *    dependencies, engine immutability, and multi-language compiler checks).
 * 3. Returns a compact PASS/FAIL summary with exact file:line pointers if failed.
 */

import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

import {
  WORKSPACE_ROOT,
  PROGRESS_LEDGER_PATH,
  ensureExecDir
} from './paths.mjs';

import { runSymbolIndexer } from './symbol-indexer.mjs';
import { executeQualityGateChecks } from './quality-gate.mjs';

export async function runPostflight(args = process.argv.slice(2)) {
  const startTime = performance.now();
  ensureExecDir();

  const isJsonOnly = args.includes('--json');
  const rootDir = WORKSPACE_ROOT;

  // 1. Incremental Re-Index
  const indexResult = runSymbolIndexer(['--quiet']);
  const ledger = indexResult.ledger;

  // 2. Execute Quality Gate Checks
  const { report, targetReportPath, passed } = await executeQualityGateChecks(rootDir);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

  if (isJsonOnly) {
    process.stdout.write(JSON.stringify({
      passed,
      durationSec: parseFloat(elapsed),
      progress: ledger?.summary || {},
      qualityGate: report
    }, null, 2) + '\n');
    process.exit(passed ? 0 : 1);
  }

  const sep = '='.repeat(80);
  console.log(`\n${sep}`);
  console.log(`🛡️  NEURAL ORCHESTRA v5.3 - POST-FLIGHT VERIFICATION (${elapsed}s)`);
  console.log(sep);
  console.log(`Overall Status:   ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Quality Checks:   ${report.summary.passedChecks}/${report.summary.totalChecks} checks passed`);
  console.log(`Symbol Progress:  ${ledger?.summary?.doneCount || 0} [DONE] | ${ledger?.summary?.stubCount || 0} [STUB] (${ledger?.summary?.completionPercentage || '100%'})`);
  console.log(`Report Written:   ${path.relative(rootDir, targetReportPath).replace(/\\/g, '/')}`);

  if (!passed) {
    console.log('\n❌ VIOLATIONS DETECTED:');
    for (const check of report.checks) {
      if (!check.passed) {
        console.log(`\n  ✖ [${check.name}]`);
        for (const err of check.errors) {
          const loc = err.line ? `:${err.line}${err.column ? ':' + err.column : ''}` : '';
          console.log(`    - ${err.file}${loc} [${err.rule}]: ${err.message}`);
        }
      }
    }
    console.log(`\nFix the violations above and re-run: node .agents/bin/postflight.mjs\n${sep}\n`);
    process.exit(1);
  } else {
    console.log(`\n🎉 Verification clean. Zero violations. Engine immutability intact.`);
    console.log(`${sep}\n`);
    process.exit(0);
  }
}

if (process.argv[1] && process.argv[1].endsWith('postflight.mjs')) {
  runPostflight();
}
