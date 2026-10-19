#!/usr/bin/env node
/**
 * .agents/bin/orchestra-state.mjs
 * Neural Orchestra v5 - Zero-Token Deterministic Control Plane
 *
 * Replaces LLM execution-manager, memory-manager, and resource-manager.
 * Features:
 * 1. Manages workflow state transitions (project-plan.json)
 * 2. Deterministically caps error-registry.json (max 20 items) and agent memory (max 15 items) in <5ms
 * 3. Maps failed files from quality-gate.mjs directly to responsible vertical agent using
 *    file-responsibility-index.json / ownership-map.json with fallback routing to the 8 Macro Vertical Agents
 * 4. Atomic file writes (writes to .tmp then rename) so parallel workers never deadlock or corrupt JSON
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MAX_ERROR_REGISTRY_ITEMS = 20;
const MAX_AGENT_MEMORY_ITEMS = 15;

const EXECUTION_DIR = path.resolve(process.cwd(), '.agent_execution');
const DEFAULT_PLAN_PATH = path.join(EXECUTION_DIR, 'project-plan.json');
const DEFAULT_ERROR_REGISTRY_PATH = path.join(EXECUTION_DIR, 'error-registry.json');
const DEFAULT_MEMORY_DIR = path.join(EXECUTION_DIR, 'memory');
const DEFAULT_INDEX_PATH = path.join(EXECUTION_DIR, 'file-responsibility-index.json');
const CACHE_INDEX_PATH = path.resolve(process.cwd(), '.agents', 'cache', 'file-responsibility-index.json');
const DEFAULT_WORKER_POOL_PATH = path.join(EXECUTION_DIR, 'worker-pool.json');
const DEFAULT_GATE_REPORT = path.join(EXECUTION_DIR, 'quality-gate-report.json');

// -----------------------------------------------------------------------------
// Atomic File Operations
// -----------------------------------------------------------------------------
function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Windows fallback: if target exists or is locked briefly
    try {
      fs.copyFileSync(tmpPath, filePath);
      fs.unlinkSync(tmpPath);
    } catch (fallbackErr) {
      console.error(`[orchestra-state] Failed atomic write to ${filePath}: ${fallbackErr.message}`);
      throw fallbackErr;
    }
  }
}

function readJsonSafe(filePath, defaultValue = null) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

// -----------------------------------------------------------------------------
// 1. Workflow State Management (project-plan.json)
// -----------------------------------------------------------------------------
function initPlan(options = {}) {
  const planPath = options.planPath || DEFAULT_PLAN_PATH;
  const projectName = options.name || path.basename(process.cwd());
  const projectType = options.type || 'fullstack';
  const workflowName = options.workflow || 'software-project';

  let milestones = [];
  let tasks = [];

  // Attempt to load workflow template from .agents/workflows/<workflowName>.json
  const workflowFile = path.resolve(process.cwd(), '.agents/workflows', `${workflowName}.json`);
  if (fs.existsSync(workflowFile)) {
    try {
      const wf = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
      if (Array.isArray(wf.phases)) {
        milestones = wf.phases.map((p, idx) => ({
          milestoneId: p.id || `phase_${idx + 1}`,
          title: p.name,
          status: idx === 0 ? 'active' : 'pending',
          deliverables: p.requiredArtifacts || []
        }));

        tasks = wf.phases.map((p, idx) => ({
          taskId: `task_${idx + 1}`,
          parentTaskId: null,
          owner: Array.isArray(p.agents) && p.agents.length > 0 ? p.agents[0] : 'conductor',
          goal: `Execute ${p.name}`,
          status: idx === 0 ? 'in-progress' : 'pending',
          inputs: [],
          outputs: p.requiredArtifacts || [],
          dependencies: idx > 0 ? [`task_${idx}`] : [],
          filesOrAreaOwned: [],
          acceptanceCriteria: [`Deliverables verified: ${(p.requiredArtifacts || []).join(', ')}`]
        }));
      }
    } catch (err) {
      console.warn(`[orchestra-state] Warning loading workflow: ${err.message}`);
    }
  }

  if (milestones.length === 0) {
    milestones = [
      { milestoneId: 'phase_1_contract_lock', title: 'Contract Lock & Architecture', status: 'active', deliverables: ['contracts.ts'] },
      { milestoneId: 'phase_2_implementation', title: 'Vertical Slices Execution', status: 'pending', deliverables: ['code'] },
      { milestoneId: 'phase_3_verification', title: 'Quality Gate & Security Verification', status: 'pending', deliverables: ['quality-gate-report.json'] }
    ];
  }

  const plan = {
    projectId: `proj_${Date.now()}`,
    projectName,
    version: '1.0.0',
    projectType,
    status: 'in-progress',
    currentMilestone: milestones[0].milestoneId,
    milestones,
    tasks
  };

  atomicWriteJson(planPath, plan);
  console.log(`[orchestra-state] Initialized project plan at ${path.relative(process.cwd(), planPath)} (${milestones.length} milestones)`);
  return plan;
}

function transitionPhase(phaseId, status = 'completed', planPath = DEFAULT_PLAN_PATH) {
  const plan = readJsonSafe(planPath);
  if (!plan) {
    console.error(`[orchestra-state] Error: No project plan found at ${planPath}`);
    process.exit(1);
  }

  const mIdx = plan.milestones.findIndex((m) => m.milestoneId === phaseId);
  if (mIdx === -1) {
    console.error(`[orchestra-state] Milestone '${phaseId}' not found in project plan.`);
    process.exit(1);
  }

  plan.milestones[mIdx].status = status;

  if (status === 'completed' && mIdx + 1 < plan.milestones.length) {
    plan.milestones[mIdx + 1].status = 'active';
    plan.currentMilestone = plan.milestones[mIdx + 1].milestoneId;
  } else if (status === 'completed' && mIdx + 1 >= plan.milestones.length) {
    plan.status = 'released';
  }

  atomicWriteJson(planPath, plan);
  console.log(`[orchestra-state] Milestone '${phaseId}' -> ${status}. Current: ${plan.currentMilestone || 'All Complete'}`);
  return plan;
}

function updateTask(taskId, status, owner = null, planPath = DEFAULT_PLAN_PATH) {
  const plan = readJsonSafe(planPath);
  if (!plan) {
    console.error(`[orchestra-state] Error: No project plan found at ${planPath}`);
    process.exit(1);
  }

  const task = plan.tasks.find((t) => t.taskId === taskId);
  if (!task) {
    console.error(`[orchestra-state] Task '${taskId}' not found.`);
    process.exit(1);
  }

  task.status = status;
  if (owner) task.owner = owner;
  task.updatedAt = new Date().toISOString();

  atomicWriteJson(planPath, plan);
  console.log(`[orchestra-state] Task '${taskId}' -> ${status} (Owner: ${task.owner})`);
  return plan;
}

// -----------------------------------------------------------------------------
// 2. Deterministic Memory & Error Caps (<5ms)
// -----------------------------------------------------------------------------
function recordError(options = {}) {
  const startTime = performance.now();
  const filePath = options.registryPath || DEFAULT_ERROR_REGISTRY_PATH;
  const registry = readJsonSafe(filePath, { version: 1, errors: [] });

  const fingerprint = options.fingerprint || 'unknown_error';
  const resolution = options.resolution || 'No resolution provided';
  const tags = options.tags ? options.tags.split(',').map((t) => t.trim()) : [];
  const source = options.source || 'quality-gate';
  const now = new Date().toISOString();

  const existing = registry.errors.find(
    (e) => e.fingerprint.toLowerCase().trim() === fingerprint.toLowerCase().trim()
  );

  if (existing) {
    existing.occurrences = (existing.occurrences || 1) + 1;
    existing.lastSeen = now;
    existing.resolution = resolution;
    if (tags.length) existing.tags = Array.from(new Set([...(existing.tags || []), ...tags]));
  } else {
    registry.errors.unshift({
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fingerprint,
      resolution,
      tags,
      source,
      firstSeen: now,
      lastSeen: now,
      occurrences: 1
    });
  }

  // Deterministic cap: strictly max 20 items. Sort by occurrences desc, then lastSeen desc
  if (registry.errors.length > MAX_ERROR_REGISTRY_ITEMS) {
    registry.errors.sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0) || new Date(b.lastSeen) - new Date(a.lastSeen));
    registry.errors = registry.errors.slice(0, MAX_ERROR_REGISTRY_ITEMS);
  }

  atomicWriteJson(filePath, registry);
  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`[orchestra-state] Recorded error fingerprint (${registry.errors.length}/${MAX_ERROR_REGISTRY_ITEMS} items) in ${elapsed}ms`);
}

function recordMemory(options = {}) {
  const startTime = performance.now();
  const agent = options.agent || 'conductor';
  const lesson = options.lesson || '';
  const tags = options.tags ? options.tags.split(',').map((t) => t.trim()) : [];
  const source = options.source || agent;
  const memoryDir = options.memoryDir || DEFAULT_MEMORY_DIR;
  const filePath = path.join(memoryDir, `${agent}.json`);

  const mem = readJsonSafe(filePath, { version: 1, agent, entries: [] });
  const now = new Date().toISOString();

  mem.entries.unshift({
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    lesson,
    source,
    tags
  });

  // Deterministic cap: strictly max 15 items
  if (mem.entries.length > MAX_AGENT_MEMORY_ITEMS) {
    mem.entries = mem.entries.slice(0, MAX_AGENT_MEMORY_ITEMS);
  }

  atomicWriteJson(filePath, mem);
  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`[orchestra-state] Recorded memory for '${agent}' (${mem.entries.length}/${MAX_AGENT_MEMORY_ITEMS} lessons) in ${elapsed}ms`);
}

function pruneAllMemory(baseDir = EXECUTION_DIR) {
  const startTime = performance.now();
  let prunedErrors = 0;
  let prunedMemories = 0;

  // Prune error registry
  const errorRegistryPath = path.join(baseDir, 'error-registry.json');
  if (fs.existsSync(errorRegistryPath)) {
    const reg = readJsonSafe(errorRegistryPath);
    if (reg && Array.isArray(reg.errors) && reg.errors.length > MAX_ERROR_REGISTRY_ITEMS) {
      reg.errors.sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0) || new Date(b.lastSeen) - new Date(a.lastSeen));
      reg.errors = reg.errors.slice(0, MAX_ERROR_REGISTRY_ITEMS);
      atomicWriteJson(errorRegistryPath, reg);
      prunedErrors++;
    }
  }

  // Prune memory dir
  const memDir = path.join(baseDir, 'memory');
  if (fs.existsSync(memDir)) {
    const files = fs.readdirSync(memDir).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const p = path.join(memDir, f);
      const mem = readJsonSafe(p);
      if (mem && Array.isArray(mem.entries) && mem.entries.length > MAX_AGENT_MEMORY_ITEMS) {
        mem.entries = mem.entries.slice(0, MAX_AGENT_MEMORY_ITEMS);
        atomicWriteJson(p, mem);
        prunedMemories++;
      }
    }
  }

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`[orchestra-state] Pruned memory (errors: ${prunedErrors}, agent files: ${prunedMemories}) in ${elapsed}ms`);
}

// -----------------------------------------------------------------------------
// 3. File Ownership & Failure Mapping to 8 Macro Vertical Agents
// -----------------------------------------------------------------------------
const MACRO_VERTICAL_AGENTS = {
  FRONTEND: 'fullstack-frontend-engineer',
  BACKEND: 'fullstack-backend-engineer',
  DATA: 'data-platform-engineer',
  AI: 'ai-rag-engineer',
  MOBILE: 'mobile-engineer',
  QA: 'qa-security-verifier',
  DEVOPS: 'devops-release-engineer',
  ARCHITECT: 'principal-architect'
};

function resolveAgentForFile(filePath, responsibilityIndex = null, rule = null) {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();

  // 1. Check responsibility index
  if (responsibilityIndex?.files?.[filePath]) {
    const declaredOwner = responsibilityIndex.files[filePath].owner;
    // Map legacy micro-worker names to macro vertical agents if needed
    return mapLegacyAgentToMacro(declaredOwner);
  }

  // 2. Rule-based mapping for UI craft rules
  if (rule && rule.startsWith('no-') && (rule.includes('hex') || rule.includes('emoji') || rule.includes('gradient') || rule.includes('zindex') || rule.includes('error-boundary'))) {
    return MACRO_VERTICAL_AGENTS.FRONTEND;
  }

  // 3. Fallback path & extension mapping to the 8 Macro Vertical Agents
  if (
    norm.includes('/test/') ||
    norm.includes('/tests/') ||
    norm.includes('/e2e/') ||
    norm.includes('/cypress/') ||
    norm.includes('/playwright/') ||
    norm.endsWith('.test.ts') ||
    norm.endsWith('.test.tsx') ||
    norm.endsWith('.spec.ts') ||
    norm.endsWith('.spec.tsx')
  ) {
    return MACRO_VERTICAL_AGENTS.QA;
  }

  if (
    norm.includes('/components/') ||
    norm.includes('/pages/') ||
    norm.includes('/views/') ||
    norm.includes('/app/') ||
    norm.includes('/styles/') ||
    norm.includes('/frontend/') ||
    norm.includes('/client/') ||
    norm.endsWith('.tsx') ||
    norm.endsWith('.jsx') ||
    norm.endsWith('.css') ||
    norm.endsWith('.scss')
  ) {
    return MACRO_VERTICAL_AGENTS.FRONTEND;
  }

  if (norm.endsWith('.dart') || norm.includes('/mobile/') || norm.includes('/ios/') || norm.includes('/android/') || norm.includes('/flutter/')) {
    return MACRO_VERTICAL_AGENTS.MOBILE;
  }

  if (
    norm.includes('/prisma/') ||
    norm.includes('/migrations/') ||
    norm.includes('/db/') ||
    norm.includes('/database/') ||
    norm.endsWith('schema.prisma') ||
    norm.endsWith('.sql')
  ) {
    return MACRO_VERTICAL_AGENTS.DATA;
  }

  if (
    norm.includes('/rag/') ||
    norm.includes('/llm/') ||
    norm.includes('/embeddings/') ||
    norm.includes('/vector/') ||
    norm.includes('/prompts/') ||
    norm.includes('ai-')
  ) {
    return MACRO_VERTICAL_AGENTS.AI;
  }

  if (
    norm.includes('dockerfile') ||
    norm.includes('docker-compose') ||
    norm.includes('.github/') ||
    norm.includes('/ci/') ||
    norm.includes('/k8s/') ||
    norm.includes('package.json') ||
    norm.includes('package-lock.json') ||
    norm.includes('pnpm-lock.yaml')
  ) {
    return MACRO_VERTICAL_AGENTS.DEVOPS;
  }

  if (norm.includes('contracts.ts') || norm.includes('contract') || norm.includes('architecture')) {
    return MACRO_VERTICAL_AGENTS.ARCHITECT;
  }

  if (
    norm.includes('/server/') ||
    norm.includes('/api/') ||
    norm.includes('/routes/') ||
    norm.includes('/controllers/') ||
    norm.includes('/middleware/') ||
    norm.includes('/services/') ||
    norm.endsWith('.ts') ||
    norm.endsWith('.js')
  ) {
    return MACRO_VERTICAL_AGENTS.BACKEND;
  }

  return MACRO_VERTICAL_AGENTS.BACKEND;
}

function mapLegacyAgentToMacro(legacyName) {
  if (!legacyName) return MACRO_VERTICAL_AGENTS.BACKEND;
  const name = legacyName.toLowerCase();

  if (
    name.includes('frontend') ||
    name.includes('ui') ||
    name.includes('component') ||
    name.includes('state') ||
    name.includes('routing') ||
    name.includes('accessibility') ||
    name.includes('localization')
  ) {
    return MACRO_VERTICAL_AGENTS.FRONTEND;
  }

  if (
    name.includes('backend') ||
    name.includes('api') ||
    name.includes('auth') ||
    name.includes('business-logic') ||
    name.includes('error-handling')
  ) {
    return MACRO_VERTICAL_AGENTS.BACKEND;
  }

  if (name.includes('data') || name.includes('schema') || name.includes('migration') || name.includes('seed')) {
    return MACRO_VERTICAL_AGENTS.DATA;
  }

  if (name.includes('ai') || name.includes('rag') || name.includes('llm') || name.includes('vector')) {
    return MACRO_VERTICAL_AGENTS.AI;
  }

  if (name.includes('mobile') || name.includes('screen') || name.includes('push-notification')) {
    return MACRO_VERTICAL_AGENTS.MOBILE;
  }

  if (name.includes('qa') || name.includes('tester') || name.includes('security') || name.includes('regression')) {
    return MACRO_VERTICAL_AGENTS.QA;
  }

  if (name.includes('devops') || name.includes('docker') || name.includes('ci-') || name.includes('observability') || name.includes('release')) {
    return MACRO_VERTICAL_AGENTS.DEVOPS;
  }

  if (name.includes('architect') || name.includes('contract')) {
    return MACRO_VERTICAL_AGENTS.ARCHITECT;
  }

  return legacyName;
}

function mapFailures(options = {}) {
  const reportPath = options.reportPath || DEFAULT_GATE_REPORT;
  const indexPath = options.indexPath || (fs.existsSync(DEFAULT_INDEX_PATH) ? DEFAULT_INDEX_PATH : CACHE_INDEX_PATH);

  if (!fs.existsSync(reportPath)) {
    console.error(`[orchestra-state] Error: Quality gate report not found at ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const responsibilityIndex = readJsonSafe(indexPath, { files: {} });

  const assignments = {};

  for (const check of report.checks || []) {
    for (const err of check.errors || []) {
      const file = err.file || 'unknown';
      const assignedAgent = resolveAgentForFile(file, responsibilityIndex, err.rule);

      if (!assignments[assignedAgent]) {
        assignments[assignedAgent] = [];
      }

      let fileEntry = assignments[assignedAgent].find((f) => f.file === file);
      if (!fileEntry) {
        fileEntry = { file, errors: [] };
        assignments[assignedAgent].push(fileEntry);
      }

      fileEntry.errors.push({
        check: check.name,
        line: err.line || 1,
        column: err.column || 1,
        rule: err.rule,
        message: err.message
      });
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    totalFailedFiles: report.failedFiles ? report.failedFiles.length : 0,
    assignments
  };

  const outPath = path.join(EXECUTION_DIR, 'failure-assignments.json');
  atomicWriteJson(outPath, result);

  console.log('\n🎯 FAILURE ASSIGNMENT MAP');
  console.log('='.repeat(50));
  const assignedAgents = Object.keys(assignments);
  if (assignedAgents.length === 0) {
    console.log('No failures detected. Quality gate is completely clean!');
  } else {
    for (const agent of assignedAgents) {
      const files = assignments[agent];
      console.log(`\n📌 Assigned to: ${agent} (${files.length} file(s))`);
      for (const f of files) {
        console.log(`   - ${f.file} (${f.errors.length} issue(s))`);
        for (const e of f.errors) {
          console.log(`     * L${e.line}: [${e.rule}] ${e.message}`);
        }
      }
    }
  }
  console.log(`\nWritten assignments to: ${path.relative(process.cwd(), outPath)}\n`);
  return result;
}

// -----------------------------------------------------------------------------
// 5. Parallel Worker Pool Partitioning
// -----------------------------------------------------------------------------
function partitionWorkers(options = {}) {
  const maxClones = Math.max(1, Math.min(4, parseInt(options.maxClones || '4', 10)));
  const targetRole = options.role || null;
  const indexPath = options.indexPath || (fs.existsSync(DEFAULT_INDEX_PATH) ? DEFAULT_INDEX_PATH : CACHE_INDEX_PATH);
  const outPath = options.outPath || DEFAULT_WORKER_POOL_PATH;

  const indexData = readJsonSafe(indexPath, { files: {} });
  const filesByRole = {};

  for (const [filePath, fileInfo] of Object.entries(indexData.files || {})) {
    const role = (typeof fileInfo === 'string' ? fileInfo : fileInfo.owner || fileInfo.primaryAgent) || resolveAgentForFile(filePath, indexData);
    if (targetRole && role !== targetRole) continue;
    if (!filesByRole[role]) {
      filesByRole[role] = [];
    }
    filesByRole[role].push(filePath);
  }

  const pools = {};

  for (const [role, files] of Object.entries(filesByRole)) {
    const cloneCount = Math.min(maxClones, Math.max(1, files.length));
    pools[role] = [];

    for (let c = 0; c < cloneCount; c++) {
      pools[role].push({
        workerId: `${role}#${c + 1}`,
        role: role,
        cloneIndex: c + 1,
        allowedWritePaths: [],
        status: 'ready'
      });
    }

    files.forEach((file, index) => {
      const cloneIdx = index % cloneCount;
      pools[role][cloneIdx].allowedWritePaths.push(file);
    });
  }

  const poolPayload = {
    timestamp: new Date().toISOString(),
    maxClones,
    totalRoles: Object.keys(pools).length,
    pools
  };

  atomicWriteJson(outPath, poolPayload);

  console.log('\n🎯 PARALLEL WORKER POOL ALLOCATIONS');
  console.log('='.repeat(50));
  for (const [role, workers] of Object.entries(pools)) {
    console.log(`\n📌 Role Template: ${role} (${workers.length} active clone(s))`);
    for (const w of workers) {
      console.log(`   - Clone: ${w.workerId} (${w.allowedWritePaths.length} file(s))`);
      for (const p of w.allowedWritePaths) {
        console.log(`     * ${p}`);
      }
    }
  }
  console.log(`\nWritten worker pools to: ${path.relative(process.cwd(), outPath)}\n`);
  return poolPayload;
}

function getWorkerSlice(workerId, options = {}) {
  const poolPath = options.poolPath || DEFAULT_WORKER_POOL_PATH;
  const poolData = readJsonSafe(poolPath, { pools: {} });

  for (const roleWorkers of Object.values(poolData.pools || {})) {
    const found = roleWorkers.find((w) => w.workerId === workerId);
    if (found) {
      console.log(JSON.stringify(found, null, 2));
      return found;
    }
  }

  console.error(`Worker clone ${workerId} not found in ${poolPath}`);
  return null;
}

// -----------------------------------------------------------------------------
// CLI Dispatcher
// -----------------------------------------------------------------------------
export function runOrchestraState(args = process.argv.slice(2)) {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
Usage: node .agents/bin/orchestra-state.mjs <command> [options]

Commands:
  init-plan [--name <str>] [--type <str>] [--workflow <wf>]
      Initializes .agent_execution/project-plan.json from workflow template

  transition-phase <phaseId> [status]
      Transitions a phase status (active/completed/failed) and advances plan

  update-task <taskId> <status> [--owner <agent>]
      Updates a specific task's status and ownership

  record-error --fingerprint <str> --resolution <str> [--tags <tags>] [--source <src>]
      Deterministically records/updates error fingerprint, capped to max 20 items in <5ms

  record-memory --agent <agent> --lesson <str> [--tags <tags>] [--source <src>]
      Deterministically records agent memory, capped to max 15 items in <5ms

  prune-memory
      Deterministically enforces caps across all memory and error registries

  map-failures [--report <path>] [--index <path>]
      Maps quality-gate failures directly to the responsible Macro Vertical Agent

  partition-workers [--role <role>] [--max-clones <N>] [--index <path>] [--out <path>]
      Partitions files/tasks across parallel worker clones with disjoint allowedWritePaths

  get-worker-slice <workerId> [--pool <path>]
      Outputs assigned disjoint slice and allowedWritePaths for a specific worker clone
`);
    process.exit(0);
  }

  function getArg(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  }

  switch (command) {
    case 'init-plan':
      initPlan({
        name: getArg('--name'),
        type: getArg('--type'),
        workflow: getArg('--workflow')
      });
      break;

    case 'transition-phase': {
      const phaseId = args[1];
      const status = args[2] || 'completed';
      if (!phaseId) {
        console.error('Error: phaseId required.');
        process.exit(1);
      }
      transitionPhase(phaseId, status);
      break;
    }

    case 'update-task': {
      const taskId = args[1];
      const status = args[2] || 'completed';
      const owner = getArg('--owner');
      if (!taskId) {
        console.error('Error: taskId required.');
        process.exit(1);
      }
      updateTask(taskId, status, owner);
      break;
    }

    case 'record-error':
      recordError({
        fingerprint: getArg('--fingerprint'),
        resolution: getArg('--resolution'),
        tags: getArg('--tags'),
        source: getArg('--source')
      });
      break;

    case 'record-memory':
      recordMemory({
        agent: getArg('--agent'),
        lesson: getArg('--lesson'),
        tags: getArg('--tags'),
        source: getArg('--source')
      });
      break;

    case 'prune-memory':
      pruneAllMemory();
      break;

    case 'map-failures':
      mapFailures({
        reportPath: getArg('--report'),
        indexPath: getArg('--index')
      });
      break;

    case 'partition-workers':
      partitionWorkers({
        role: getArg('--role'),
        maxClones: getArg('--max-clones'),
        indexPath: getArg('--index'),
        outPath: getArg('--out')
      });
      break;

    case 'get-worker-slice': {
      const workerId = args[1];
      if (!workerId) {
        console.error('Error: workerId required.');
        process.exit(1);
      }
      getWorkerSlice(workerId, { poolPath: getArg('--pool') });
      break;
    }

    default:
      console.error(`Unknown command: ${command}. Run with --help for usage.`);
      process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('orchestra-state.mjs')) {
  runOrchestraState();
}
