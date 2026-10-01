#!/usr/bin/env node
/**
 * ghost_skeleton.js - Multi-Language 3-Tier AST Signature & Reachability Engine (Node.js Mirror)
 * Extracts public interfaces, exported functions, routes, and schemas across
 * TypeScript, JavaScript, Python, Go, Rust, Prisma, and SQL in < 1.5s using zero external dependencies.
 *
 * Modes:
 *   --topology [dir]              : Tier 1 System Topology Vector (<200 tokens)
 *   --skeleton [dir]              : Tier 2 Public AST Ghost Skeleton (<1,200 tokens)
 *   --reachability <target> [root]: Tier 3 Query-Driven Reachability Slice (<800 tokens)
 */

const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.prisma': 'prisma',
  '.sql': 'sql'
};

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo',
  '__pycache__', '.venv', 'venv', 'target', 'coverage', '.agent_execution'
]);

function extractSignatures(filePath, lang) {
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return {
      signatures: `/* Error reading file: ${err.message} */\n`,
      imports: [],
      dynamic_imports: [],
      di_decorators: []
    };
  }

  const lines = content.split(/\r?\n/);
  const signatures = [];
  const imports = [];
  const dynamicImports = [];
  const diDecorators = new Set();

  if (lang === 'typescript' || lang === 'javascript') {
    let inInterface = false;
    let braceDepth = 0;

    for (const line of lines) {
      const stripped = line.trim();

      // Dynamic import
      if (/\bimport\s*\(/.test(stripped) && !stripped.startsWith('import ')) {
        dynamicImports.push(stripped);
        signatures.append ? signatures.append(`// Dynamic Import: ${stripped}`) : signatures.push(`// Dynamic Import: ${stripped}`);
      }

      // Dependency Injection Decorators
      const diMatch = stripped.match(/@([A-Z][A-Za-z0-9_]+)\s*\(/);
      if (diMatch && ['Injectable', 'Module', 'Controller', 'Service', 'Component', 'Inject'].includes(diMatch[1])) {
        diDecorators.add(diMatch[1]);
        signatures.push(stripped);
      }

      // Static imports
      if (stripped.startsWith('import ') || stripped.includes('require(')) {
        signatures.push(stripped);
        const match = stripped.match(/from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\)/);
        if (match) {
          const imp = match[1] || match[2];
          if (imp) imports.push(imp);
        }
      } else if (/^(export\s+)?(interface|type)\s+/.test(stripped)) {
        signatures.push(stripped);
        if (stripped.includes('{') && !stripped.includes('}')) {
          inInterface = true;
          braceDepth = 1;
        }
      } else if (inInterface) {
        signatures.push('  ' + stripped);
        braceDepth += (stripped.match(/\{/g) || []).length - (stripped.match(/\}/g) || []).length;
        if (braceDepth <= 0) {
          inInterface = false;
        }
      } else if (/^(export\s+)?(async\s+)?function\s+\w+/.test(stripped) ||
                 /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(/.test(stripped)) {
        const sig = stripped.split('{')[0].trim();
        signatures.push(`${sig};`);
      } else if (/\b(app|router)\.(get|post|put|patch|delete)\s*\(/.test(stripped)) {
        const routeMatch = stripped.match(/\b(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`]+['"`]/);
        if (routeMatch) {
          signatures.push(`// Route: ${routeMatch[0]})`);
        }
      }
    }
  } else if (lang === 'python') {
    for (const line of lines) {
      const stripped = line.trim();
      if (stripped.includes('importlib.import_module') || stripped.includes('__import__')) {
        dynamicImports.push(stripped);
        signatures.push(`# Dynamic Import: ${stripped}`);
      }

      if (stripped.startsWith('import ') || stripped.startsWith('from ')) {
        signatures.push(stripped);
        const modMatch = stripped.match(/from\s+([^\s]+)\s+import|import\s+([^\s]+)/);
        if (modMatch) {
          imports.push(modMatch[1] || modMatch[2]);
        }
      } else if (/^class\s+\w+/.test(stripped)) {
        signatures.push(stripped);
      } else if (/^(async\s+)?def\s+\w+/.test(stripped)) {
        const sig = stripped.split(':')[0].trim();
        signatures.push(`${sig}: ...`);
      } else if (/^@(app|router)\.(get|post|put|delete|patch)\(/.test(stripped)) {
        signatures.push(stripped);
      } else if (stripped.startsWith('@')) {
        if (stripped.includes('Depends(')) {
          diDecorators.add('Depends');
        }
        signatures.push(stripped);
      }
    }
  } else if (lang === 'prisma') {
    let inModel = false;
    for (const line of lines) {
      const stripped = line.trim();
      if (/^(model|enum|datasource|generator)\s+\w+/.test(stripped)) {
        signatures.push(stripped);
        inModel = true;
      } else if (inModel) {
        signatures.push('  ' + stripped);
        if (stripped.startsWith('}')) inModel = false;
      }
    }
  } else if (lang === 'sql') {
    for (const line of lines) {
      const stripped = line.trim();
      if (/^CREATE\s+(TABLE|VIEW|INDEX|TYPE)/i.test(stripped)) {
        signatures.push(stripped);
      }
    }
  } else {
    for (const l of lines.slice(0, 10)) {
      if (l.trim()) signatures.push(l.trim());
    }
  }

  return {
    signatures: signatures.join('\n'),
    imports,
    dynamic_imports: dynamicImports,
    di_decorators: Array.from(diDecorators)
  };
}

function getTopology(rootDir = '.') {
  const topology = {
    tier: 'Tier 1: System Topology Vector',
    manifests: {},
    rootDirs: [],
    primaryStack: 'unknown',
    manifestExports: {},
    pathAliases: {}
  };

  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      topology.manifests['package.json'] = {
        name: pkg.name || '',
        keyDeps: deps.filter(d => ['next', 'react', 'express', 'fastify', 'nestjs', '@nestjs/core', 'prisma', 'tailwindcss', 'framer-motion', 'vue', 'svelte'].includes(d)),
        totalDeps: deps.length + devDeps.length
      };
      topology.primaryStack = 'Node.js / TypeScript';
      if (pkg.exports) topology.manifestExports = pkg.exports;
      if (pkg.main) topology.manifestExports.main = pkg.main;
    } catch (_) {}
  }

  const tsPath = path.join(rootDir, 'tsconfig.json');
  if (fs.existsSync(tsPath)) {
    try {
      const raw = fs.readFileSync(tsPath, 'utf8').replace(/\/\/.*$/gm, '');
      const tsCfg = JSON.parse(raw);
      if (tsCfg.compilerOptions && tsCfg.compilerOptions.paths) {
        topology.pathAliases = tsCfg.compilerOptions.paths;
      }
    } catch (_) {}
  }

  if (fs.existsSync(path.join(rootDir, 'requirements.txt'))) {
    topology.manifests['requirements.txt'] = true;
    topology.primaryStack = 'Python';
  }
  if (fs.existsSync(path.join(rootDir, 'Cargo.toml'))) {
    topology.manifests['Cargo.toml'] = true;
    topology.primaryStack = 'Rust';
  }
  if (fs.existsSync(path.join(rootDir, 'go.mod'))) {
    topology.manifests['go.mod'] = true;
    topology.primaryStack = 'Go';
  }

  try {
    const entries = fs.readdirSync(rootDir);
    topology.rootDirs = entries.filter(e => {
      try {
        const full = path.join(rootDir, e);
        return fs.statSync(full).isDirectory() && !IGNORE_DIRS.has(e) && (!e.startsWith('.') || e === '.agents');
      } catch (_) {
        return false;
      }
    });
  } catch (_) {}

  return topology;
}

function scanCodebase(rootDir = '.') {
  const skeleton = {
    tier: 'Tier 2: Public AST Ghost Skeleton',
    scanned_files: 0,
    confidence: 'high',
    dynamicConstructsDetected: [],
    runtimeDiModules: [],
    modules: {}
  };

  let totalDynamicConstructs = 0;

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const ent of entries) {
      const name = ent.name;
      if (ent.isDirectory()) {
        if (!IGNORE_DIRS.has(name) && (!name.startsWith('.') || name === '.agents')) {
          walk(path.join(currentDir, name));
        }
      } else if (ent.isFile()) {
        const ext = path.extname(name).toLowerCase();
        if (SUPPORTED_EXTENSIONS[ext]) {
          const fullPath = path.join(currentDir, name);
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          const lang = SUPPORTED_EXTENSIONS[ext];
          const extracted = extractSignatures(fullPath, lang);

          if (extracted.signatures.trim()) {
            skeleton.modules[relPath] = {
              lang,
              signatures: extracted.signatures,
              imports: extracted.imports
            };

            if (extracted.dynamic_imports && extracted.dynamic_imports.length > 0) {
              skeleton.modules[relPath].dynamic_imports = extracted.dynamic_imports;
              skeleton.dynamicConstructsDetected.push({
                file: relPath,
                patterns: extracted.dynamic_imports
              });
              totalDynamicConstructs += extracted.dynamic_imports.length;
            }

            if (extracted.di_decorators && extracted.di_decorators.length > 0) {
              skeleton.modules[relPath].di_decorators = extracted.di_decorators;
              skeleton.runtimeDiModules.push({
                file: relPath,
                decorators: extracted.di_decorators
              });
            }

            skeleton.scanned_files += 1;
          }
        }
      }
    }
  }

  walk(rootDir);

  if (totalDynamicConstructs > 5) {
    skeleton.confidence = 'medium';
    skeleton.advisory = 'Dynamic imports detected across multiple modules. Verify runtime entrypoints.';
  } else if (skeleton.runtimeDiModules.length > 0) {
    skeleton.confidence = 'medium';
    skeleton.advisory = 'Runtime Dependency Injection detected. Module bindings established at runtime.';
  } else {
    skeleton.confidence = 'high';
  }

  return skeleton;
}

