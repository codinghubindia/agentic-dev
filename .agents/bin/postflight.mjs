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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import {
  WORKSPACE_ROOT,
  PROGRESS_LEDGER_PATH,
  WORKER_SLICES_PATH,
  ensureExecDirs
} from './paths.mjs';

import { runSymbolIndexer } from './symbol-indexer.mjs';
import { executeQualityGateChecks } from './quality-gate.mjs';

export async function runPostflight(args = process.argv.slice(2)) {
  const startTime = performance.now();
  ensureExecDirs();

  const isJsonOnly = args.includes('--json');
  const rootDir = WORKSPACE_ROOT;

  let workerId = null;
  let role = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--worker' && args[i + 1]) {
      workerId = args[++i];
    } else if (args[i] === '--role' && args[i + 1]) {
      role = args[++i];
    }
  }

  // 1. Incremental Re-Index
  const indexResult = runSymbolIndexer(['--quiet']);
  const ledger = indexResult.ledger;

  // 2. Worker Boundary Verification (if --worker flag is provided)
  let workerViolation = null;
  if (workerId) {
    try {
      if (fs.existsSync(WORKER_SLICES_PATH)) {
        const slicesData = JSON.parse(fs.readFileSync(WORKER_SLICES_PATH, 'utf8'));
        const slice = slicesData.slices?.[workerId] || slicesData[workerId];
        if (slice && slice.allowedWritePaths && slice.allowedWritePaths.length > 0) {
          const gitStatus = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
          const modifiedFiles = gitStatus.split('\n')
            .filter(l => l.trim())
            .map(l => l.substring(3).trim());

          for (const f of modifiedFiles) {
            const normF = f.replace(/\\/g, '/');
            const allowed = slice.allowedWritePaths.some(p => normF.startsWith(p.replace(/\\/g, '/')));
            if (!allowed) {
              workerViolation = `File '${normF}' violates boundary: outside worker '${workerId}' allowedWritePaths [${slice.allowedWritePaths.join(', ')}]`;
              break;
            }
          }
        }
      }
    } catch {
      // non-fatal if git or slices file not available
    }
  }

  // 3. Execute Quality Gate Checks
  const { report, targetReportPath, passed: gatePassed } = await executeQualityGateChecks(rootDir);

  let passed = gatePassed;
  if (workerViolation) {
    passed = false;
    report.summary.passedChecks = Math.max(0, report.summary.passedChecks - 1);
    report.checks.push({
      name: 'Worker Slice Boundary Enforcement',
      passed: false,
      errors: [{ file: workerId, line: null, column: null, rule: 'worker-slice-boundary', message: workerViolation }]
    });
  }

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
