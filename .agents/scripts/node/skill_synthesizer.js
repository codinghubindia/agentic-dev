#!/usr/bin/env node
/**
 * skill_synthesizer.js - Living Skill Staging, Quarantine & Type Inspection (Node.js Mirror)
 * Checks freshness, promotes verified skills, quarantines failing ones,
 * and extracts ground-truth TypeScript signatures from local node_modules.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join('.agents', 'skills');
const PROVISIONAL_DIR = path.join(SKILLS_DIR, '_provisional');
const QUARANTINED_DIR = path.join(SKILLS_DIR, '_quarantined');

const IMMUTABLE_SKILLS = new Set([
  'ponytail', 'professional-ui-craft', 'modern-ui-motion',
  'backend-engineering', 'database-engineering', 'devops-infrastructure',
  'security-audit', 'testing-verification'
]);

function isSkillFresh(domainSlug, maxAgeDays = 90) {
  const skillPath = path.join(SKILLS_DIR, domainSlug, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return false;

  try {
    const content = fs.readFileSync(skillPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (line.startsWith('lastResearched:')) {
        const dateStr = line.split(':', 2)[1].trim();
        const researchedDate = new Date(dateStr);
        const ageDays = (Date.now() - researchedDate.getTime()) / (1000 * 60 * 60 * 24);
        return ageDays <= maxAgeDays;
      }
    }
  } catch (_) {}
  return false;
}

function promoteSkill(domainSlug) {
  const srcFile = path.join(PROVISIONAL_DIR, domainSlug, 'SKILL.md');
  if (!fs.existsSync(srcFile)) {
    return { status: 'error', message: `Provisional skill '${domainSlug}' not found.` };
  }

  const destDir = path.join(SKILLS_DIR, domainSlug);
  fs.mkdirSync(destDir, { recursive: true });
  const destFile = path.join(destDir, 'SKILL.md');

  let content = fs.readFileSync(srcFile, 'utf8');
  content = content.replace('verifiedGrounding: false', 'verifiedGrounding: true');
  content = content.replace('provisional: true', 'provisional: false');
  content = content.replace('PROVISIONAL (Awaiting Pass 1 Compiler Grounding)', 'VERIFIED (Passed Compiler Grounding)');

  fs.writeFileSync(destFile, content, 'utf8');

  try {
    fs.rmSync(path.join(PROVISIONAL_DIR, domainSlug), { recursive: true, force: true });
  } catch (_) {}

  return {
    status: 'success',
    action: 'promoted',
    skillPath: destFile.replace(/\\/g, '/'),
    domain: domainSlug
  };
}

function quarantineSkill(domainSlug, reason = 'Compiler failure') {
  let srcFile = path.join(PROVISIONAL_DIR, domainSlug, 'SKILL.md');
  if (!fs.existsSync(srcFile)) {
    srcFile = path.join(SKILLS_DIR, domainSlug, 'SKILL.md');
  }

  if (!fs.existsSync(srcFile)) {
    return { status: 'error', message: `Skill '${domainSlug}' not found for quarantine.` };
  }

  const destDir = path.join(QUARANTINED_DIR, domainSlug);
  fs.mkdirSync(destDir, { recursive: true });
  const destFile = path.join(destDir, 'SKILL.md');

  fs.renameSync(srcFile, destFile);

  const eventQueuePath = path.join('.agent_execution', 'event-queue.jsonl');
  fs.mkdirSync('.agent_execution', { recursive: true });
  fs.appendFileSync(eventQueuePath, JSON.stringify({
    type: 'skill-quarantined',
    domain: domainSlug,
    reason,
    timestamp: new Date().toISOString()
  }) + '\n', 'utf8');

  return {
    status: 'success',
    action: 'quarantined',
    destPath: destFile.replace(/\\/g, '/'),
    domain: domainSlug,
    reason
  };
}

function inspectLocalTypes(packageName, rootDir = '.') {
  const typeLocations = [
    path.join(rootDir, 'node_modules', '@types', packageName, 'index.d.ts'),
    path.join(rootDir, 'node_modules', packageName, 'index.d.ts'),
    path.join(rootDir, 'node_modules', packageName, 'dist', 'index.d.ts'),
    path.join(rootDir, 'node_modules', packageName, 'package.json')
  ];

  for (const loc of typeLocations) {
    if (fs.existsSync(loc)) {
      if (loc.endsWith('.json')) {
        try {
          const pkg = JSON.parse(fs.readFileSync(loc, 'utf8'));
          const typesField = pkg.types || pkg.typings;
          if (typesField) {
            const actualTypeFile = path.join(path.dirname(loc), typesField);
            if (fs.existsSync(actualTypeFile)) {
              const sample = fs.readFileSync(actualTypeFile, 'utf8').slice(0, 2000);
              return { found: true, path: actualTypeFile.replace(/\\/g, '/'), sample };
            }
          }
        } catch (_) {}
      } else {
        try {
          const sample = fs.readFileSync(loc, 'utf8').slice(0, 2000);
          return { found: true, path: loc.replace(/\\/g, '/'), sample };
        } catch (_) {}
      }
    }
  }

  return { found: false, message: `No local type definitions found for '${packageName}'.` };
}

// CLI Execution
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage:');
  console.log('  node skill_synthesizer.js --check <slug>');
  console.log('  node skill_synthesizer.js --promote <slug>');
  console.log('  node skill_synthesizer.js --quarantine <slug> [reason]');
  console.log('  node skill_synthesizer.js --inspect-types <package_name>');
  process.exit(1);
}

const cmd = args[0];
if (cmd === '--check') {
  const slug = args[1] || '';
  const fresh = isSkillFresh(slug);
  console.log(JSON.stringify({ domain: slug, fresh }));
  process.exit(fresh ? 0 : 1);
} else if (cmd === '--promote') {
  const slug = args[1];
  const res = promoteSkill(slug);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.status === 'success' ? 0 : 1);
} else if (cmd === '--quarantine') {
  const slug = args[1];
  const reason = args[2] || 'Compiler failure';
  const res = quarantineSkill(slug, reason);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.status === 'success' ? 0 : 1);
} else if (cmd === '--inspect-types') {
  const pkg = args[1];
  const res = inspectLocalTypes(pkg);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.found ? 0 : 1);
} else {
  console.error(`Unknown flag: ${cmd}`);
  process.exit(1);
}
