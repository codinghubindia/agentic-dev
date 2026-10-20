#!/usr/bin/env node
/**
 * .agents/bin/code-query.mjs
 * Neural Orchestra v5.2 - Surgical Code Query CLI
 *
 * Forbids agents from reading whole files into LLM context.
 * Enables surgical line-sliced queries, symbol lookups, project DNA inspection,
 * and todo/stub tracking directly from the deterministic symbol registry.
 *
 * Subcommands:
 *   node .agents/bin/code-query.mjs dna
 *   node .agents/bin/code-query.mjs map [dir-or-owner]
 *   node .agents/bin/code-query.mjs symbol <symbolName>
 *   node .agents/bin/code-query.mjs slice <filePath> <startLine> <endLine>
 *   node .agents/bin/code-query.mjs todo [role]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runOnboard } from './onboard-project.mjs';
import { runSymbolIndexer } from './symbol-indexer.mjs';

import {
  WORKSPACE_ROOT,
  PROJECT_DNA_PATH,
  SYMBOL_REGISTRY_PATH,
  PROGRESS_LEDGER_PATH,
  FILE_RESPONSIBILITY_INDEX_PATH,
  CONTEXT_SKELETON_PATH,
  ensureExecDir
} from './paths.mjs';

const ROOT_DIR = WORKSPACE_ROOT;
const DNA_FILE = PROJECT_DNA_PATH;
const REGISTRY_FILE = SYMBOL_REGISTRY_PATH;
const LEDGER_FILE = PROGRESS_LEDGER_PATH;
const INDEX_FILE = FILE_RESPONSIBILITY_INDEX_PATH;

function ensureOnboarded() {
  if (!fs.existsSync(DNA_FILE) || !fs.existsSync(INDEX_FILE)) {
    runOnboard(['--quiet']);
  }
}

function ensureIndexed() {
  ensureOnboarded();
  if (!fs.existsSync(REGISTRY_FILE) || !fs.existsSync(LEDGER_FILE)) {
    runSymbolIndexer(['--quiet']);
  }
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 1. DNA Command
// -----------------------------------------------------------------------------
function cmdDna() {
  ensureOnboarded();
  const dna = readJsonSafe(DNA_FILE);
  const index = readJsonSafe(INDEX_FILE);

  if (!dna) {
    console.error('Error: Could not load project DNA.');
    process.exit(1);
  }

  console.log('\n🧬 PROJECT DNA & TECH STACK');
  console.log('='.repeat(60));
  console.log(`Project:        ${dna.projectName}`);
  console.log(`Root:           ${dna.rootDir}`);
  console.log(`Languages:      ${dna.primaryLanguages.join(', ') || 'None detected'}`);
  console.log(`Package Mgr:    ${dna.packageManager}`);
  console.log(`Manifests:      ${dna.manifestsDetected.join(', ')}`);

  console.log('\n📦 Tech Stack Overview:');
  if (dna.techStack.frontend) {
    console.log(`  - Frontend:   ${dna.techStack.frontend.framework} (${dna.techStack.frontend.libraries?.join(', ') || 'standard'})`);
  } else {
    console.log(`  - Frontend:   None detected`);
  }
  if (dna.techStack.backend) {
    console.log(`  - Backend:    ${dna.techStack.backend.runtime} / ${dna.techStack.backend.framework}`);
  } else {
    console.log(`  - Backend:    None detected`);
  }
  if (dna.techStack.database) {
    console.log(`  - Database:   ${dna.techStack.database.orm} (${dna.techStack.database.type})`);
  }
  if (dna.techStack.ai) {
    console.log(`  - AI/RAG:     ${dna.techStack.ai.libraries?.join(', ') || 'Custom'}`);
  }
  if (dna.techStack.testing) {
    console.log(`  - Testing:    ${dna.techStack.testing.runners?.join(', ')}`);
  }

  console.log('\n⚡ Scripts:');
  const scriptKeys = Object.keys(dna.scripts || {});
  if (scriptKeys.length === 0) {
    console.log('  (No scripts defined)');
  } else {
    for (const key of scriptKeys.slice(0, 8)) {
      console.log(`  - ${key.padEnd(14)}: ${dna.scripts[key]}`);
    }
  }

  if (index?.ownershipSummary) {
    console.log('\n👥 Ownership Distribution:');
    for (const [role, count] of Object.entries(index.ownershipSummary)) {
      if (count > 0) {
        console.log(`  - ${role.padEnd(28)}: ${count} file(s)`);
      }
    }
  }
  console.log('');
}

// -----------------------------------------------------------------------------
// 2. Map Command
// -----------------------------------------------------------------------------
function cmdMap(filterArg) {
  ensureIndexed();
  const registry = readJsonSafe(REGISTRY_FILE);
  const index = readJsonSafe(INDEX_FILE) || { files: {} };

  if (!registry || !registry.files) {
    console.error('Error: Symbol registry not found.');
    process.exit(1);
  }

  const filter = (filterArg || '').toLowerCase().trim();
  const rows = [];

  for (const [filePath, fileEntry] of Object.entries(registry.files)) {
    const owner = index.files[filePath]?.owner || 'fullstack-backend-engineer';

    // Apply filter: matches dir, filename, or owner
    if (filter) {
      const matchPath = filePath.toLowerCase().includes(filter);
      const matchOwner = owner.toLowerCase().includes(filter);
      if (!matchPath && !matchOwner) continue;
    }

    for (const sym of fileEntry.symbols || []) {
      rows.push({
        status: sym.status === 'DONE' ? '✅ DONE' : '⏳ STUB',
        kind: sym.kind,
        name: sym.name,
        lines: `L${sym.startLine}-L${sym.endLine}`,
        owner,
        file: filePath,
        signature: sym.signature
      });
    }
  }

  console.log(`\n🗺️  AST SYMBOL MAP ${filter ? `(Filter: "${filterArg}")` : ''}`);
  console.log('='.repeat(95));
  console.log(
    `${'STATUS'.padEnd(9)} ${'KIND'.padEnd(10)} ${'SYMBOL'.padEnd(24)} ${'LINES'.padEnd(12)} ${'OWNER'.padEnd(26)} FILE`
  );
  console.log('-'.repeat(95));

  if (rows.length === 0) {
    console.log(`No matching symbols found.`);
  } else {
    for (const r of rows.slice(0, 100)) {
      console.log(
        `${r.status.padEnd(9)} ${r.kind.padEnd(10)} ${r.name.slice(0, 22).padEnd(24)} ${r.lines.padEnd(12)} ${r.owner.slice(0, 24).padEnd(26)} ${r.file}`
      );
    }
    if (rows.length > 100) {
      console.log(`... and ${rows.length - 100} more symbols (filter by directory or role for more specific slices)`);
    }
  }
  console.log(`\nTotal Matched Symbols: ${rows.length}\n`);
}

// -----------------------------------------------------------------------------
// 3. Symbol Command
// -----------------------------------------------------------------------------
function cmdSymbol(symbolName) {
  if (!symbolName) {
    console.error('Usage: node .agents/bin/code-query.mjs symbol <symbolName>');
    process.exit(1);
  }

  ensureIndexed();
  const registry = readJsonSafe(REGISTRY_FILE);
  const matches = [];

  const target = symbolName.toLowerCase();

  for (const [filePath, fileEntry] of Object.entries(registry.files || {})) {
    for (const sym of fileEntry.symbols || []) {
      if (sym.name.toLowerCase() === target) {
        matches.push({ file: filePath, sym });
      }
    }
  }

  if (matches.length === 0) {
    console.error(`[code-query] Symbol '${symbolName}' not found in symbol registry.`);
    process.exit(1);
  }

  for (const { file, sym } of matches) {
    const fullPath = path.resolve(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found on disk: ${file}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const start = Math.max(1, sym.startLine - 2);
    const end = Math.min(lines.length, sym.endLine + 2);

    console.log(`\n📍 Symbol: ${sym.name} (Kind: ${sym.kind}, Status: [${sym.status}])`);
    console.log(`📁 File:   ${file}:L${sym.startLine}-L${sym.endLine} (Total Lines: ${lines.length})`);
    console.log('-'.repeat(80));

    for (let l = start; l <= end; l++) {
      const lineNumStr = String(l).padStart(5, ' ');
      const marker = l >= sym.startLine && l <= sym.endLine ? '│' : ' ';
      console.log(`${lineNumStr} ${marker} ${lines[l - 1]}`);
    }
    console.log('-'.repeat(80));
  }
  console.log('');
}

// -----------------------------------------------------------------------------
// 4. Slice Command
// -----------------------------------------------------------------------------
function cmdSlice(filePath, startLineArg, endLineArg) {
  if (!filePath || !startLineArg || !endLineArg) {
    console.error('Usage: node .agents/bin/code-query.mjs slice <filePath> <startLine> <endLine>');
    process.exit(1);
  }

  const fullPath = path.resolve(ROOT_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[code-query] File not found: ${filePath}`);
    process.exit(1);
  }

  const startLine = parseInt(startLineArg, 10);
  const endLine = parseInt(endLineArg, 10);

  if (isNaN(startLine) || isNaN(endLine) || startLine < 1 || endLine < startLine) {
    console.error(`[code-query] Invalid line range: ${startLineArg} to ${endLineArg}`);
    process.exit(1);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const from = Math.max(1, startLine);
  const to = Math.min(lines.length, endLine);

  console.log(`\n📁 File: ${filePath} (Lines ${from}-${to} of ${lines.length})`);
  console.log('-'.repeat(80));

  for (let l = from; l <= to; l++) {
    const lineNumStr = String(l).padStart(5, ' ');
    console.log(`${lineNumStr} │ ${lines[l - 1]}`);
  }
  console.log('-'.repeat(80) + '\n');
}

// -----------------------------------------------------------------------------
// 5. Todo Command
// -----------------------------------------------------------------------------
function cmdTodo(roleFilter) {
  ensureIndexed();
  const ledger = readJsonSafe(LEDGER_FILE);

  if (!ledger) {
    console.error('Error: Progress ledger not found.');
    process.exit(1);
  }

  const filter = (roleFilter || '').toLowerCase().trim();
  const stubs = (ledger.stubs || []).filter((s) => {
    if (!filter) return true;
    return (s.owner || '').toLowerCase().includes(filter);
  });

  console.log(`\n📋 PROGRESS LEDGER: UNIMPLEMENTED SYMBOLS ${filter ? `(Role: "${roleFilter}")` : ''}`);
  console.log('='.repeat(80));
  console.log(`Total Symbols:   ${ledger.summary?.totalSymbols || 0}`);
  console.log(`Implemented:     ${ledger.summary?.doneCount || 0} [DONE]`);
  console.log(`Pending Stubs:   ${ledger.summary?.stubCount || 0} [STUB] (${ledger.summary?.completionPercentage || '0%'} complete)`);
  console.log('-'.repeat(80));

  if (stubs.length === 0) {
    console.log('\n🎉 All symbols are completely implemented ([DONE])! Zero pending stubs.\n');
    return;
  }

  for (const s of stubs) {
    console.log(`\n❌ [STUB] ${s.ref} (${s.lines})`);
    console.log(`   Kind:   ${s.kind}`);
    console.log(`   Owner:  ${s.owner}`);
    console.log(`   Reason: ${s.reason}`);
    console.log(`   Sig:    ${s.signature}`);
  }
  console.log('');
}

// -----------------------------------------------------------------------------
// 6. Skeleton Command (merged from extract-skeleton.mjs)
// -----------------------------------------------------------------------------
export function cmdSkeleton(arg1, arg2) {
  ensureIndexed();
  const registry = readJsonSafe(REGISTRY_FILE);
  if (!registry || !registry.files) {
    console.error('Error: Symbol registry not found or empty.');
    return;
  }

  let targetFilter = null;
  let outPath = CONTEXT_SKELETON_PATH;
  let isStdout = false;

  const rawArgs = [arg1, arg2].filter(Boolean);
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if (a === '--stdout') {
      isStdout = true;
    } else if (a === '-o' && rawArgs[i + 1]) {
      outPath = rawArgs[i + 1];
      i++;
    } else if (a.endsWith('.d.ts') || a.endsWith('.ts')) {
      outPath = a;
    } else {
      targetFilter = a.replace(/^[./\\]+/, '').replace(/\\/g, '/');
    }
  }

  const sections = [];
  let fileCount = 0;

  for (const [relPath, fileData] of Object.entries(registry.files)) {
    const normalizedRel = relPath.replace(/\\/g, '/');
    if (targetFilter && !normalizedRel.startsWith(targetFilter) && !normalizedRel.includes(targetFilter)) {
      continue;
    }
    fileCount++;

    const lines = [];
    lines.push(`// ============================================================================`);
    lines.push(`// File: ${normalizedRel}`);
    lines.push(`// ============================================================================`);

    // Imports
    if (fileData.imports && fileData.imports.length > 0) {
      for (const imp of fileData.imports) {
        lines.push(imp.statement || `import '${imp.source}';`);
      }
      lines.push('');
    }

    // Symbols
    if (fileData.symbols && fileData.symbols.length > 0) {
      for (const sym of fileData.symbols) {
        const statusTag = sym.status === 'STUB' ? ' /* [STUB] */' : '';
        const exportPrefix = sym.isExported ? 'export ' : '';

        if (sym.kind === 'interface') {
          lines.push(`${exportPrefix}interface ${sym.name.replace(/^export\s+/, '')} {`);
          if (sym.members && sym.members.length > 0) {
            for (const m of sym.members) {
              lines.push(`  ${m};`);
            }
          }
          lines.push(`}`);
        } else if (sym.kind === 'type') {
          let sig = (sym.signature || `type ${sym.name} = unknown;`).trim();
          if (sig.startsWith('export ')) sig = sig.substring(7).trim();
          sig = sig.endsWith(';') ? sig : `${sig};`;
          lines.push(`${exportPrefix}${sig}`);
        } else if (sym.kind === 'class') {
          lines.push(`${exportPrefix}class ${sym.name.replace(/^export\s+/, '')} {`);
          if (sym.members && sym.members.length > 0) {
            for (const m of sym.members) {
              lines.push(`  ${m.signature || m.name || m};`);
            }
          }
          lines.push(`}`);
        } else if (sym.kind === 'function') {
          let sig = sym.signature || `function ${sym.name}();`;
          if (!sig.endsWith(';') && !sig.endsWith('}')) {
            sig = sig.replace(/\s*\{.*$/, '').trim() + ';';
          }
          if (sig.startsWith('export ')) {
            sig = sig.substring(7).trim();
          }
          lines.push(`${exportPrefix}declare ${sig}${statusTag}`);
        } else if (sym.kind === 'route') {
          lines.push(`// [Route: ${sym.name}] ${sym.signature}${statusTag}`);
        } else {
          lines.push(`// [${sym.kind}: ${sym.name}] ${sym.signature}${statusTag}`);
        }
      }
    } else {
      lines.push(`// (No top-level exported symbols detected)`);
    }

    sections.push(lines.join('\n'));
  }

  const fullOutput = sections.join('\n\n');

  if (isStdout) {
    process.stdout.write(fullOutput + '\n');
  } else {
    ensureExecDir();
    const resolvedOut = path.isAbsolute(outPath) ? outPath : path.resolve(ROOT_DIR, outPath);
    const parentDir = path.dirname(resolvedOut);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOut, fullOutput + '\n', 'utf8');
    const displayPath = path.relative(ROOT_DIR, resolvedOut) || outPath;
    console.log(`[code-query skeleton] Generated ${displayPath} (${fileCount} files indexed).`);
  }
}

