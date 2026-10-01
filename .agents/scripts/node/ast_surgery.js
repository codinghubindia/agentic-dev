#!/usr/bin/env node
/**
 * ast_surgery.js - Structural Code Grafting & Collision Engine (Node.js Mirror)
 * Performs targeted AST replacements, import injections, route grafting,
 * model merging, and detects boundary collisions across parallel strike teams.
 */

const fs = require('fs');
const path = require('path');

function injectImport(filePath, importStatement) {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(importStatement.trim())) return true;

  const lines = content.split(/\r?\n/);
  let insertIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (stripped.startsWith('import ') || stripped.startsWith('require(') ||
        stripped.startsWith('from ') || stripped.startsWith("'use client'") ||
        stripped.startsWith('"use client"')) {
      insertIdx = i + 1;
    }
  }

  lines.splice(insertIdx, 0, importStatement);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return true;
}

function appendRoute(filePath, routeBlock) {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let insertIdx = lines.length;

  for (let i = lines.length - 1; i >= 0; i--) {
    const stripped = lines[i].trim();
    if (stripped.startsWith('export default') || stripped.startsWith('module.exports') || stripped.startsWith("if __name__ == '__main__':")) {
      insertIdx = i;
      break;
    }
  }

  lines.splice(insertIdx, 0, '\n' + routeBlock.trim() + '\n');
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return true;
}

function safeMergeModels(filePath, modelCode, syntax = 'prisma') {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    fs.writeFileSync(filePath, modelCode.trim() + '\n', 'utf8');
    return true;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const match = modelCode.match(/(?:model|class|CREATE TABLE)\s+([A-Za-z0-9_]+)/);
  if (match) {
    const identifier = match[1];
    const regex = new RegExp(`\\b(model|class|CREATE TABLE)\\s+${identifier}\\b`);
    if (regex.test(content)) {
      return true; // Already defined
    }
  }

  fs.appendFileSync(filePath, '\n\n' + modelCode.trim() + '\n', 'utf8');
  return true;
}

function replaceBlock(filePath, targetAnchor, replacement) {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(targetAnchor)) return false;

  const newContent = content.replace(targetAnchor, replacement);
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

function detectFileCollisions(fileBoundaries) {
  const collisions = [];
  const workers = Object.keys(fileBoundaries);

  for (let i = 0; i < workers.length; i++) {
    for (let j = i + 1; j < workers.length; j++) {
      const w1 = workers[i];
      const w2 = workers[j];
      const set1 = new Set(fileBoundaries[w1]);
      const set2 = new Set(fileBoundaries[w2]);

      for (const f of set1) {
        if (set2.has(f)) {
          collisions.push({
            file: f,
            workers: [w1, w2],
            resolution: f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py') ? 'COLLAPSE_TO_SEQUENTIAL' : 'AST_SURGERY_MERGE'
          });
        }
      }
    }
  }

  return {
    hasCollisions: collisions.length > 0,
    collisions,
    recommendedExecutionMode: collisions.some(c => c.resolution === 'COLLAPSE_TO_SEQUENTIAL') ? 'COLLAPSED_SEQUENTIAL' : 'PARALLEL'
  };
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node ast_surgery.js <action> <args...>');
  console.log('Actions: inject_import, append_route, merge_model, replace_block, detect_collisions');
  process.exit(1);
}

const action = args[0];
let success = false;

if (action === 'inject_import') {
  success = injectImport(args[1], args[2]);
} else if (action === 'append_route') {
  success = appendRoute(args[1], args[2]);
} else if (action === 'merge_model') {
  success = safeMergeModels(args[1], args[2], args[3] || 'prisma');
} else if (action === 'replace_block') {
  success = replaceBlock(args[1], args[2], args[3]);
} else if (action === 'detect_collisions') {
  const target = args[1];
  let data;
  if (fs.existsSync(target)) {
    data = JSON.parse(fs.readFileSync(target, 'utf8'));
  } else {
    try {
      data = JSON.parse(target);
    } catch (_) {
      data = JSON.parse(target.replace(/'/g, '"'));
    }
  }
  const result = detectFileCollisions(data);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} else {
  console.error(`Unknown action: ${action}`);
  process.exit(1);
}

if (success) {
  console.log(`AST surgery ${action} succeeded on ${args[1]}`);
  process.exit(0);
} else {
  console.error(`AST surgery ${action} failed on ${args[1]}`);
  process.exit(2);
}
