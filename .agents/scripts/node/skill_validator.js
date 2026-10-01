#!/usr/bin/env node
/**
 * skill_validator.js — Native skill file validator (Node.js mirror).
 * Zero LLM tokens — pure filesystem operations.
 * Usage: node skill_validator.js <skill-file-path> [--fix]
 */

const fs = require('fs');
const path = require('path');

const RESULT = { file: '', valid: true, issues: [], fixed: [], warnings: [] };

function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { fields: {}, endIdx: -1 };
  const end = content.indexOf('---', 3);
  if (end === -1) return { fields: {}, endIdx: -1 };
  const fm = content.slice(3, end).trim();
  const fields = {};
  for (const line of fm.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }
  return { fields, endIdx: end + 3 };
}

function injectField(content, field, value) {
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) return content;
  let fm = content.slice(3, endIdx);
  const rest = content.slice(endIdx);
  const lines = fm.split(/\r?\n/);
  const newLines = [];
  let inserted = false;
  for (const line of lines) {
    newLines.push(line);
    if (line.startsWith('description:') && !inserted) {
      newLines.push(`${field}: ${value}`);
      inserted = true;
    }
  }
  if (!inserted) newLines.push(`${field}: ${value}`);
  return '---' + newLines.join('\n') + rest;
}

function validate(filePath, fix = false) {
  RESULT.file = filePath;

  if (!fs.existsSync(filePath)) {
    RESULT.valid = false;
    RESULT.issues.push(`File not found: ${filePath}`);
    return RESULT;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.startsWith('---')) {
    RESULT.valid = false;
    RESULT.issues.push("Missing YAML frontmatter: file must start with '---'");
    return RESULT;
  }

  if ((content.match(/---/g) || []).length < 2) {
    RESULT.valid = false;
    RESULT.issues.push("Malformed frontmatter: missing closing '---'");
    return RESULT;
  }

  const { fields, endIdx } = parseFrontmatter(content);

  if (!fields.name) {
    RESULT.valid = false;
    RESULT.issues.push("Missing required field: 'name'");
  }

  if (!fields.description) {
    RESULT.valid = false;
    RESULT.issues.push("Missing required field: 'description'");
  }

  if (!fields.lastResearched) {
    const today = new Date().toISOString().split('T')[0];
    if (fix) {
      content = injectField(content, 'lastResearched', today);
      fs.writeFileSync(filePath, content, 'utf8');
      RESULT.fixed.push(`Injected 'lastResearched: ${today}'`);
    } else {
      RESULT.valid = false;
      RESULT.issues.push(`Missing 'lastResearched'. Run with --fix to auto-inject today's date (${today}).`);
    }
  }

  const body = endIdx > 0 ? content.slice(endIdx).trim() : '';
  if (body.length < 50) {
    RESULT.warnings.push('Skill body is very short (<50 chars). Consider adding more guidance.');
  }

  if (content.includes('\x00')) {
    RESULT.valid = false;
    RESULT.issues.push('File contains null bytes — possible encoding issue.');
  }

  return RESULT;
}

const [,, filePath, ...flags] = process.argv;
if (!filePath) {
  console.log(JSON.stringify({ error: 'Usage: skill_validator.js <path> [--fix]' }));
  process.exit(1);
}

const result = validate(filePath, flags.includes('--fix'));
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