// -----------------------------------------------------------------------------
// CLI Dispatcher
// -----------------------------------------------------------------------------
export function runCodeQuery(args = process.argv.slice(2)) {
  const subcmd = args[0];

  switch (subcmd) {
    case 'dna':
      cmdDna();
      break;

    case 'map':
      cmdMap(args[1]);
      break;

    case 'symbol':
      cmdSymbol(args[1]);
      break;

    case 'slice':
      cmdSlice(args[1], args[2], args[3]);
      break;

    case 'todo':
      cmdTodo(args[1]);
      break;

    case 'skeleton':
      cmdSkeleton(args[1], args[2]);
      break;

    case '--help':
    case '-h':
    default:
      console.log(`
Usage: node .agents/bin/code-query.mjs <command> [options]

Commands:
  dna                          Output project stack, topology, and ownership
  map [dir-or-owner]           Display compact symbol table with line ranges
  symbol <symbolName>          Surgically slice code surrounding a specific symbol
  slice <file> <start> <end>   Read ONLY the exact line range from a file
  todo [role]                  List unimplemented [STUB] symbols assigned to role
  skeleton [target] [outFile]  Generate compact context-skeleton.d.ts from symbol registry

Examples:
  node .agents/bin/code-query.mjs dna
  node .agents/bin/code-query.mjs map fullstack-backend-engineer
  node .agents/bin/code-query.mjs symbol runOrchestraState
  node .agents/bin/code-query.mjs slice .agents/bin/paths.mjs 1 25
  node .agents/bin/code-query.mjs todo
  node .agents/bin/code-query.mjs skeleton
  node .agents/bin/code-query.mjs skeleton src/
  node .agents/bin/code-query.mjs skeleton --stdout
`);
      if (subcmd && subcmd !== '--help' && subcmd !== '-h') {
        process.exit(1);
      }
      break;
  }
}

if (process.argv[1] && process.argv[1].endsWith('code-query.mjs')) {
  runCodeQuery();
}