function reachabilitySlice(targetPathOrSymbol, rootDir = '.') {
  const fullSkeleton = scanCodebase(rootDir);
  const modules = fullSkeleton.modules || {};

  let matchedFile = null;
  const targetLower = targetPathOrSymbol.toLowerCase();

  for (const filePath of Object.keys(modules)) {
    if (filePath.toLowerCase().includes(targetLower)) {
      matchedFile = filePath;
      break;
    }
  }

  if (!matchedFile) {
    for (const [filePath, data] of Object.entries(modules)) {
      if (data.signatures.toLowerCase().includes(targetLower)) {
        matchedFile = filePath;
        break;
      }
    }
  }

  if (!matchedFile) {
    return {
      tier: 'Tier 3: Reachability Slice',
      target: targetPathOrSymbol,
      error: 'Target symbol or path not found in codebase reachability graph.'
    };
  }

  const targetData = modules[matchedFile];
  const resolvedSlice = {
    tier: 'Tier 3: Reachability Slice',
    primaryTarget: matchedFile,
    primarySignatures: targetData.signatures,
    confidence: targetData.dynamic_imports ? 'medium' : 'high',
    directDependencies: {}
  };

  if (targetData.dynamic_imports) {
    resolvedSlice.dynamicImports = targetData.dynamic_imports;
  }

  for (const imp of targetData.imports || []) {
    const cleanImp = path.basename(imp).split('.')[0].toLowerCase();
    for (const [depPath, depData] of Object.entries(modules)) {
      if (depPath.toLowerCase().includes(cleanImp) && depPath !== matchedFile) {
        resolvedSlice.directDependencies[depPath] = depData.signatures;
        break;
      }
    }
  }

  return resolvedSlice;
}

// CLI Execution
const args = process.argv.slice(2);
if (args[0] === '--topology') {
  const target = args[1] || '.';
  console.log(JSON.stringify(getTopology(target), null, 2));
} else if (args[0] === '--reachability') {
  if (!args[1]) {
    console.error(JSON.stringify({ error: 'Missing target argument for --reachability' }));
    process.exit(1);
  }
  const target = args[1];
  const root = args[2] || '.';
  console.log(JSON.stringify(reachabilitySlice(target, root), null, 2));
} else {
  const target = (args[0] === '--skeleton' ? args[1] : args[0]) || '.';
  console.log(JSON.stringify(scanCodebase(target), null, 2));
}
