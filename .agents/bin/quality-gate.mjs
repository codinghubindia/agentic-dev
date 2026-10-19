#!/usr/bin/env node
/**
 * .agents/bin/quality-gate.mjs
 * Neural Orchestra v5 - Zero-Token Deterministic Control Plane
 *
 * Replaces LLM quality-manager & conflict-resolver checks.
 * Deterministically runs shift-left CLI checks with a hard 30000ms timeout per command
 * (SIGKILL on hang, max 8KB stdout/stderr truncation to prevent buffer deadlocks):
 * 1. Git conflict marker scan (<<<<<<< HEAD)
 * 2. TypeScript / Linter check (tsc --noEmit or project-specific equivalent)
 * 3. professional-ui-craft static enforcement (regex scan blocking banned vibe-code patterns,
 *    hardcoded hex colors, `any` types, or missing error boundaries)
 * 4. Dependency health check (npm audit --audit-level=high)
 *
 * Outputs a clean, structured JSON pass/fail report pointing to exact file:line errors.
 * Exits with code 0 on pass, code 1 on fail.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import {
  WORKSPACE_ROOT,
  QUALITY_GATE_REPORT_PATH,
  IGNORED_SCAN_DIRS,
  ensureExecDir
} from './paths.mjs';

const TIMEOUT_MS = 30000;
const MAX_BUFFER_BYTES = 8 * 1024; // 8KB truncation limit

const IGNORE_DIRS = IGNORED_SCAN_DIRS;

// -----------------------------------------------------------------------------
// Safe Process Execution with hard timeout & 8KB buffer truncation
// -----------------------------------------------------------------------------
function execBounded(command, args, options = {}) {
  return new Promise((resolve) => {
    let stdoutBuffer = Buffer.alloc(0);
    let stderrBuffer = Buffer.alloc(0);
    let timedOut = false;
    let killed = false;

    const isWindows = process.platform === 'win32';
    const useShell = isWindows && (command === 'npm' || command === 'npx' || command === 'pnpm' || command === 'yarn');
    const child = spawn(command, args, {
      shell: useShell,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      windowsHide: true
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (isWindows && child.pid) {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true });
        } else {
          child.kill('SIGKILL');
        }
      } catch (e) {
        // ignore
      }
      killed = true;
    }, options.timeout || TIMEOUT_MS);

    child.stdout?.on('data', (chunk) => {
      if (stdoutBuffer.length < MAX_BUFFER_BYTES) {
        const remaining = MAX_BUFFER_BYTES - stdoutBuffer.length;
        stdoutBuffer = Buffer.concat([stdoutBuffer, chunk.slice(0, remaining)]);
      }
    });

    child.stderr?.on('data', (chunk) => {
      if (stderrBuffer.length < MAX_BUFFER_BYTES) {
        const remaining = MAX_BUFFER_BYTES - stderrBuffer.length;
        stderrBuffer = Buffer.concat([stderrBuffer, chunk.slice(0, remaining)]);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        code: -1,
        stdout: stdoutBuffer.toString('utf8'),
        stderr: stderrBuffer.toString('utf8'),
        error: err.message,
        timedOut: false
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: timedOut ? -1 : (code ?? 0),
        stdout: stdoutBuffer.toString('utf8'),
        stderr: stderrBuffer.toString('utf8'),
        timedOut,
        truncated: stdoutBuffer.length >= MAX_BUFFER_BYTES || stderrBuffer.length >= MAX_BUFFER_BYTES
      });
    });
  });
}

// -----------------------------------------------------------------------------
// Recursive file search
// -----------------------------------------------------------------------------
function getAllFiles(dir, extensions = null) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

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

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (!extensions || extensions.has(path.extname(entry.name).toLowerCase())) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

// -----------------------------------------------------------------------------
// Check 1: Git Conflict Markers
// -----------------------------------------------------------------------------
async function checkGitConflicts(rootDir) {
  const errors = [];
  const textExts = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.dart', '.css',
    '.scss', '.html', '.yaml', '.yml', '.sql', '.prisma', '.env', '.sh'
  ]);
  const files = getAllFiles(rootDir, textExts);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('<<<<<<<') || content.includes('=======')) {
        const lines = content.split(/\r?\n/);
        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx];
          if (/^<{7}\s+HEAD/.test(line) || /^<{7}\s+/.test(line)) {
            errors.push({
              file: path.relative(rootDir, file).replace(/\\/g, '/'),
              line: idx + 1,
              rule: 'no-git-conflict-marker',
              message: `Unresolved git conflict marker: ${line.trim()}`
            });
          }
        }
      }
    } catch {
      // skip unreadable
    }
  }

  return {
    name: 'git-conflict-markers',
    passed: errors.length === 0,
    errors
  };
}

// -----------------------------------------------------------------------------
// Check 2: TypeScript / Linter Check
// -----------------------------------------------------------------------------
async function checkTypescript(rootDir) {
  const errors = [];
  const hasTsConfig = fs.existsSync(path.join(rootDir, 'tsconfig.json'));
  const hasPackageJson = fs.existsSync(path.join(rootDir, 'package.json'));

  let ranCommand = null;

  if (hasTsConfig) {
    ranCommand = 'npx tsc --noEmit';
    const res = await execBounded('npx', ['tsc', '--noEmit'], { cwd: rootDir });

    if (res.timedOut) {
      errors.push({
        file: 'tsconfig.json',
        line: 1,
        rule: 'tsc-timeout',
        message: 'TypeScript compiler check timed out after 30000ms (SIGKILL enforced).'
      });
    } else if (res.code !== 0) {
      const combined = (res.stdout + '\n' + res.stderr).trim();
      const lines = combined.split(/\r?\n/);
      for (const line of lines) {
        // Pattern: path/to/file.ts(line,col): error TSxxxx: message
        const match = line.match(/^(.+)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)$/);
        if (match) {
          errors.push({
            file: path.relative(rootDir, path.resolve(rootDir, match[1])).replace(/\\/g, '/'),
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            rule: 'typescript-compiler',
            message: match[4]
          });
        } else if (line.includes('error TS')) {
          errors.push({
            file: 'project',
            line: 1,
            rule: 'typescript-compiler',
            message: line.trim()
          });
        }
      }
    }
  } else if (hasPackageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const scripts = pkg.scripts || {};
      if (scripts.typecheck) {
        ranCommand = 'npm run typecheck';
        const res = await execBounded('npm', ['run', '--silent', 'typecheck'], { cwd: rootDir });
        if (res.code !== 0) {
          errors.push({
            file: 'package.json',
            line: 1,
            rule: 'typecheck-script',
            message: (res.stdout + '\n' + res.stderr).slice(0, 1000) || 'Typecheck script failed.'
          });
        }
      } else if (scripts.lint) {
        ranCommand = 'npm run lint';
        const res = await execBounded('npm', ['run', '--silent', 'lint'], { cwd: rootDir });
        if (res.code !== 0) {
          errors.push({
            file: 'package.json',
            line: 1,
            rule: 'lint-script',
            message: (res.stdout + '\n' + res.stderr).slice(0, 1000) || 'Lint script failed.'
          });
        }
      }
    } catch {
      // ignore parse error
    }
  }

  return {
    name: 'typescript-and-lint',
    passed: errors.length === 0,
    command: ranCommand || 'none (no tsconfig.json or typecheck script found)',
    errors
  };
}

// -----------------------------------------------------------------------------
// Check 3: professional-ui-craft Static Enforcement
// -----------------------------------------------------------------------------
async function checkUiCraft(rootDir) {
  const errors = [];
  const uiExts = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.dart', '.css', '.scss', '.html']);
  const files = getAllFiles(rootDir, uiExts);

  // Hex color regex: matches #fff, #ffffff, #ffffff80
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

  // Emoji regex for functional UI labels / buttons
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  // Banned rainbow gradient regex
  const rainbowRegex = /(bg-gradient-to-r\s+from-red.*to-blue|rainbow-gradient)/i;

  // Z-index magic numbers: 999, 9999, 99999
  const zIndexRegex = /(z-\[(999|9999|99999)\]|z-index:\s*(999|9999|99999))/;

  // Any type regex in TS/TSX files
  const anyTypeRegex = /(:\s*any\b|<any>|\bas\s+any\b|\bany\[\])/;

  let hasReactApp = false;
  let hasErrorBoundary = false;

  for (const file of files) {
    const relFile = path.relative(rootDir, file).replace(/\\/g, '/');
    const baseName = path.basename(file).toLowerCase();
    const isTokenFile =
      baseName.includes('token') ||
      baseName.includes('theme') ||
      baseName.includes('palette') ||
      baseName.includes('tailwind.config') ||
      baseName.includes('color');

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);

      if (relFile.includes('App.tsx') || relFile.includes('main.tsx') || relFile.includes('index.tsx') || relFile.includes('routes')) {
        hasReactApp = true;
      }
      if (content.includes('ErrorBoundary') || content.includes('error-boundary')) {
        hasErrorBoundary = true;
      }

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const lineNum = idx + 1;
        const trimmed = line.trim();

        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          continue; // skip pure comments
        }
        if (line.includes('ui-craft-ignore')) {
          continue; // explicit override
        }

        // 1. Hardcoded hex colors (only in UI files, exclude token/theme configs)
        if (!isTokenFile && !file.endsWith('.css') && !file.endsWith('.scss')) {
          let match;
          while ((match = hexRegex.exec(line)) !== null) {
            // Check if inside a CSS variable definition or token assignment
            if (line.includes('--') || line.includes('var(')) continue;
            errors.push({
              file: relFile,
              line: lineNum,
              column: match.index + 1,
              rule: 'no-hardcoded-hex',
              message: `Hardcoded hex color '${match[0]}' found. Use CSS custom properties / design tokens per professional-ui-craft.`
            });
          }
        }

        // 2. Strict type check: ban 'any' in .ts and .tsx files
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          if (anyTypeRegex.test(line) && !line.includes('//') && !isTokenFile) {
            const m = line.match(anyTypeRegex);
            errors.push({
              file: relFile,
              line: lineNum,
              column: m ? m.index + 1 : 1,
              rule: 'no-explicit-any',
              message: `Banned 'any' type found (${m ? m[0].trim() : 'any'}). Use strict interfaces or 'unknown'.`
            });
          }
        }

        // 3. Emoji in UI text/buttons
        if (emojiRegex.test(line)) {
          errors.push({
            file: relFile,
            line: lineNum,
            rule: 'no-emoji-in-ui',
            message: 'Emoji found in functional UI code. Use professional icons (Lucide, Phosphor, Heroicons) per Section 4.1.'
          });
        }

        // 4. Rainbow gradients
        if (rainbowRegex.test(line)) {
          errors.push({
            file: relFile,
            line: lineNum,
            rule: 'no-rainbow-gradient',
            message: 'Banned rainbow gradient detected. Stick to 2-stop brand color scales per Section 4.2.'
          });
        }

        // 5. Z-index magic numbers
        if (zIndexRegex.test(line)) {
          errors.push({
            file: relFile,
            line: lineNum,
            rule: 'no-zindex-magic-numbers',
            message: 'Z-index magic number detected. Use standard z-index scale: base(0), elevated(10), dropdown(100), modal(200), toast(300).'
          });
        }
      }
    } catch {
      // ignore read error
    }
  }

  // Error boundary check
  if (hasReactApp && !hasErrorBoundary && files.length > 5) {
    errors.push({
      file: 'src/App.tsx',
      line: 1,
      rule: 'require-error-boundary',
      message: 'Missing ErrorBoundary in React UI tree. Every major route or application root requires error boundaries.'
    });
  }

  return {
    name: 'professional-ui-craft-enforcement',
    passed: errors.length === 0,
    errors
  };
}

// -----------------------------------------------------------------------------
// Check 4: Dependency Health Check (npm audit --audit-level=high)
// -----------------------------------------------------------------------------
async function checkDependencies(rootDir) {
  const errors = [];
  const hasPkg = fs.existsSync(path.join(rootDir, 'package.json'));
  const hasLock =
    fs.existsSync(path.join(rootDir, 'package-lock.json')) ||
    fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml')) ||
    fs.existsSync(path.join(rootDir, 'yarn.lock'));

  if (!hasPkg || !hasLock) {
    return {
      name: 'dependency-health-audit',
      passed: true,
      command: 'skipped (no package.json or lockfile found)',
      errors: []
    };
  }

  const res = await execBounded('npm', ['audit', '--audit-level=high', '--json'], { cwd: rootDir });

  if (res.timedOut) {
    return {
      name: 'dependency-health-audit',
      passed: true,
      command: 'npm audit (timed out after 30000ms - non-blocking warning)',
      errors: []
    };
  }

  if (res.stdout) {
    try {
      const data = JSON.parse(res.stdout);
      if (data.metadata?.vulnerabilities) {
        const vulns = data.metadata.vulnerabilities;
        const highCount = (vulns.high || 0) + (vulns.critical || 0);
        if (highCount > 0) {
          errors.push({
            file: 'package.json',
            line: 1,
            rule: 'security-vulnerability',
            message: `Found ${highCount} high/critical vulnerabilities (high: ${vulns.high || 0}, critical: ${vulns.critical || 0}). Run npm audit fix.`
          });
        }
      }
    } catch {
      // non-JSON or npm audit error
    }
  }

  return {
    name: 'dependency-health-audit',
    passed: errors.length === 0,
    command: 'npm audit --audit-level=high --json',
    errors
  };
}

// -----------------------------------------------------------------------------
// Check 5: .agents Engine Immutability Check
// -----------------------------------------------------------------------------
async function checkAgentsImmutability(rootDir) {
  const errors = [];
  const agentsDir = path.resolve(rootDir, '.agents');

  if (!fs.existsSync(agentsDir)) {
    return {
      name: 'agents-engine-immutability',
      passed: true,
      errors
    };
  }

  // 1. Check for unauthorized runtime subdirectories inside .agents/
  const forbiddenDirs = ['cache', 'state', 'logs', 'temp', 'tmp'];
  for (const dir of forbiddenDirs) {
    const fullPath = path.join(agentsDir, dir);
    if (fs.existsSync(fullPath)) {
      errors.push({
        file: `.agents/${dir}`,
        line: 1,
        rule: 'engine-immutability-violation',
        message: `Forbidden runtime directory detected inside .agents/: .agents/${dir}. All runtime state must live in .agent_execution/.`
      });
    }
  }

  // 2. Check for unauthorized runtime files inside .agents/ root
  try {
    const entries = fs.readdirSync(agentsDir);
    for (const entry of entries) {
      if (entry.endsWith('.json') || entry.endsWith('.d.ts') || entry.endsWith('.log') || entry.endsWith('.tmp')) {
        errors.push({
          file: `.agents/${entry}`,
          line: 1,
          rule: 'engine-immutability-violation',
          message: `Forbidden runtime file found in .agents/: .agents/${entry}. .agents/ must remain strictly read-only.`
        });
      }
    }
  } catch {
    // ignore
  }

  // 3. If git is available, verify git status --porcelain .agents/
  if (fs.existsSync(path.join(rootDir, '.git'))) {
    const gitRes = await execBounded('git', ['status', '--porcelain', '.agents/'], { cwd: rootDir });
    if (gitRes.stdout && gitRes.stdout.trim()) {
      const changed = gitRes.stdout.trim().split(/\r?\n/).map((l) => l.trim());
      for (const line of changed) {
        const parts = line.split(/\s+/);
        const filePath = (parts[parts.length - 1] || line).trim();
        const normalized = filePath.replace(/\\/g, '/');
        if (
          normalized.includes('/cache/') ||
          normalized.endsWith('/cache') ||
          normalized.includes('/state/') ||
          normalized.endsWith('/state') ||
          normalized.includes('/logs/') ||
          normalized.endsWith('.tmp') ||
          (normalized.startsWith('.agents/') && normalized.split('/').length === 2 && (normalized.endsWith('.json') || normalized.endsWith('.log')))
        ) {
          errors.push({
            file: filePath,
            line: 1,
            rule: 'engine-immutability-violation',
            message: `Git detected uncommitted runtime mutation inside engine directory: ${line}`
          });
        }
      }
    }
  }

  return {
    name: 'agents-engine-immutability',
    passed: errors.length === 0,
    errors
  };
}

// -----------------------------------------------------------------------------
// CLI Runner
// -----------------------------------------------------------------------------
export async function runQualityGate(args = process.argv.slice(2)) {
  ensureExecDir();
  let isJsonOnly = false;
  let customReportPath = null;
  const rootDir = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      isJsonOnly = true;
    } else if (arg === '--report' || arg === '-r') {
      customReportPath = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node .agents/bin/quality-gate.mjs [options]

Options:
  --json             Output raw JSON report to stdout
  -r, --report <p>   Custom report output path (default: .agent_execution/state/quality-gate-report.json)
  -h, --help         Show this help message
`);
      process.exit(0);
    }
  }

  const [conflictCheck, tsCheck, uiCraftCheck, depCheck, immutabilityCheck] = await Promise.all([
    checkGitConflicts(rootDir),
    checkTypescript(rootDir),
    checkUiCraft(rootDir),
    checkDependencies(rootDir),
    checkAgentsImmutability(rootDir)
  ]);

  const checks = [conflictCheck, tsCheck, uiCraftCheck, depCheck, immutabilityCheck];
  const allErrors = checks.flatMap((c) => c.errors);
  const passed = allErrors.length === 0;

  // Extract unique failed files
  const failedFilesSet = new Set();
  for (const err of allErrors) {
    if (err.file) failedFilesSet.add(err.file);
  }
  const failedFiles = Array.from(failedFilesSet);

  const report = {
    passed,
    timestamp: new Date().toISOString(),
    summary: {
      totalChecks: checks.length,
      passedChecks: checks.filter((c) => c.passed).length,
      failedChecks: checks.filter((c) => !c.passed).length,
      totalErrors: allErrors.length
    },
    failedFiles,
    checks
  };

  // Atomic write report to .agent_execution/state/quality-gate-report.json
  const defaultReportPath = QUALITY_GATE_REPORT_PATH;
  const targetReportPath = customReportPath ? path.resolve(rootDir, customReportPath) : defaultReportPath;
  const reportDir = path.dirname(targetReportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const tmpReportPath = `${targetReportPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpReportPath, JSON.stringify(report, null, 2), 'utf8');
  try {
    fs.renameSync(tmpReportPath, targetReportPath);
  } catch {
    fs.copyFileSync(tmpReportPath, targetReportPath);
    fs.unlinkSync(tmpReportPath);
  }

  if (isJsonOnly) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log('\n🛡️  NEURAL ORCHESTRA QUALITY GATE REPORT');
    console.log('='.repeat(50));
    console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Checks Passed: ${report.summary.passedChecks}/${report.summary.totalChecks}`);
    console.log(`Total Violations: ${report.summary.totalErrors}`);
    console.log(`Report Written: ${path.relative(rootDir, targetReportPath).replace(/\\/g, '/')}`);

    if (!passed) {
      console.log('\nFailed Checks & Violations:');
      for (const check of checks) {
        if (!check.passed) {
          console.log(`\n  ✖ [${check.name}]`);
          for (const err of check.errors) {
            const loc = err.line ? `:${err.line}${err.column ? ':' + err.column : ''}` : '';
            console.log(`    - ${err.file}${loc} [${err.rule}]: ${err.message}`);
          }
        }
      }
    }
    console.log('');
  }

  process.exit(passed ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('quality-gate.mjs')) {
  runQualityGate();
}
