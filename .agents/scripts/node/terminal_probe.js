#!/usr/bin/env node
/**
 * terminal_probe.js — Terminal Fingerprinting & Command Quirk Resolver (Node.js mirror).
 * Usage:
 *   node terminal_probe.js                    — detect terminal
 *   node terminal_probe.js --resolve <intent> — get correct command
 *   node terminal_probe.js --learn <intent> <failed> <working> — record quirk
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const QUIRKS_FILE = path.join(__dirname, '..', '..', 'terminal-quirks.json');

// ─── Terminal detection ────────────────────────────────────────────────────────

const TERMINAL_PROBES = [
  { id: 'powershell7', cmd: 'pwsh', args: ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], contains: '7', label: 'PowerShell 7 (pwsh)' },
  { id: 'powershell5', cmd: 'powershell', args: ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], contains: '5', label: 'PowerShell 5 (Windows PowerShell)' },
  { id: 'bash', cmd: 'bash', args: ['--version'], contains: 'GNU bash', label: 'Bash' },
  { id: 'zsh', cmd: 'zsh', args: ['--version'], contains: 'zsh', label: 'Zsh' },
  { id: 'cmd', cmd: 'cmd', args: ['/c', 'ver'], contains: 'Microsoft Windows', label: 'Windows CMD' },
];

function detectTerminal() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return { id: 'zsh', label: 'Zsh (SHELL env)' };
  if (shell.includes('bash')) return { id: 'bash', label: 'Bash (SHELL env)' };

  for (const probe of TERMINAL_PROBES) {
    try {
      const result = spawnSync(probe.cmd, probe.args, { encoding: 'utf8', timeout: 2000 });
      const output = ((result.stdout || '') + (result.stderr || '')).trim();
      if (output.toLowerCase().includes(probe.contains.toLowerCase())) {
        return { id: probe.id, label: probe.label };
      }
    } catch (_) { continue; }
  }

  return process.platform === 'win32'
    ? { id: 'powershell5', label: 'PowerShell 5 (platform fallback)' }
    : { id: 'bash', label: 'Bash (platform fallback)' };
}

// ─── Quirks management ────────────────────────────────────────────────────────

function loadQuirks() {
  if (!fs.existsSync(QUIRKS_FILE)) return { version: '1.0.0', quirks: {}, learnedQuirks: [], sessionHistory: [] };
  return JSON.parse(fs.readFileSync(QUIRKS_FILE, 'utf8'));
}

function saveQuirks(data) {
  fs.mkdirSync(path.dirname(QUIRKS_FILE), { recursive: true });
  fs.writeFileSync(QUIRKS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function resolveCommand(intent, terminalId) {
  const quirks = loadQuirks();
  const learned = (quirks.learnedQuirks || []).filter(lq => lq.terminalId === terminalId && lq.intent === intent);
  if (learned.length) return learned[learned.length - 1].workingCmd;
  return (quirks.quirks[terminalId] || {})[intent] || `[NO_COMMAND_FOR_INTENT:${intent}]`;
}

function learnQuirk(intent, failedCmd, workingCmd, terminalId) {
  const quirks = loadQuirks();
  const entry = {
    id: `lq_${Date.now()}`,
    terminalId, intent, failedCmd, workingCmd,
    learnedAt: new Date().toISOString().split('T')[0]
  };
  quirks.learnedQuirks = quirks.learnedQuirks || [];
  quirks.learnedQuirks.push(entry);
  saveQuirks(quirks);
  return entry;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const terminal = detectTerminal();

if (args.includes('--resolve')) {
  const idx = args.indexOf('--resolve');
  const intent = args[idx + 1] || '';
  const cmd = resolveCommand(intent, terminal.id);
  console.log(JSON.stringify({ terminal, intent, command: cmd }, null, 2));

} else if (args.includes('--learn')) {
  const idx = args.indexOf('--learn');
  const [intent, failedCmd, workingCmd] = args.slice(idx + 1, idx + 4);
  if (!intent || !failedCmd || !workingCmd) {
    console.log(JSON.stringify({ error: 'Usage: --learn <intent> <failed-cmd> <working-cmd>' }));
    process.exit(1);
  }
  const entry = learnQuirk(intent, failedCmd, workingCmd, terminal.id);
  console.log(JSON.stringify({ status: 'learned', entry }, null, 2));

} else {
  const quirks = loadQuirks();
  const baseTable = (quirks.quirks || {})[terminal.id] || {};
  const learnedCount = (quirks.learnedQuirks || []).filter(lq => lq.terminalId === terminal.id).length;
  console.log(JSON.stringify({ terminal, commandTable: baseTable, learnedCount }, null, 2));
}

process.exit(0);
