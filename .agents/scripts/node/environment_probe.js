#!/usr/bin/env node
/**
 * environment_probe.js - Host Toolchain & Dependency Preflight Probe (Node.js Mirror)
 * Detects available local compilers, package managers, and container runtimes.
 * Verifies project dependency installation status to determine whether Pass 1
 * Machine Compiler Gating can execute safely or must gracefully fall back to
 * Pass 2 Adversarial Diff Auditing.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkCommand(cmd) {
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where ${cmd}` : `which ${cmd}`;
    const fullPath = execSync(checkCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000 }).trim().split(/\r?\n/)[0];
    
    let version = null;
    try {
      const verOutput = execSync(`${cmd} --version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }).trim().split(/\r?\n/)[0];
      version = verOutput;
    } catch (_) {
      version = 'detected (version query timed out)';
    }

    return {
      available: true,
      path: fullPath.replace(/\\/g, '/'),
      version
    };
  } catch (_) {
    return { available: false, path: null, version: null };
  }
}

function probeEnvironment(rootDir = '.') {
  const probeResults = {
    timestamp: new Date().toISOString(),
    tools: {
      bun: checkCommand('bun'),
      node: checkCommand('node'),
      npm: checkCommand('npm'),
      tsc: checkCommand('tsc'),
      python: checkCommand('python'),
      pytest: checkCommand('pytest'),
      cargo: checkCommand('cargo'),
      docker: checkCommand('docker'),
      git: checkCommand('git')
    },
    workspaceState: {
      hasPackageJson: fs.existsSync(path.join(rootDir, 'package.json')),
      hasNodeModules: fs.existsSync(path.join(rootDir, 'node_modules')),
      hasRequirementsTxt: fs.existsSync(path.join(rootDir, 'requirements.txt')),
      hasCargoToml: fs.existsSync(path.join(rootDir, 'Cargo.toml')),
      hasGitRepo: fs.existsSync(path.join(rootDir, '.git'))
    },
    gateStrategy: {}
  };

  const ws = probeResults.workspaceState;
  const tools = probeResults.tools;

  if (ws.hasPackageJson) {
    if (!ws.hasNodeModules) {
      probeResults.gateStrategy.typescript = {
        strategy: 'DIFF_AUDIT_FALLBACK',
        reason: 'package.json exists but node_modules is missing (npm install not run). Compiler gate bypassed.',
        fallbackCommand: null
      };
    } else if (tools.tsc.available) {
      probeResults.gateStrategy.typescript = {
        strategy: 'LOCAL_MACHINE_COMPILER',
        command: 'tsc --noEmit',
        reason: 'TypeScript compiler is available and node_modules installed.'
      };
    } else {
      probeResults.gateStrategy.typescript = {
        strategy: 'DIFF_AUDIT_FALLBACK',
        reason: "TypeScript compiler 'tsc' not found in PATH.",
        fallbackCommand: null
      };
    }
  }

  if (ws.hasRequirementsTxt) {
    if (tools.pytest.available) {
      probeResults.gateStrategy.python = {
        strategy: 'LOCAL_MACHINE_COMPILER',
        command: 'pytest',
        reason: 'pytest is available in PATH.'
      };
    } else if (tools.python.available) {
      probeResults.gateStrategy.python = {
        strategy: 'LOCAL_MACHINE_COMPILER',
        command: 'python -m unittest',
        reason: 'python is available; falling back to standard library unittest.'
      };
    } else {
      probeResults.gateStrategy.python = {
        strategy: 'DIFF_AUDIT_FALLBACK',
        reason: 'Python runtime not detected in PATH.',
        fallbackCommand: null
      };
    }
  }

  if (ws.hasCargoToml) {
    if (tools.cargo.available) {
      probeResults.gateStrategy.rust = {
        strategy: 'LOCAL_MACHINE_COMPILER',
        command: 'cargo check',
        reason: 'cargo is available in PATH.'
      };
    } else {
      probeResults.gateStrategy.rust = {
        strategy: 'DIFF_AUDIT_FALLBACK',
        reason: 'Cargo/Rust toolchain not detected in PATH.',
        fallbackCommand: null
      };
    }
  }

  if (Object.keys(probeResults.gateStrategy).length === 0) {
    probeResults.gateStrategy.default = {
      strategy: 'DIFF_AUDIT_FALLBACK',
      reason: 'No manifest (package.json / requirements.txt / Cargo.toml) detected. Using pure Adversarial Diff Audit.'
    };
  }

  // v7.1: Runtime recommendation in priority order: bun → node → python
  const runtimePriority = ['bun', 'node', 'python'];
  probeResults.runtimeRecommendation = runtimePriority.filter(
    rt => probeResults.tools[rt] && probeResults.tools[rt].available
  );

  return probeResults;
}

// CLI Execution
const root = process.argv[2] || '.';
const results = probeEnvironment(root);

try {
  const reportDir = path.join(root, '.agent_execution');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'environment-preflight.json'), JSON.stringify(results, null, 2), 'utf8');
} catch (_) {}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
