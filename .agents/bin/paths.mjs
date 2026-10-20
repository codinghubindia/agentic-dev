/**
 * .agents/bin/paths.mjs
 * Neural Orchestra v5.2 - Shared Path Resolver & Execution Boundary
 *
 * Single source of truth for all paths across Neural Orchestra.
 * Guarantees that .agents/ remains 100% immutable (strictly read-only)
 * while all runtime state, caches, registries, and logs reside in .agent_execution/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Workspace Root (can be overridden via WORKSPACE_ROOT env var)
export const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || path.resolve(__dirname, '..', '..');

// 1. Engine Root (Strictly Read-Only)
export const AGENTS_DIR = path.resolve(WORKSPACE_ROOT, '.agents');
export const AGENTS_BIN_DIR = path.join(AGENTS_DIR, 'bin');
export const AGENTS_AGENTS_DIR = path.join(AGENTS_DIR, 'agents');
export const AGENTS_SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
export const AGENTS_WORKFLOWS_DIR = path.join(AGENTS_DIR, 'workflows');
export const SKILL_MANIFEST_PATH = path.join(AGENTS_SKILLS_DIR, 'skill-manifest.json');
export const SHARDS_DIR = path.join(AGENTS_SKILLS_DIR, 'shards');

// 2. Runtime Execution Root (Configurable via AGENT_EXEC_DIR, defaults to <workspace>/.agent_execution)
export const EXEC_DIR = process.env.AGENT_EXEC_DIR || path.join(WORKSPACE_ROOT, '.agent_execution');

// Subdirectories inside .agent_execution/
export const EXEC_CACHE_DIR = path.join(EXEC_DIR, 'cache');
export const EXEC_STATE_DIR = path.join(EXEC_DIR, 'state');
export const EXEC_LOGS_DIR = path.join(EXEC_DIR, 'logs');
export const EXEC_MEMORY_DIR = path.join(EXEC_STATE_DIR, 'memory');

// Standard aliases
export const CACHE_DIR = EXEC_CACHE_DIR;
export const STATE_DIR = EXEC_STATE_DIR;
export const LOGS_DIR = EXEC_LOGS_DIR;

// Cache File Paths (.agent_execution/cache/)
export const PROJECT_DNA_PATH = path.join(EXEC_CACHE_DIR, 'project-dna.json');
export const SYMBOL_REGISTRY_PATH = path.join(EXEC_CACHE_DIR, 'symbol-registry.json');
export const PROGRESS_LEDGER_PATH = path.join(EXEC_CACHE_DIR, 'progress-ledger.json');
export const FILE_RESPONSIBILITY_INDEX_PATH = path.join(EXEC_CACHE_DIR, 'file-responsibility-index.json');
export const CONTEXT_SKELETON_PATH = path.join(EXEC_CACHE_DIR, 'context-skeleton.d.ts');

// State File Paths (.agent_execution/state/)
export const PROJECT_PLAN_PATH = path.join(EXEC_STATE_DIR, 'project-plan.json');
export const ERROR_REGISTRY_PATH = path.join(EXEC_STATE_DIR, 'error-registry.json');
export const WORKER_POOL_PATH = path.join(EXEC_STATE_DIR, 'worker-pool.json');
export const WORKER_SLICES_PATH = path.join(EXEC_STATE_DIR, 'worker-slices.json');
export const EVENT_QUEUE_PATH = path.join(EXEC_STATE_DIR, 'event-queue.jsonl');
export const QUALITY_GATE_REPORT_PATH = path.join(EXEC_STATE_DIR, 'quality-gate-report.json');
export const FAILURE_ASSIGNMENTS_PATH = path.join(EXEC_STATE_DIR, 'failure-assignments.json');
export const QA_VERIFICATION_REPORT_PATH = path.join(EXEC_STATE_DIR, 'qa-verification-report.json');

// Ignored Directory Names for Code Scanners & Indexers
export const IGNORED_SCAN_DIRS = new Set([
  '.agents',
  '.agent_execution',
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
  '__pycache__',
  'coverage',
  '.nyc_output',
  '.playwright',
  'test-results',
  // Multi-Language build & cache artifacts
  'target',       // Rust / Maven
  'bin',          // C# / .NET
  'obj',          // C# / .NET
  '.gradle',      // Gradle
  'CMakeFiles',   // CMake
  'CMakeScripts', // CMake
  '.idea',        // JetBrains IDE
  '.vscode'       // VSCode
]);

export const IGNORE_DIRS = IGNORED_SCAN_DIRS;

// Multi-Language Supported File Extensions
export const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py',
  '.dart',
  '.go',
  '.rs',
  '.c', '.h', '.cpp', '.cc', '.hpp',
  '.cs',
  '.java'
]);

// Language identifiers by file extension
export const LANGUAGE_BY_EXT = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.dart': 'dart',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.java': 'java'
};

/**
 * Checks whether a given absolute or relative path belongs to .agents or .agent_execution
 * @param {string} targetPath
 * @returns {boolean}
 */
export function isEngineOrExecutionPath(targetPath) {
  if (!targetPath) return false;
  const abs = path.resolve(WORKSPACE_ROOT, targetPath);
  const rel = path.relative(WORKSPACE_ROOT, abs).replace(/\\/g, '/');
  return (
    rel === '.agents' ||
    rel.startsWith('.agents/') ||
    rel === '.agent_execution' ||
    rel.startsWith('.agent_execution/')
  );
}

/**
 * Checks whether a path is inside the strictly read-only .agents directory
 * @param {string} targetPath
 * @returns {boolean}
 */
export function isAgentsEnginePath(targetPath) {
  if (!targetPath) return false;
  const abs = path.resolve(WORKSPACE_ROOT, targetPath);
  const rel = path.relative(WORKSPACE_ROOT, abs).replace(/\\/g, '/');
  return rel === '.agents' || rel.startsWith('.agents/');
}

/**
 * Ensures all required .agent_execution directories exist and self-ignores with .gitignore
 */
export function ensureExecDir() {
  const dirs = [EXEC_DIR, EXEC_CACHE_DIR, EXEC_STATE_DIR, EXEC_LOGS_DIR, EXEC_MEMORY_DIR];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // Self-ignoring .agent_execution/.gitignore
  const gitignorePath = path.join(EXEC_DIR, '.gitignore');
  const gitignoreContent = `*\n!.gitignore\n`;
  try {
    if (!fs.existsSync(gitignorePath) || fs.readFileSync(gitignorePath, 'utf8') !== gitignoreContent) {
      fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    }
  } catch (err) {
    console.warn(`[paths] Could not write ${gitignorePath}: ${err.message}`);
  }
}

export const ensureExecDirs = ensureExecDir;
