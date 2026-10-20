#!/usr/bin/env node
/**
 * .agents/bin/onboard-project.mjs
 * Neural Orchestra v5.2 - Instant Drop-In Context & Auto-Ownership Bootstrapper
 *
 * Runs automatically when .agent_execution/cache/project-dna.json is missing or stale.
 * Inspects all project manifests (package.json, tsconfig.json, pubspec.yaml,
 * pyproject.toml, requirements.txt, Dockerfile, ORM schemas) to construct:
 * 1. .agent_execution/cache/project-dna.json (complete tech stack, scripts, topology)
 * 2. .agent_execution/cache/file-responsibility-index.json (auto-ownership across 8 Macro Roles)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  WORKSPACE_ROOT,
  PROJECT_DNA_PATH,
  FILE_RESPONSIBILITY_INDEX_PATH,
  IGNORED_SCAN_DIRS,
  ensureExecDir
} from './paths.mjs';

const ROOT_DIR = WORKSPACE_ROOT;
const DNA_FILE = PROJECT_DNA_PATH;
const INDEX_FILE = FILE_RESPONSIBILITY_INDEX_PATH;
const IGNORE_DIRS = IGNORED_SCAN_DIRS;

const MACRO_ROLES = {
  FRONTEND: 'fullstack-frontend-engineer',
  BACKEND: 'fullstack-backend-engineer',
  DATA: 'data-platform-engineer',
  AI: 'ai-rag-engineer',
  MOBILE: 'mobile-engineer',
  QA: 'qa-security-verifier',
  DEVOPS: 'devops-release-engineer',
  ARCHITECT: 'principal-architect'
};

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function atomicWrite(targetPath, data) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, targetPath);
  } catch {
    fs.copyFileSync(tmp, targetPath);
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// -----------------------------------------------------------------------------
// 1. Manifest Inspector (Project DNA)
// -----------------------------------------------------------------------------
function inspectProjectDna() {
  const dna = {
    version: '5.2.0',
    generatedAt: new Date().toISOString(),
    projectName: path.basename(ROOT_DIR),
    rootDir: ROOT_DIR.replace(/\\/g, '/'),
    primaryLanguages: [],
    manifestsDetected: [],
    techStack: {
      frontend: null,
      backend: null,
      database: null,
      testing: null,
      ai: null,
      mobile: null,
      devops: null
    },
    scripts: {},
    directoryTopology: {},
    packageManager: 'unknown'
  };

  const detectedLangs = new Set();
  const detectedManifests = [];

  // package.json detection (Node.js ecosystem)
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (fs.existsSync(pkgPath)) {
    detectedManifests.push('package.json');
    detectedLangs.add('JavaScript');
    const pkg = readJsonSafe(pkgPath) || {};
    if (pkg.name) dna.projectName = pkg.name;
    if (pkg.scripts) dna.scripts = { ...pkg.scripts };

    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    // Package manager detection
    if (fs.existsSync(path.join(ROOT_DIR, 'pnpm-lock.yaml'))) dna.packageManager = 'pnpm';
    else if (fs.existsSync(path.join(ROOT_DIR, 'yarn.lock'))) dna.packageManager = 'yarn';
    else if (fs.existsSync(path.join(ROOT_DIR, 'bun.lockb')) || fs.existsSync(path.join(ROOT_DIR, 'bun.lock'))) dna.packageManager = 'bun';
    else if (fs.existsSync(path.join(ROOT_DIR, 'package-lock.json'))) dna.packageManager = 'npm';

    // Frontend Frameworks
    const uiLibs = [];
    let feFramework = null;
    let feVersion = null;
    if (allDeps['next']) { feFramework = 'Next.js'; feVersion = allDeps['next']; }
    else if (allDeps['@remix-run/react']) { feFramework = 'Remix'; feVersion = allDeps['@remix-run/react']; }
    else if (allDeps['nuxt']) { feFramework = 'Nuxt'; feVersion = allDeps['nuxt']; }
    else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) { feFramework = 'SvelteKit'; }
    else if (allDeps['vue']) { feFramework = 'Vue'; feVersion = allDeps['vue']; }
    else if (allDeps['react']) { feFramework = 'React'; feVersion = allDeps['react']; }

    if (allDeps['tailwindcss'] || allDeps['@tailwindcss/vite']) uiLibs.push('Tailwind CSS');
    if (allDeps['lucide-react'] || allDeps['lucide-vue-next']) uiLibs.push('Lucide Icons');
    if (allDeps['framer-motion']) uiLibs.push('Framer Motion');
    if (allDeps['@radix-ui/react-slot'] || allDeps['shadcn-ui']) uiLibs.push('Radix / Shadcn UI');
    if (allDeps['zustand']) uiLibs.push('Zustand');
    if (allDeps['@tanstack/react-query']) uiLibs.push('TanStack Query');

    if (feFramework || uiLibs.length > 0) {
      dna.techStack.frontend = {
        framework: feFramework || 'Custom / Web',
        version: feVersion || 'unknown',
        libraries: uiLibs
      };
    }

    // Backend Frameworks
    let beFramework = null;
    let beVersion = null;
    if (allDeps['@nestjs/core']) { beFramework = 'NestJS'; beVersion = allDeps['@nestjs/core']; }
    else if (allDeps['fastify']) { beFramework = 'Fastify'; beVersion = allDeps['fastify']; }
    else if (allDeps['express']) { beFramework = 'Express'; beVersion = allDeps['express']; }
    else if (allDeps['hono']) { beFramework = 'Hono'; beVersion = allDeps['hono']; }
    else if (allDeps['koa']) { beFramework = 'Koa'; beVersion = allDeps['koa']; }

    if (beFramework) {
      dna.techStack.backend = {
        runtime: 'Node.js',
        framework: beFramework,
        version: beVersion
      };
    }

    // Database & ORM
    let orm = null;
    let dbType = null;
    if (allDeps['prisma'] || allDeps['@prisma/client']) orm = 'Prisma';
    else if (allDeps['drizzle-orm']) orm = 'Drizzle';
    else if (allDeps['typeorm']) orm = 'TypeORM';
    else if (allDeps['mongoose']) { orm = 'Mongoose'; dbType = 'MongoDB'; }
    else if (allDeps['kysely']) orm = 'Kysely';

    if (allDeps['pg'] || allDeps['postgres']) dbType = dbType || 'PostgreSQL';
    else if (allDeps['mysql2'] || allDeps['mysql']) dbType = dbType || 'MySQL';
    else if (allDeps['sqlite3'] || allDeps['better-sqlite3']) dbType = dbType || 'SQLite';

    if (orm || dbType) {
      dna.techStack.database = { orm: orm || 'Raw Query Driver', type: dbType || 'Relational SQL' };
    }

    // Testing
    const testFrameworks = [];
    if (allDeps['vitest']) testFrameworks.push('Vitest');
    if (allDeps['jest']) testFrameworks.push('Jest');
    if (allDeps['@playwright/test']) testFrameworks.push('Playwright (E2E)');
    if (allDeps['cypress']) testFrameworks.push('Cypress (E2E)');
    if (testFrameworks.length) {
      dna.techStack.testing = { runners: testFrameworks };
    }

    // AI & Vector
    const aiProviders = [];
    if (allDeps['openai']) aiProviders.push('OpenAI');
    if (allDeps['@google/genai'] || allDeps['@google/generative-ai']) aiProviders.push('Gemini');
    if (allDeps['@anthropic-ai/sdk']) aiProviders.push('Anthropic');
    if (allDeps['@pinecone-database/pinecone']) aiProviders.push('Pinecone');
    if (allDeps['chromadb']) aiProviders.push('ChromaDB');
    if (allDeps['langchain'] || allDeps['@langchain/core']) aiProviders.push('LangChain');
    if (aiProviders.length) {
      dna.techStack.ai = { libraries: aiProviders };
    }
  }

  // tsconfig.json detection
  if (fs.existsSync(path.join(ROOT_DIR, 'tsconfig.json'))) {
    detectedManifests.push('tsconfig.json');
    detectedLangs.add('TypeScript');
  }

  // Python detection (pyproject.toml, requirements.txt)
  if (fs.existsSync(path.join(ROOT_DIR, 'pyproject.toml')) || fs.existsSync(path.join(ROOT_DIR, 'requirements.txt'))) {
    detectedLangs.add('Python');
    if (fs.existsSync(path.join(ROOT_DIR, 'pyproject.toml'))) detectedManifests.push('pyproject.toml');
    if (fs.existsSync(path.join(ROOT_DIR, 'requirements.txt'))) detectedManifests.push('requirements.txt');

    let pyContent = '';
    try {
      if (fs.existsSync(path.join(ROOT_DIR, 'pyproject.toml'))) {
        pyContent += fs.readFileSync(path.join(ROOT_DIR, 'pyproject.toml'), 'utf8');
      }
      if (fs.existsSync(path.join(ROOT_DIR, 'requirements.txt'))) {
        pyContent += fs.readFileSync(path.join(ROOT_DIR, 'requirements.txt'), 'utf8');
      }
    } catch {}

    const pyLower = pyContent.toLowerCase();
    if (!dna.techStack.backend) {
      if (pyLower.includes('fastapi')) dna.techStack.backend = { runtime: 'Python', framework: 'FastAPI' };
      else if (pyLower.includes('flask')) dna.techStack.backend = { runtime: 'Python', framework: 'Flask' };
      else if (pyLower.includes('django')) dna.techStack.backend = { runtime: 'Python', framework: 'Django' };
    }
    if (!dna.techStack.ai && (pyLower.includes('langchain') || pyLower.includes('llama-index') || pyLower.includes('torch'))) {
      dna.techStack.ai = { runtime: 'Python', libraries: ['LangChain/PyTorch'] };
    }
  }

  // Flutter / Dart detection (pubspec.yaml)
  if (fs.existsSync(path.join(ROOT_DIR, 'pubspec.yaml'))) {
    detectedManifests.push('pubspec.yaml');
    detectedLangs.add('Dart');
    dna.techStack.mobile = { platform: 'Flutter', language: 'Dart' };
  }

  // Go detection (go.mod)
  if (fs.existsSync(path.join(ROOT_DIR, 'go.mod'))) {
    detectedManifests.push('go.mod');
    detectedLangs.add('Go');
    if (!dna.techStack.backend) dna.techStack.backend = { runtime: 'Go', framework: 'Go Standard/Modules' };
  }

  // Rust detection (Cargo.toml)
  if (fs.existsSync(path.join(ROOT_DIR, 'Cargo.toml'))) {
    detectedManifests.push('Cargo.toml');
    detectedLangs.add('Rust');
    if (!dna.techStack.backend) dna.techStack.backend = { runtime: 'Rust', framework: 'Cargo Workspace / Crates' };
  }

  // C / C++ detection (CMakeLists.txt, Makefile)
  if (fs.existsSync(path.join(ROOT_DIR, 'CMakeLists.txt')) || fs.existsSync(path.join(ROOT_DIR, 'Makefile'))) {
    if (fs.existsSync(path.join(ROOT_DIR, 'CMakeLists.txt'))) detectedManifests.push('CMakeLists.txt');
    if (fs.existsSync(path.join(ROOT_DIR, 'Makefile'))) detectedManifests.push('Makefile');
    detectedLangs.add('C/C++');
    if (!dna.techStack.backend) dna.techStack.backend = { runtime: 'C/C++', framework: 'CMake / Native' };
  }

  // C# / .NET detection (*.csproj, *.sln)
  try {
    const rootFiles = fs.readdirSync(ROOT_DIR);
    const csManifest = rootFiles.find(f => f.endsWith('.csproj') || f.endsWith('.sln'));
    if (csManifest) {
      detectedManifests.push(csManifest);
      detectedLangs.add('C#');
      if (!dna.techStack.backend) dna.techStack.backend = { runtime: '.NET / C#', framework: 'ASP.NET Core / .NET' };
    }
  } catch {}

  // Java detection (pom.xml, build.gradle, build.gradle.kts)
  if (fs.existsSync(path.join(ROOT_DIR, 'pom.xml')) || fs.existsSync(path.join(ROOT_DIR, 'build.gradle')) || fs.existsSync(path.join(ROOT_DIR, 'build.gradle.kts'))) {
    if (fs.existsSync(path.join(ROOT_DIR, 'pom.xml'))) detectedManifests.push('pom.xml');
    if (fs.existsSync(path.join(ROOT_DIR, 'build.gradle'))) detectedManifests.push('build.gradle');
    if (fs.existsSync(path.join(ROOT_DIR, 'build.gradle.kts'))) detectedManifests.push('build.gradle.kts');
    detectedLangs.add('Java');
    if (!dna.techStack.backend) dna.techStack.backend = { runtime: 'Java', framework: 'Spring Boot / Maven / Gradle' };
  }

  // Docker detection
  if (fs.existsSync(path.join(ROOT_DIR, 'Dockerfile')) || fs.existsSync(path.join(ROOT_DIR, 'docker-compose.yml'))) {
    detectedManifests.push('Dockerfile');
    dna.techStack.devops = { containerized: true, orchestrator: fs.existsSync(path.join(ROOT_DIR, 'docker-compose.yml')) ? 'Docker Compose' : 'Docker' };
  }

  // Directory Topology Mapping
  const candidateDirs = [
    ['src', 'src'],
    ['components', 'src/components', 'components'],
    ['routes', 'src/routes', 'src/app', 'routes'],
    ['services', 'src/services', 'services'],
    ['contracts', 'src/contracts', 'contracts'],
    ['database', 'prisma', 'database', 'migrations'],
    ['tests', 'tests', 'test', '__tests__', 'e2e']
  ];

  for (const group of candidateDirs) {
    const key = group[0];
    for (let c = 1; c < group.length; c++) {
      const p = path.join(ROOT_DIR, group[c]);
      if (fs.existsSync(p)) {
        dna.directoryTopology[key] = group[c].replace(/\\/g, '/');
        break;
      }
    }
  }

  dna.primaryLanguages = Array.from(detectedLangs);
  dna.manifestsDetected = detectedManifests;

  return dna;
}

// -----------------------------------------------------------------------------
// 2. Auto-Ownership Mapper (File Responsibility Index)
// -----------------------------------------------------------------------------
function scanTreeAndAssignOwnership() {
  const filesMap = {};
  const summary = {
    [MACRO_ROLES.FRONTEND]: 0,
    [MACRO_ROLES.BACKEND]: 0,
    [MACRO_ROLES.DATA]: 0,
    [MACRO_ROLES.AI]: 0,
    [MACRO_ROLES.MOBILE]: 0,
    [MACRO_ROLES.QA]: 0,
    [MACRO_ROLES.DEVOPS]: 0,
    [MACRO_ROLES.ARCHITECT]: 0
  };

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const owner = resolveFileOwner(relPath);
        const ext = path.extname(entry.name).toLowerCase();
        filesMap[relPath] = {
          owner,
          category: categorizeFile(relPath, ext),
          extension: ext,
          lastIndexed: new Date().toISOString()
        };
        summary[owner] = (summary[owner] || 0) + 1;
      }
    }
  }

  walk(ROOT_DIR);

  return {
    version: '5.2.0',
    generatedAt: new Date().toISOString(),
    totalFiles: Object.keys(filesMap).length,
    ownershipSummary: summary,
    files: filesMap
  };
}

function resolveFileOwner(filePath) {
  const norm = filePath.toLowerCase();

  // 1. QA & Security
  if (
    norm.includes('/test/') ||
    norm.includes('/tests/') ||
    norm.includes('/e2e/') ||
    norm.includes('/cypress/') ||
    norm.includes('/playwright/') ||
    norm.includes('/__tests__/') ||
    norm.endsWith('.test.ts') ||
    norm.endsWith('.test.tsx') ||
    norm.endsWith('.test.js') ||
    norm.endsWith('.spec.ts') ||
    norm.endsWith('.spec.tsx') ||
    norm.endsWith('.spec.js') ||
    norm.endsWith('_test.go') ||
    norm.endsWith('_test.rs') ||
    norm.endsWith('test.cs') ||
    norm.endsWith('tests.cs') ||
    norm.endsWith('test.java') ||
    norm.endsWith('tests.java') ||
    norm.endsWith('it.java') ||
    norm.endsWith('_test.cpp')
  ) {
    return MACRO_ROLES.QA;
  }

  // 2. DevOps & Release
  if (
    norm.includes('/.github/') ||
    norm.includes('/ci/') ||
    norm.includes('/k8s/') ||
    norm.includes('/terraform/') ||
    norm.includes('/infra/') ||
    norm.includes('dockerfile') ||
    norm.includes('docker-compose') ||
    norm.endsWith('.dockerignore') ||
    norm.endsWith('.gitignore') ||
    norm.endsWith('license') ||
    norm.endsWith('package.json') ||
    norm.endsWith('package-lock.json') ||
    norm.endsWith('pnpm-lock.yaml') ||
    norm.endsWith('yarn.lock') ||
    norm.endsWith('cargo.toml') ||
    norm.endsWith('cargo.lock') ||
    norm.endsWith('cmakelists.txt') ||
    norm.endsWith('makefile') ||
    norm.endsWith('pom.xml') ||
    norm.endsWith('build.gradle') ||
    norm.endsWith('build.gradle.kts') ||
    norm.endsWith('.csproj') ||
    norm.endsWith('.sln') ||
    norm.endsWith('readme.md') ||
    norm.endsWith('changelog.md')
  ) {
    return MACRO_ROLES.DEVOPS;
  }

  // 3. Principal Architect
  if (
    norm.includes('/contracts/') ||
    norm.endsWith('contracts.ts') ||
    norm.endsWith('types.ts') ||
    norm.endsWith('.d.ts') ||
    norm.includes('api-contract') ||
    norm.includes('architecture') ||
    norm.endsWith('tsconfig.json') ||
    norm.endsWith('project-plan.json')
  ) {
    return MACRO_ROLES.ARCHITECT;
  }

  // 4. Data Platform
  if (
    norm.includes('/prisma/') ||
    norm.includes('/migrations/') ||
    norm.includes('/database/') ||
    norm.includes('/db/') ||
    norm.includes('/seeds/') ||
    norm.includes('/flyway/') ||
    norm.includes('/liquibase/') ||
    norm.endsWith('schema.prisma') ||
    norm.endsWith('.sql') ||
    norm.endsWith('seed.ts') ||
    norm.endsWith('seed.js') ||
    norm.endsWith('dbcontext.cs')
  ) {
    return MACRO_ROLES.DATA;
  }

  // 5. AI & RAG
  if (
    norm.includes('/rag/') ||
    norm.includes('/llm/') ||
    norm.includes('/embeddings/') ||
    norm.includes('/vector/') ||
    norm.includes('/prompts/') ||
    norm.includes('/ai/')
  ) {
    return MACRO_ROLES.AI;
  }

  // 6. Mobile
  if (
    norm.endsWith('.dart') ||
    norm.includes('/mobile/') ||
    norm.includes('/ios/') ||
    norm.includes('/android/') ||
    norm.includes('/flutter/') ||
    norm.endsWith('pubspec.yaml') ||
    norm.endsWith('.kt') ||
    norm.endsWith('.swift')
  ) {
    return MACRO_ROLES.MOBILE;
  }

  // 7. Fullstack Frontend
  if (
    norm.includes('/components/') ||
    norm.includes('/pages/') ||
    norm.includes('/views/') ||
    norm.includes('/app/') ||
    norm.includes('/styles/') ||
    norm.includes('/frontend/') ||
    norm.includes('/client/') ||
    norm.includes('/ui/') ||
    norm.includes('/layouts/') ||
    norm.endsWith('.tsx') ||
    norm.endsWith('.jsx') ||
    norm.endsWith('.css') ||
    norm.endsWith('.scss') ||
    norm.endsWith('.vue') ||
    norm.endsWith('.svelte') ||
    norm.endsWith('.razor') ||
    norm.endsWith('.xaml') ||
    norm.endsWith('.axaml')
  ) {
    return MACRO_ROLES.FRONTEND;
  }

  // 8. Fullstack Backend (Default for services, routes, server code)
  return MACRO_ROLES.BACKEND;
}

function categorizeFile(filePath, ext) {
  const norm = filePath.toLowerCase();
  if (norm.includes('component')) return 'component';
  if (norm.includes('hook') || norm.includes('use-')) return 'hook';
  if (norm.includes('route') || norm.includes('controller') || norm.includes('api/')) return 'api-route';
  if (norm.includes('service')) return 'service';
  if (norm.includes('middleware')) return 'middleware';
  if (norm.includes('migration') || norm.endsWith('.sql')) return 'migration';
  if (norm.includes('schema') || norm.includes('model')) return 'schema';
  if (norm.includes('test') || norm.includes('spec')) return 'test';
  if (norm.includes('config') || ext === '.json' || ext === '.yaml' || ext === '.yml') return 'config';
  return 'source';
}

function ensureDefaultAgentPointer() {
  const agentsMdPath = path.join(ROOT_DIR, 'AGENTS.md');
  const pointerContent = `# Agent Execution Instructions
Before executing tasks or reading files, execute the pre-flight discovery CLI:
\`\`\`bash
node .agents/bin/preflight.mjs --task "<task description>"
\`\`\`
See [.agents/BOOTSTRAP.md](.agents/BOOTSTRAP.md) for the complete 3-turn zero-latency protocol.
`;

  try {
    if (!fs.existsSync(agentsMdPath)) {
      fs.writeFileSync(agentsMdPath, pointerContent, 'utf8');
    } else {
      const existing = fs.readFileSync(agentsMdPath, 'utf8');
      if (!existing.includes('preflight.mjs')) {
        fs.appendFileSync(agentsMdPath, '\n\n' + pointerContent, 'utf8');
      }
    }
  } catch {
    // Non-fatal if workspace root is read-only
  }
}

// -----------------------------------------------------------------------------
// CLI Execution
// -----------------------------------------------------------------------------
export function runOnboard(args = process.argv.slice(2)) {
  ensureExecDir();
  ensureDefaultAgentPointer();
  const isForce = args.includes('--force');
  const isQuiet = args.includes('--quiet');
  const isCheckOnly = args.includes('--check');

  // Check if cache already fresh
  if (!isForce && fs.existsSync(DNA_FILE) && fs.existsSync(INDEX_FILE)) {
    const dnaStat = fs.statSync(DNA_FILE);
    const manifests = [
      'package.json', 'tsconfig.json', 'pyproject.toml', 'pubspec.yaml',
      'Cargo.toml', 'CMakeLists.txt', 'Makefile', 'pom.xml', 'build.gradle'
    ];
    let stale = false;
    for (const m of manifests) {
      const p = path.join(ROOT_DIR, m);
      if (fs.existsSync(p) && fs.statSync(p).mtimeMs > dnaStat.mtimeMs) {
        stale = true;
        break;
      }
    }

    if (!stale) {
      if (isCheckOnly) {
        process.exit(0);
      }
      if (!isQuiet) {
        console.log(`[onboard-project] Cache fresh at ${path.relative(ROOT_DIR, DNA_FILE)} (Use --force to regenerate)`);
      }
      return { dna: readJsonSafe(DNA_FILE), index: readJsonSafe(INDEX_FILE) };
    }
  }

  if (isCheckOnly) {
    process.exit(1);
  }

  if (!isQuiet) {
    console.log(`[onboard-project] Inspecting repository topology & manifests...`);
  }

  const startTime = performance.now();
  const dna = inspectProjectDna();
  const index = scanTreeAndAssignOwnership();

  atomicWrite(DNA_FILE, dna);
  atomicWrite(INDEX_FILE, index);
  ensureDefaultAgentPointer();

  const elapsed = (performance.now() - startTime).toFixed(1);

  if (!isQuiet) {
    console.log(`\n🧬 PROJECT DNA GENERATED (<${elapsed}ms)`);
    console.log('='.repeat(50));
    console.log(`Project:   ${dna.projectName}`);
    console.log(`Languages: ${dna.primaryLanguages.join(', ') || 'None detected'}`);
    console.log(`Manifests: ${dna.manifestsDetected.join(', ')}`);
    console.log(`Stack:     Frontend: ${dna.techStack.frontend?.framework || 'None'} | Backend: ${dna.techStack.backend?.framework || 'None'} | DB: ${dna.techStack.database?.orm || 'None'}`);
    console.log(`\n📁 AUTO-OWNERSHIP MAPPING (${index.totalFiles} files indexed)`);
    console.log('='.repeat(50));
    for (const [role, count] of Object.entries(index.ownershipSummary)) {
      if (count > 0) {
        console.log(`  - ${role.padEnd(28)} : ${count} files`);
      }
    }
    console.log(`\nSaved: ${path.relative(ROOT_DIR, DNA_FILE)}`);
    console.log(`Saved: ${path.relative(ROOT_DIR, INDEX_FILE)}\n`);
  }

  return { dna, index };
}

if (process.argv[1] && process.argv[1].endsWith('onboard-project.mjs')) {
  runOnboard();
}
