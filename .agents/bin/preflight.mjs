#!/usr/bin/env node
/**
 * .agents/bin/preflight.mjs
 * Neural Orchestra v5.3 - Single-Call Pre-Flight Context Engine
 *
 * Replaces 4 sequential discovery tool calls (onboard-project + symbol-indexer +
 * skill-loader + code-query) with a single deterministic invocation (<40ms).
 *
 * In a single Node process (using direct in-memory ES module imports):
 * 1. Ensures .agent_execution/ runtime layout exists and is self-ignoring.
 * 2. Runs incremental onboard-project (checking manifest freshness).
 * 3. Runs incremental symbol-indexer (SHA-1 cached AST indexing).
 * 4. Resolves 1-3 task-scoped micro-skill shards via skill-loader.
 * 5. Outputs a consolidated Delta Manifest with DNA summary, active rules,
 *    relevant [STUB] symbols, and existing signatures so the agent can code immediately.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

import {
  WORKSPACE_ROOT,
  PROJECT_DNA_PATH,
  SYMBOL_REGISTRY_PATH,
  PROGRESS_LEDGER_PATH,
  FILE_RESPONSIBILITY_INDEX_PATH,
  ensureExecDir
} from './paths.mjs';

import { runOnboard } from './onboard-project.mjs';
import { runSymbolIndexer } from './symbol-indexer.mjs';
import { loadManifest, resolveShards, getShardContents } from './skill-loader.mjs';

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(rawArgs = process.argv.slice(2)) {
  const options = {
    task: '',
    file: '',
    role: '',
    json: false,
    force: false,
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--task' && rawArgs[i + 1]) {
      options.task = rawArgs[++i];
    } else if (arg === '--file' && rawArgs[i + 1]) {
      options.file = rawArgs[++i];
    } else if (arg === '--role' && rawArgs[i + 1]) {
      options.role = rawArgs[++i];
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node .agents/bin/preflight.mjs [options]

Options:
  --task <desc>    Task description (required for accurate skill & symbol matching)
  --file <path>    Target file path to inspect or modify
  --role <role>    Macro role name override
  --force          Force regeneration of DNA and symbol registry
  --json           Output raw JSON Delta Manifest
  -h, --help       Show this help message

Examples:
  node .agents/bin/preflight.mjs --task "Add cancel order endpoint" --file "src/routes/orders.ts"
  node .agents/bin/preflight.mjs --task "Build user profile modal"
`);
      process.exit(0);
    }
  }

  return options;
}

export function runPreflight(args = process.argv.slice(2)) {
  const startTime = performance.now();
  const options = parseArgs(args);

  // 1. Ensure runtime environment
  ensureExecDir();

  // 2. Incremental Onboarding
  const onboardArgs = ['--quiet'];
  if (options.force) onboardArgs.push('--force');
  runOnboard(onboardArgs);

  // 3. Incremental Symbol Indexing
  const indexerArgs = ['--quiet'];
  if (options.force) indexerArgs.push('--force');
  const indexResult = runSymbolIndexer(indexerArgs);

  // 4. Load & Resolve Skills
  const manifest = loadManifest();
  const selectedShards = resolveShards(manifest, options);
  if (selectedShards.length === 0) {
    selectedShards.push('arch-intake-scope.md');
  }
  const shardContents = getShardContents(selectedShards);

  // 5. Read project state
  const dna = readJsonSafe(PROJECT_DNA_PATH) || {};
  const responsibilityIndex = readJsonSafe(FILE_RESPONSIBILITY_INDEX_PATH) || { files: {} };
  const ledger = indexResult.ledger || readJsonSafe(PROGRESS_LEDGER_PATH) || { stubs: [], done: [] };
  const registry = indexResult.registry || readJsonSafe(SYMBOL_REGISTRY_PATH) || { files: {} };

  // 6. Infer Role
  let assignedRole = options.role;
  if (!assignedRole && options.file) {
    const normFile = options.file.replace(/\\/g, '/');
    assignedRole = responsibilityIndex.files?.[normFile]?.owner;
  }
  if (!assignedRole && options.task) {
    const taskLower = options.task.toLowerCase();
    if (taskLower.includes('ui') || taskLower.includes('component') || taskLower.includes('screen') || taskLower.includes('css')) {
      assignedRole = 'fullstack-frontend-engineer';
    } else if (taskLower.includes('schema') || taskLower.includes('migration') || taskLower.includes('sql') || taskLower.includes('db')) {
      assignedRole = 'data-platform-engineer';
    } else if (taskLower.includes('rag') || taskLower.includes('llm') || taskLower.includes('embedding') || taskLower.includes('vector')) {
      assignedRole = 'ai-rag-engineer';
    } else if (taskLower.includes('flutter') || taskLower.includes('mobile') || taskLower.includes('push')) {
      assignedRole = 'mobile-engineer';
    } else if (taskLower.includes('test') || taskLower.includes('audit') || taskLower.includes('security') || taskLower.includes('e2e')) {
      assignedRole = 'qa-security-verifier';
    } else if (taskLower.includes('docker') || taskLower.includes('ci') || taskLower.includes('deploy') || taskLower.includes('release')) {
      assignedRole = 'devops-release-engineer';
    } else if (taskLower.includes('contract') || taskLower.includes('intake') || taskLower.includes('architecture')) {
      assignedRole = 'principal-architect';
    } else {
      assignedRole = 'fullstack-backend-engineer';
    }
  }

  // 7. Find task-relevant stubs & symbols
  const normTarget = options.file ? options.file.replace(/\\/g, '/') : null;
  const allStubs = ledger.stubs || [];
  let relevantStubs = [];

  if (normTarget) {
    relevantStubs = allStubs.filter(s => s.ref.startsWith(normTarget));
  }
  if (relevantStubs.length === 0 && options.task) {
    const keywords = options.task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    relevantStubs = allStubs.filter(s => {
      const matchText = (s.ref + ' ' + s.signature + ' ' + s.reason).toLowerCase();
      return keywords.some(k => matchText.includes(k));
    });
  }
  if (relevantStubs.length === 0 && assignedRole) {
    relevantStubs = allStubs.filter(s => s.owner === assignedRole).slice(0, 5);
  }

  // Find target file symbols if existing
  let targetFileSymbols = [];
  if (normTarget && registry.files?.[normTarget]) {
    targetFileSymbols = registry.files[normTarget].symbols || [];
  }

  const elapsed = (performance.now() - startTime).toFixed(1);

  if (options.json) {
    const deltaManifest = {
      task: options.task || 'Unspecified task',
      targetFile: options.file || null,
      assignedRole,
      dna: {
        projectName: dna.projectName,
        primaryLanguages: dna.primaryLanguages,
        manifests: dna.manifestsDetected,
        techStack: dna.techStack,
      },
      skills: selectedShards,
      relevantStubs,
      targetFileSymbols: targetFileSymbols.map(s => ({
        name: s.name,
        kind: s.kind,
        lines: `L${s.startLine}-L${s.endLine}`,
        signature: s.signature,
        status: s.status,
      })),
      durationMs: parseFloat(elapsed),
    };
    process.stdout.write(JSON.stringify(deltaManifest, null, 2) + '\n');
    return deltaManifest;
  }

  // Plaintext Output for LLM Context
  const sep = '='.repeat(80);
  const subSep = '-'.repeat(80);

  console.log(`\n${sep}`);
  console.log(`⚡ NEURAL ORCHESTRA v5.3 - PRE-FLIGHT DELTA MANIFEST (<${elapsed}ms)`);
  console.log(sep);
  console.log(`Task:       ${options.task || 'General Development'}`);
  console.log(`Target:     ${options.file || '(Auto-detected based on task)'}`);
  console.log(`Role:       ${assignedRole}`);
  console.log(`Stack:      Frontend: ${dna.techStack?.frontend?.framework || 'None'} | Backend: ${dna.techStack?.backend?.framework || 'None'} | DB: ${dna.techStack?.database?.orm || 'None'}`);
  console.log(`Languages:  ${dna.primaryLanguages?.join(', ') || 'Auto-detected'}`);

  console.log(`\n${subSep}`);
  console.log(`🎯 ACTIVE MICRO-SKILL RULES (${selectedShards.join(', ')})`);
  console.log(subSep);
  console.log(shardContents.join('\n\n---\n\n'));

  console.log(`\n${subSep}`);
  console.log(`📍 RELEVANT STUBS & SYMBOLS`);
  console.log(subSep);

  if (relevantStubs.length > 0) {
    console.log('Pending Implementation Stubs:');
    for (const s of relevantStubs) {
      console.log(`  - [STUB] ${s.ref} (${s.lines})`);
      console.log(`    Sig:    ${s.signature}`);
      console.log(`    Reason: ${s.reason}`);
    }
  } else {
    console.log('Pending Implementation Stubs: None detected for target scope.');
  }

  if (targetFileSymbols.length > 0) {
    console.log(`\nExisting Signatures in ${normTarget}:`);
    for (const s of targetFileSymbols) {
      console.log(`  - [${s.status}] ${s.kind} ${s.name} (L${s.startLine}-L${s.endLine}) -> ${s.signature}`);
    }
  }

  console.log(`\n${subSep}`);
  console.log(`⚡ DIRECT ACTION DIRECTIVE`);
  console.log(subSep);
  console.log(`1. Context is completely assembled. Do NOT execute extra discovery or search commands.`);
  console.log(`2. If modifying existing symbols, inspect exact lines via: node .agents/bin/code-query.mjs slice <file> <start> <end>`);
  console.log(`3. When edits are complete, run: node .agents/bin/postflight.mjs\n${sep}\n`);

  return { elapsed, assignedRole, selectedShards };
}

if (process.argv[1] && process.argv[1].endsWith('preflight.mjs')) {
  runPreflight();
}
