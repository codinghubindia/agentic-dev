#!/usr/bin/env node
/**
 * .agents/bin/skill-loader.mjs
 * JIT Task-Scoped Micro-Skill Loader for Neural Orchestra v5.2.
 * Deterministically loads 1-3 targeted micro-skill shards (<100 lines)
 * based on task intent, file path, symbol type, or role.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  SKILL_MANIFEST_PATH,
  SHARDS_DIR
} from './paths.mjs';

const MANIFEST_FILE = SKILL_MANIFEST_PATH;

function parseArgs(rawArgs = process.argv.slice(2)) {
  const args = rawArgs;
  const options = {
    task: '',
    file: '',
    symbol: '',
    role: '',
    list: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--task' && args[i + 1]) {
      options.task = args[++i];
    } else if (arg === '--file' && args[i + 1]) {
      options.file = args[++i];
    } else if (arg === '--symbol' && args[i + 1]) {
      options.symbol = args[++i];
    } else if (arg === '--role' && args[i + 1]) {
      options.role = args[++i];
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

export function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    throw new Error(`Skill manifest not found at ${MANIFEST_FILE}`);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
}

export function resolveShards(manifest, options) {
  const matchedShards = new Set();

  // 1. Match task intent
  if (options.task) {
    const taskLower = options.task.toLowerCase();
    for (const intent of manifest.intents || []) {
      const regex = new RegExp(intent.pattern, 'i');
      if (regex.test(taskLower)) {
        for (const shard of intent.shards) {
          matchedShards.add(shard);
        }
      }
    }
  }

  // 2. Match file path
  if (options.file) {
    const normalizedFile = options.file.replace(/\\/g, '/');
    for (const rule of manifest.filePatterns || []) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(normalizedFile)) {
        for (const shard of rule.shards) {
          matchedShards.add(shard);
        }
      }
    }
  }

  // 3. Match symbol type
  if (options.symbol && manifest.symbolTypes) {
    const symType = options.symbol.toLowerCase();
    if (manifest.symbolTypes[symType]) {
      for (const shard of manifest.symbolTypes[symType]) {
        matchedShards.add(shard);
      }
    }
  }

  // 4. Fallback to role defaults if no shards matched yet
  if (matchedShards.size === 0 && options.role && manifest.roleDefaults) {
    const roleKey = options.role.toLowerCase().replace(/#\d+$/, ''); // Strip clone suffix
    if (manifest.roleDefaults[roleKey]) {
      for (const shard of manifest.roleDefaults[roleKey]) {
        matchedShards.add(shard);
      }
    }
  }

  // Cap at 3 most relevant shards to keep prompt overhead <100 lines
  return Array.from(matchedShards).slice(0, 3);
}

function listAvailableShards() {
  if (!fs.existsSync(SHARDS_DIR)) {
    console.log('No shards directory found.');
    return;
  }
  const files = fs.readdirSync(SHARDS_DIR).filter((f) => f.endsWith('.md'));
  console.log(`Available Micro-Skill Shards (${files.length}):`);
  for (const file of files) {
    console.log(`  - ${file}`);
  }
}

export function getShardContents(shardNames) {
  const contents = [];
  for (const shardName of shardNames) {
    const shardPath = path.resolve(SHARDS_DIR, shardName);
    if (fs.existsSync(shardPath)) {
      contents.push(fs.readFileSync(shardPath, 'utf-8').trim());
    } else {
      contents.push(`<!-- Warning: shard ${shardName} not found -->`);
    }
  }
  return contents;
}

export function runSkillLoader(args = process.argv.slice(2)) {
  const startTime = Date.now();
  const options = parseArgs(args);

  if (options.list) {
    listAvailableShards();
    return;
  }

  const manifest = loadManifest();
  const selectedShards = resolveShards(manifest, options);

  if (selectedShards.length === 0) {
    selectedShards.push('arch-intake-scope.md');
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          shards: selectedShards,
          durationMs: Date.now() - startTime,
        },
        null,
        2
      )
    );
    return;
  }

  const contents = getShardContents(selectedShards);
  console.log(contents.join('\n\n---\n\n'));
}

export function loadSkillsForTask({ task, file, role } = {}) {
  const manifest = loadManifest();
  const selectedShards = resolveShards(manifest, { task, file, role });
  if (selectedShards.length === 0) {
    selectedShards.push('arch-intake-scope.md');
  }
  const contents = getShardContents(selectedShards);
  return {
    shards: selectedShards,
    contents,
    summary: contents.join('\n\n---\n\n')
  };
}

if (process.argv[1] && process.argv[1].endsWith('skill-loader.mjs')) {
  runSkillLoader();
}
