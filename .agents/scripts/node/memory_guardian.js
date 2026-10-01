#!/usr/bin/env node
/**
 * memory_guardian.js - Chief-of-Staff Memory & Invariant Guardian (Node.js Mirror)
 * Enforces recurrence thresholds (>=3 occurrences), filters transient network/5xx hiccups,
 * executes AST domain-noun sanitization, and maintains .agents/memory/invariants.json.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join('.agents', 'memory');
const INVARIANTS_FILE = path.join(MEMORY_DIR, 'invariants.json');
const EVENT_QUEUE_FILE = path.join('.agent_execution', 'event-queue.jsonl');

const TRANSIENT_PATTERNS = [
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /socket hang up/i,
  /502 Bad Gateway/i,
  /503 Service Unavailable/i,
  /504 Gateway Timeout/i,
  /rate limit/i,
  /429 Too Many Requests/i,
  /network timeout/i,
  /temporary failure in name resolution/i
];

const DOMAIN_NOUN_REPLACEMENTS = [
  [/\b(?:crypto|bitcoin|eth|solana|wallet)\b/gi, 'account'],
  [/\b(?:patient|medical|hospital|doctor)\b/gi, 'user'],
  [/\b(?:cart|checkout|stripe|order_item)\b/gi, 'transaction'],
  [/\b(?:shoe|product|inventory_item)\b/gi, 'item']
];

function loadInvariants() {
  if (!fs.existsSync(INVARIANTS_FILE)) {
    return { version: '1.0', invariants: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(INVARIANTS_FILE, 'utf8'));
  } catch (_) {
    return { version: '1.0', invariants: [] };
  }
}

function saveInvariants(data) {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.writeFileSync(INVARIANTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function isTransientError(text) {
  return TRANSIENT_PATTERNS.some(pat => pat.test(text));
}

function sanitizeDomainNouns(text) {
  let sanitized = text;
  for (const [pattern, replacement] of DOMAIN_NOUN_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

function processEventQueue(queuePath = EVENT_QUEUE_FILE) {
  if (!fs.existsSync(queuePath)) {
    return { processed: 0, promoted: 0, message: 'Event queue is empty' };
  }

  const registry = loadInvariants();
  const invariants = registry.invariants || [];

  let processedCount = 0;
  let promotedCount = 0;

  const rawLines = fs.readFileSync(queuePath, 'utf8').split(/\r?\n/);

  for (const line of rawLines) {
    const stripped = line.trim();
    if (!stripped) continue;

    let evt;
    try {
      evt = JSON.parse(stripped);
    } catch (_) {
      continue;
    }

    processedCount++;
    const rawPattern = evt.pattern || evt.reason || evt.lesson || '';

    // 1. Filter out transient network / service outages
    if (isTransientError(rawPattern)) {
      continue;
    }

    // 2. Sanitize domain nouns
    const sanitizedRule = sanitizeDomainNouns(rawPattern);

    // 3. Match against existing invariants
    let matched = false;
    for (const inv of invariants) {
      if (inv.rule.toLowerCase() === sanitizedRule.toLowerCase() || inv.fingerprint === evt.fingerprint) {
        inv.occurrences = (inv.occurrences || 1) + 1;
        inv.lastSeen = new Date().toISOString();
        matched = true;

        if (inv.occurrences >= 3 && inv.status !== 'active') {
          inv.status = 'active';
          promotedCount++;
        }
        break;
      }
    }

    if (!matched) {
      invariants.push({
        id: `inv_${String(invariants.length + 1).padStart(3, '0')}`,
        rule: sanitizedRule,
        occurrences: 1,
        status: 'provisional',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        targetAgent: evt.targetAgent || 'general'
      });
    }
  }

  registry.invariants = invariants;
  saveInvariants(registry);

  // Clear processed events
  try {
    fs.writeFileSync(queuePath, '', 'utf8');
  } catch (_) {}

  return {
    status: 'success',
    processedEvents: processedCount,
    newlyPromoted: promotedCount,
    totalInvariants: invariants.length
  };
}

function listInvariants() {
  const registry = loadInvariants();
  return registry.invariants || [];
}

function revokeInvariant(invId) {
  const registry = loadInvariants();
  for (const inv of registry.invariants || []) {
    if (inv.id === invId) {
      inv.status = 'revoked';
      inv.revokedAt = new Date().toISOString();
      saveInvariants(registry);
      return { status: 'success', revoked: invId };
    }
  }
  return { status: 'error', message: `Invariant '${invId}' not found.` };
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage:');
  console.log('  node memory_guardian.js process-events [queue_file]');
  console.log('  node memory_guardian.js list');
  console.log('  node memory_guardian.js revoke <id>');
  process.exit(1);
}

const cmd = args[0];
if (cmd === 'process-events') {
  const q = args[1] || EVENT_QUEUE_FILE;
  console.log(JSON.stringify(processEventQueue(q), null, 2));
} else if (cmd === 'list') {
  console.log(JSON.stringify(listInvariants(), null, 2));
} else if (cmd === 'revoke') {
  const id = args[1];
  console.log(JSON.stringify(revokeInvariant(id), null, 2));
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
