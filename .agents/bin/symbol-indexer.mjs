#!/usr/bin/env node
/**
 * .agents/bin/symbol-indexer.mjs
 * Neural Orchestra v5.2 - Incremental AST Symbol & Line-Number Registry
 *
 * Scans source files (.ts, .tsx, .js, .jsx, .mjs, .cjs, .py, .dart, .go) in <50ms
 * using SHA-1 hashing to incrementally index symbols and their exact line ranges.
 * Outputs:
 * 1. .agent_execution/cache/symbol-registry.json (comprehensive symbol & line-number map)
 * 2. .agent_execution/cache/progress-ledger.json (separates [DONE] from [STUB/PENDING] symbols)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import {
  WORKSPACE_ROOT,
  SYMBOL_REGISTRY_PATH,
  PROGRESS_LEDGER_PATH,
  FILE_RESPONSIBILITY_INDEX_PATH,
  IGNORED_SCAN_DIRS,
  SUPPORTED_EXTENSIONS,
  ensureExecDir
} from './paths.mjs';

const ROOT_DIR = WORKSPACE_ROOT;
const REGISTRY_FILE = SYMBOL_REGISTRY_PATH;
const LEDGER_FILE = PROGRESS_LEDGER_PATH;
const INDEX_FILE = FILE_RESPONSIBILITY_INDEX_PATH;

const SUPPORTED_EXTS = SUPPORTED_EXTENSIONS;
const IGNORE_DIRS = IGNORED_SCAN_DIRS;

function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}

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
// STUB Detection Logic
// -----------------------------------------------------------------------------
function detectStubStatus(bodyText) {
  const trimmed = bodyText.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed === '{}' || trimmed === '{\n}' || /^{\s*}$/.test(trimmed)) {
    return { isStub: true, reason: 'Empty implementation body' };
  }
  if (lower.includes('todo:') || lower.includes('todo ') || lower.includes('fixme:')) {
    const m = trimmed.match(/\/\/\s*(TODO[^\n\r]*|FIXME[^\n\r]*)|#\s*(TODO[^\n\r]*|FIXME[^\n\r]*)/i);
    return { isStub: true, reason: m ? m[0].trim() : 'TODO or FIXME found in body' };
  }
  if (
    lower.includes('not implemented') ||
    lower.includes('notimplementederror') ||
    lower.includes('notimplementedexception') ||
    lower.includes('unsupportedoperationexception') ||
    lower.includes('unimplemented') ||
    lower.includes('todo!') ||
    lower.includes('unimplemented!') ||
    lower.includes('panic!("not implemented")') ||
    lower.includes('panic!("todo")') ||
    lower.includes('throw new error("not implemented")') ||
    lower.includes("throw new error('not implemented')") ||
    lower.includes('throw new notimplementedexception') ||
    lower.includes('throw new unsupportedoperationexception')
  ) {
    return { isStub: true, reason: 'Explicit Not Implemented exception/stub' };
  }
  if (trimmed === 'pass' || trimmed === '...' || /^(pass|\.\.\.)\s*$/.test(trimmed)) {
    return { isStub: true, reason: 'Python pass or ellipsis body' };
  }

  return { isStub: false, reason: null };
}

// -----------------------------------------------------------------------------
// Shared Brace Helper
// -----------------------------------------------------------------------------
function findBraceBlockEnd(lines, startIndex) {
  let depth = 0;
  let foundOpen = false;
  const bodyLines = [];

  for (let j = startIndex; j < lines.length; j++) {
    const l = lines[j];
    bodyLines.push(l);
    for (let c = 0; c < l.length; c++) {
      const char = l[c];
      if (char === '{') { depth++; foundOpen = true; }
      else if (char === '}') depth--;
    }
    if (foundOpen && depth <= 0) {
      return { endLine: j + 1, nextIndex: j, bodyText: bodyLines.join('\n') };
    }
  }
  return { endLine: lines.length, nextIndex: lines.length - 1, bodyText: bodyLines.join('\n') };
}

// -----------------------------------------------------------------------------
// TS / JS Symbol Parser
// -----------------------------------------------------------------------------
function parseTsJsSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Imports
    if (trimmed.startsWith('import ')) {
      const fromMatch = trimmed.match(/from\s+['"]([^'"]+)['"]/);
      imports.push({
        line: lineNum,
        source: fromMatch ? fromMatch[1] : 'unknown',
        statement: trimmed
      });
      continue;
    }

    // Exported Names
    if (trimmed.startsWith('export ')) {
      const expMatch = trimmed.match(/export\s+(const|let|var|function|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/);
      if (expMatch) exports.push(expMatch[2]);
    }

    // Interface / Type
    const typeMatch = trimmed.match(/^(export\s+)?(declare\s+)?(interface|type)\s+([A-Za-z0-9_$]+)/);
    if (typeMatch) {
      const kind = typeMatch[3];
      const name = typeMatch[4];
      const startLine = lineNum;
      let endLine = lineNum;

      if (kind === 'interface') {
        let depth = 0;
        let foundOpen = false;
        for (let j = i; j < lines.length; j++) {
          for (const char of lines[j]) {
            if (char === '{') { depth++; foundOpen = true; }
            if (char === '}') depth--;
          }
          if (foundOpen && depth <= 0) { endLine = j + 1; i = j; break; }
        }
      } else {
        for (let j = i; j < lines.length; j++) {
          if (lines[j].includes(';')) { endLine = j + 1; i = j; break; }
        }
      }

      symbols.push({
        name,
        kind,
        startLine,
        endLine,
        signature: `${kind} ${name}`,
        status: 'DONE',
        isExported: trimmed.startsWith('export')
      });
      continue;
    }

    // Class Declaration
    const classMatch = trimmed.match(/^(export\s+)?(default\s+)?(abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (classMatch) {
      const name = classMatch[4];
      const startLine = lineNum;
      let endLine = lineNum;
      let depth = 0;
      let foundOpen = false;
      const bodyLines = [];

      for (let j = i; j < lines.length; j++) {
        bodyLines.push(lines[j]);
        for (const char of lines[j]) {
          if (char === '{') { depth++; foundOpen = true; }
          if (char === '}') depth--;
        }
        if (foundOpen && depth <= 0) { endLine = j + 1; i = j; break; }
      }

      const bodyText = bodyLines.join('\n');
      const { isStub, reason } = detectStubStatus(bodyText);

      symbols.push({
        name,
        kind: 'class',
        startLine,
        endLine,
        signature: lines[startLine - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: trimmed.startsWith('export')
      });
      continue;
    }

    // Function / Component / Hook / Route Declaration
    const fnMatch = trimmed.match(/^(export\s+)?(default\s+)?(async\s+)?function\s*([A-Za-z0-9_$]*)\s*(\<[^\>]+\>)?\s*\(([^)]*)\)/);
    if (fnMatch) {
      const name = fnMatch[4] || 'anonymous';
      const startLine = lineNum;
      let endLine = lineNum;
      let depth = 0;
      let foundOpen = false;
      const bodyLines = [];

      for (let j = i; j < lines.length; j++) {
        bodyLines.push(lines[j]);
        for (const char of lines[j]) {
          if (char === '{') { depth++; foundOpen = true; }
          if (char === '}') depth--;
        }
        if (foundOpen && depth <= 0) { endLine = j + 1; i = j; break; }
      }

      const bodyText = bodyLines.join('\n');
      const { isStub, reason } = detectStubStatus(bodyText);

      let kind = 'function';
      if (/^[A-Z]/.test(name) && (relPath.includes('component') || relPath.endsWith('.tsx') || bodyText.includes('<'))) {
        kind = 'component';
      } else if (name.startsWith('use') && name.length > 3 && /^[A-Z]/.test(name[3])) {
        kind = 'hook';
      } else if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name) || relPath.includes('api/') || relPath.includes('routes/')) {
        kind = 'apiRoute';
      }

      const sigLine = lines[startLine - 1];
      const braceIdx = sigLine.indexOf('{');
      const signature = braceIdx !== -1 ? sigLine.substring(0, braceIdx).trim() : sigLine.trim();

      symbols.push({
        name,
        kind,
        startLine,
        endLine,
        signature,
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: trimmed.startsWith('export')
      });
      continue;
    }

    // Const Arrow Function / Component Declaration
    const arrowMatch = trimmed.match(/^(export\s+)?const\s+([A-Za-z0-9_$]+)(\s*:\s*[^=]+)?\s*=\s*(async\s*)?(\([^)]*\)|[A-Za-z0-9_$]+)\s*(:\s*[^=]+)?\s*=>/);
    if (arrowMatch) {
      const name = arrowMatch[2];
      const startLine = lineNum;
      let endLine = lineNum;
      let depth = 0;
      let foundOpen = false;
      const bodyLines = [];

      for (let j = i; j < lines.length; j++) {
        bodyLines.push(lines[j]);
        for (const char of lines[j]) {
          if (char === '{') { depth++; foundOpen = true; }
          if (char === '}') depth--;
        }
        if (foundOpen && depth <= 0) { endLine = j + 1; i = j; break; }
        if (!foundOpen && lines[j].includes(';')) { endLine = j + 1; i = j; break; }
      }

      const bodyText = bodyLines.join('\n');
      const { isStub, reason } = detectStubStatus(bodyText);

      let kind = 'function';
      if (/^[A-Z]/.test(name) && (relPath.includes('component') || relPath.endsWith('.tsx') || bodyText.includes('<'))) {
        kind = 'component';
      } else if (name.startsWith('use') && name.length > 3 && /^[A-Z]/.test(name[3])) {
        kind = 'hook';
      }

      const arrowIdx = line.indexOf('=>');
      const signature = arrowIdx !== -1 ? line.substring(0, arrowIdx + 2).trim() : line.trim();

      symbols.push({
        name,
        kind,
        startLine,
        endLine,
        signature,
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: trimmed.startsWith('export')
      });
      continue;
    }

    // Zod Schemas
    const zodMatch = trimmed.match(/^(export\s+)?const\s+([A-Za-z0-9_$]+Schema|[A-Za-z0-9_$]+)\s*=\s*z\./);
    if (zodMatch) {
      const name = zodMatch[2];
      const startLine = lineNum;
      let endLine = lineNum;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes(';')) { endLine = j + 1; i = j; break; }
      }
      symbols.push({
        name,
        kind: 'schema',
        startLine,
        endLine,
        signature: `const ${name} = z...`,
        status: 'DONE',
        isExported: trimmed.startsWith('export')
      });
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// Python Symbol Parser
// -----------------------------------------------------------------------------
function parsePythonSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      imports.push({ line: lineNum, statement: trimmed });
      continue;
    }

    // Class
    const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      const name = classMatch[1];
      const startLine = lineNum;
      const baseIndent = line.match(/^(\s*)/)[1].length;
      let endLine = lineNum;
      const bodyLines = [];

      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed) continue;
        const nextIndent = lines[j].match(/^(\s*)/)[1].length;
        if (nextIndent <= baseIndent) { break; }
        bodyLines.push(lines[j]);
        endLine = j + 1;
        i = j;
      }

      const { isStub, reason } = detectStubStatus(bodyLines.join('\n'));
      symbols.push({
        name,
        kind: 'class',
        startLine,
        endLine,
        signature: line.trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: !name.startsWith('_')
      });
      continue;
    }

    // Function
    const fnMatch = trimmed.match(/^(async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
    if (fnMatch) {
      const name = fnMatch[2];
      const startLine = lineNum;
      const baseIndent = line.match(/^(\s*)/)[1].length;
      let endLine = lineNum;
      const bodyLines = [];

      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed) continue;
        const nextIndent = lines[j].match(/^(\s*)/)[1].length;
        if (nextIndent <= baseIndent) { break; }
        bodyLines.push(lines[j]);
        endLine = j + 1;
        i = j;
      }

      const { isStub, reason } = detectStubStatus(bodyLines.join('\n'));
      symbols.push({
        name,
        kind: 'function',
        startLine,
        endLine,
        signature: line.trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: !name.startsWith('_')
      });
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// Dart Symbol Parser
// -----------------------------------------------------------------------------
function parseDartSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed.startsWith('import ') || trimmed.startsWith('part ')) {
      imports.push({ line: lineNum, statement: trimmed });
      continue;
    }

    // Class
    const classMatch = trimmed.match(/^(abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (classMatch) {
      const name = classMatch[2];
      const startLine = lineNum;
      let endLine = lineNum;
      let depth = 0;
      let foundOpen = false;
      const bodyLines = [];

      for (let j = i; j < lines.length; j++) {
        bodyLines.push(lines[j]);
        for (const char of lines[j]) {
          if (char === '{') { depth++; foundOpen = true; }
          if (char === '}') depth--;
        }
        if (foundOpen && depth <= 0) { endLine = j + 1; i = j; break; }
      }

      const { isStub, reason } = detectStubStatus(bodyLines.join('\n'));
      symbols.push({
        name,
        kind: 'class',
        startLine,
        endLine,
        signature: lines[startLine - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: !name.startsWith('_')
      });
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// Rust Symbol Parser
// -----------------------------------------------------------------------------
function parseRustSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Imports: use ...;
    if (trimmed.startsWith('use ')) {
      let stmt = trimmed;
      let j = i;
      while (!stmt.includes(';') && j + 1 < lines.length) {
        j++;
        stmt += ' ' + lines[j].trim();
      }
      imports.push({ line: lineNum, statement: stmt });
      i = j;
      continue;
    }

    // Module: mod name; or pub mod name; or mod name { ... }
    const modMatch = trimmed.match(/^(pub(\([^)]+\))?\s+)?mod\s+([A-Za-z0-9_]+)/);
    if (modMatch) {
      const name = modMatch[3];
      const isExported = Boolean(modMatch[1]);
      if (isExported) exports.push(name);

      if (trimmed.includes(';')) {
        symbols.push({
          name,
          kind: 'module',
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed,
          status: 'DONE',
          isExported
        });
      } else if (trimmed.includes('{')) {
        const { endLine, nextIndex } = findBraceBlockEnd(lines, i);
        symbols.push({
          name,
          kind: 'module',
          startLine: lineNum,
          endLine,
          signature: lines[lineNum - 1].split('{')[0].trim(),
          status: 'DONE',
          isExported
        });
        i = nextIndex;
      }
      continue;
    }

    // Trait: trait Name or pub trait Name
    const traitMatch = trimmed.match(/^(pub(\([^)]+\))?\s+)?(unsafe\s+)?trait\s+([A-Za-z0-9_]+)/);
    if (traitMatch) {
      const name = traitMatch[4];
      const isExported = Boolean(traitMatch[1]);
      if (isExported) exports.push(name);
      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);
      symbols.push({
        name,
        kind: 'trait',
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported
      });
      i = nextIndex;
      continue;
    }

    // Struct: struct Name or pub struct Name
    const structMatch = trimmed.match(/^(pub(\([^)]+\))?\s+)?struct\s+([A-Za-z0-9_]+)/);
    if (structMatch) {
      const name = structMatch[3];
      const isExported = Boolean(structMatch[1]);
      if (isExported) exports.push(name);

      if (trimmed.includes(';')) {
        symbols.push({
          name,
          kind: 'struct',
          startLine: lineNum,
          endLine: lineNum,
          signature: trimmed,
          status: 'DONE',
          isExported
        });
      } else {
        const { endLine, nextIndex } = findBraceBlockEnd(lines, i);
        symbols.push({
          name,
          kind: 'struct',
          startLine: lineNum,
          endLine,
          signature: lines[lineNum - 1].split('{')[0].trim(),
          status: 'DONE',
          isExported
        });
        i = nextIndex;
      }
      continue;
    }

    // Enum: enum Name or pub enum Name
    const enumMatch = trimmed.match(/^(pub(\([^)]+\))?\s+)?enum\s+([A-Za-z0-9_]+)/);
    if (enumMatch) {
      const name = enumMatch[3];
      const isExported = Boolean(enumMatch[1]);
      if (isExported) exports.push(name);
      const { endLine, nextIndex } = findBraceBlockEnd(lines, i);
      symbols.push({
        name,
        kind: 'enum',
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: 'DONE',
        isExported
      });
      i = nextIndex;
      continue;
    }

    // Impl block: impl Type or impl Trait for Type
    const implMatch = trimmed.match(/^impl(\s*<[^>]+>)?\s+([A-Za-z0-9_:]+)(\s+for\s+([A-Za-z0-9_:]+))?/);
    if (implMatch) {
      const traitOrType = implMatch[2];
      const forType = implMatch[4];
      const name = forType ? `${traitOrType} for ${forType}` : traitOrType;
      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);
      symbols.push({
        name,
        kind: 'impl',
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: false
      });
      i = nextIndex;
      continue;
    }

    // Function: fn or pub fn
    const fnMatch = trimmed.match(/^(pub(\([^)]+\))?\s+)?(async\s+)?(unsafe\s+)?(extern\s+"[^"]+"\s+)?fn\s+([A-Za-z0-9_]+)/);
    if (fnMatch) {
      const name = fnMatch[6];
      const isExported = Boolean(fnMatch[1]);
      if (isExported) exports.push(name);
      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);
      symbols.push({
        name,
        kind: 'function',
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported
      });
      i = nextIndex;
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// C / C++ Symbol Parser
// -----------------------------------------------------------------------------
function parseCppSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Includes: #include <header> or #include "header.h"
    if (trimmed.startsWith('#include')) {
      imports.push({ line: lineNum, statement: trimmed });
      continue;
    }

    // Macros: #define NAME ...
    const macroMatch = trimmed.match(/^#define\s+([A-Za-z0-9_]+)(\([^)]*\))?/);
    if (macroMatch) {
      const name = macroMatch[1];
      symbols.push({
        name,
        kind: 'macro',
        startLine: lineNum,
        endLine: lineNum,
        signature: trimmed,
        status: 'DONE',
        isExported: true
      });
      continue;
    }

    // Namespace: namespace name {
    const nsMatch = trimmed.match(/^namespace\s+([A-Za-z0-9_:]+)/);
    if (nsMatch) {
      const name = nsMatch[1];
      symbols.push({
        name,
        kind: 'namespace',
        startLine: lineNum,
        endLine: lineNum,
        signature: trimmed.split('{')[0].trim(),
        status: 'DONE',
        isExported: true
      });
      continue;
    }

    // Class / Struct
    const classMatch = trimmed.match(/^(template\s*<[^>]+>\s*)?(class|struct)\s+([A-Za-z0-9_]+)/);
    if (classMatch && !trimmed.endsWith(';')) {
      const kind = classMatch[2];
      const name = classMatch[3];
      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);
      symbols.push({
        name,
        kind,
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: true
      });
      exports.push(name);
      i = nextIndex;
      continue;
    }

    // Enum
    const enumMatch = trimmed.match(/^enum(\s+class)?\s+([A-Za-z0-9_]+)/);
    if (enumMatch) {
      const name = enumMatch[2];
      const { endLine, nextIndex } = findBraceBlockEnd(lines, i);
      symbols.push({
        name,
        kind: 'enum',
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: 'DONE',
        isExported: true
      });
      exports.push(name);
      i = nextIndex;
      continue;
    }

    // Function definition: type name(...) {
    const fnMatch = trimmed.match(/^([A-Za-z0-9_:<>&*~]+)\s+([A-Za-z0-9_:]+)\s*\(([^)]*)\)\s*(const|noexcept|override|final)*\s*\{/);
    if (fnMatch) {
      const name = fnMatch[2];
      if (!['if', 'while', 'for', 'switch', 'catch'].includes(name)) {
        const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
        const { isStub, reason } = detectStubStatus(bodyText);
        symbols.push({
          name,
          kind: 'function',
          startLine: lineNum,
          endLine,
          signature: lines[lineNum - 1].split('{')[0].trim(),
          status: isStub ? 'STUB' : 'DONE',
          stubReason: reason,
          isExported: !trimmed.startsWith('static ')
        });
        i = nextIndex;
        continue;
      }
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// C# Symbol Parser
// -----------------------------------------------------------------------------
function parseCsharpSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Using directive: using System;
    if (trimmed.startsWith('using ') && trimmed.endsWith(';') && !trimmed.includes('(')) {
      imports.push({ line: lineNum, statement: trimmed });
      continue;
    }

    // Namespace
    const nsMatch = trimmed.match(/^namespace\s+([A-Za-z0-9_.]+)/);
    if (nsMatch) {
      symbols.push({
        name: nsMatch[1],
        kind: 'namespace',
        startLine: lineNum,
        endLine: lineNum,
        signature: trimmed.replace(/[{;]/g, '').trim(),
        status: 'DONE',
        isExported: true
      });
      continue;
    }

    // Class / Interface / Struct / Enum / Record
    const typeMatch = trimmed.match(/^(public|private|protected|internal|abstract|sealed|static|partial|\s+)*(class|interface|struct|enum|record)\s+([A-Za-z0-9_]+)/);
    if (typeMatch && !trimmed.endsWith(';')) {
      const kind = typeMatch[2];
      const name = typeMatch[3];
      const isPublic = /^(public|internal)/.test(trimmed);
      if (isPublic) exports.push(name);

      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);

      symbols.push({
        name,
        kind,
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: isPublic
      });

      // Also scan method signatures inside this type body
      for (let k = i + 1; k < endLine - 1; k++) {
        const memberLine = lines[k].trim();
        if (!memberLine || memberLine.startsWith('//') || memberLine.startsWith('[')) continue;

        // Method match: [modifiers] [returnType] MethodName(...)
        const methodMatch = memberLine.match(/^(public|private|protected|internal|static|async|virtual|override|abstract|\s+)+([A-Za-z0-9_<>\[\],\s\?]+)\s+([A-Za-z0-9_]+)\s*(\<[^\>]+\>)?\s*\(([^)]*)\)/);
        if (methodMatch) {
          const methodName = methodMatch[3];
          if (!['if', 'while', 'for', 'foreach', 'switch', 'catch', 'using', 'lock', 'return', 'get', 'set'].includes(methodName)) {
            const mStart = k + 1;
            let mEnd = mStart;
            let mStub = false;
            let mReason = null;

            if (memberLine.includes('{') || (k + 1 < lines.length && lines[k + 1].trim().startsWith('{'))) {
              const res = findBraceBlockEnd(lines, k);
              mEnd = res.endLine;
              k = res.nextIndex;
              const stubCheck = detectStubStatus(res.bodyText);
              mStub = stubCheck.isStub;
              mReason = stubCheck.reason;
            } else if (memberLine.includes(';')) {
              mEnd = mStart;
            }

            symbols.push({
              name: `${name}.${methodName}`,
              kind: 'method',
              startLine: mStart,
              endLine: mEnd,
              signature: memberLine.split('{')[0].trim(),
              status: mStub ? 'STUB' : 'DONE',
              stubReason: mReason,
              isExported: /^(public|internal)/.test(memberLine)
            });
          }
        }
      }

      i = nextIndex;
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// Java Symbol Parser
// -----------------------------------------------------------------------------
function parseJavaSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Package: package com.company.pkg;
    if (trimmed.startsWith('package ') && trimmed.endsWith(';')) {
      const pkgName = trimmed.replace(/^package\s+/, '').replace(';', '').trim();
      symbols.push({
        name: pkgName,
        kind: 'package',
        startLine: lineNum,
        endLine: lineNum,
        signature: trimmed,
        status: 'DONE',
        isExported: true
      });
      continue;
    }

    // Import: import java.util.List;
    if (trimmed.startsWith('import ') && trimmed.endsWith(';')) {
      imports.push({ line: lineNum, statement: trimmed });
      continue;
    }

    // Class / Interface / Enum / Record
    const typeMatch = trimmed.match(/^(public|protected|private|abstract|static|final|\s+)*(class|interface|enum|record)\s+([A-Za-z0-9_]+)/);
    if (typeMatch && !trimmed.endsWith(';')) {
      const kind = typeMatch[2];
      const name = typeMatch[3];
      const isPublic = trimmed.startsWith('public ');
      if (isPublic) exports.push(name);

      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);

      symbols.push({
        name,
        kind,
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported: isPublic
      });

      // Also scan method signatures inside this class/interface
      for (let k = i + 1; k < endLine - 1; k++) {
        const memberLine = lines[k].trim();
        if (!memberLine || memberLine.startsWith('//') || memberLine.startsWith('@')) continue;

        // Method match: [modifiers] [returnType] methodName(...)
        const methodMatch = memberLine.match(/^(public|protected|private|static|final|abstract|synchronized|\s+)+([A-Za-z0-9_<>\[\],\s]+)\s+([A-Za-z0-9_]+)\s*(\<[^\>]+\>)?\s*\(([^)]*)\)/);
        if (methodMatch) {
          const methodName = methodMatch[3];
          if (!['if', 'while', 'for', 'switch', 'catch', 'synchronized', 'return'].includes(methodName)) {
            const mStart = k + 1;
            let mEnd = mStart;
            let mStub = false;
            let mReason = null;

            if (memberLine.includes('{') || (k + 1 < lines.length && lines[k + 1].trim().startsWith('{'))) {
              const res = findBraceBlockEnd(lines, k);
              mEnd = res.endLine;
              k = res.nextIndex;
              const stubCheck = detectStubStatus(res.bodyText);
              mStub = stubCheck.isStub;
              mReason = stubCheck.reason;
            } else if (memberLine.includes(';')) {
              mEnd = mStart;
            }

            symbols.push({
              name: `${name}.${methodName}`,
              kind: 'method',
              startLine: mStart,
              endLine: mEnd,
              signature: memberLine.split('{')[0].trim(),
              status: mStub ? 'STUB' : 'DONE',
              stubReason: mReason,
              isExported: memberLine.startsWith('public ')
            });
          }
        }
      }

      i = nextIndex;
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// Go Symbol Parser
// -----------------------------------------------------------------------------
function parseGoSymbols(content, relPath) {
  const lines = content.split(/\r?\n/);
  const symbols = [];
  const imports = [];
  const exports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    if (trimmed.startsWith('package ')) {
      symbols.push({
        name: trimmed.replace('package ', '').trim(),
        kind: 'package',
        startLine: lineNum,
        endLine: lineNum,
        signature: trimmed,
        status: 'DONE',
        isExported: true
      });
      continue;
    }

    if (trimmed.startsWith('import ')) {
      imports.push({ line: lineNum, statement: trimmed });
      continue;
    }

    // Function or Method: func ...
    const fnMatch = trimmed.match(/^func\s*(\([^)]+\)\s*)?([A-Za-z0-9_]+)\s*\(/);
    if (fnMatch) {
      const name = fnMatch[2];
      const isExported = /^[A-Z]/.test(name);
      if (isExported) exports.push(name);
      const { endLine, nextIndex, bodyText } = findBraceBlockEnd(lines, i);
      const { isStub, reason } = detectStubStatus(bodyText);
      symbols.push({
        name,
        kind: 'function',
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: isStub ? 'STUB' : 'DONE',
        stubReason: reason,
        isExported
      });
      i = nextIndex;
      continue;
    }

    // Struct or Interface: type Name struct/interface
    const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      const kind = typeMatch[2];
      const isExported = /^[A-Z]/.test(name);
      if (isExported) exports.push(name);
      const { endLine, nextIndex } = findBraceBlockEnd(lines, i);
      symbols.push({
        name,
        kind,
        startLine: lineNum,
        endLine,
        signature: lines[lineNum - 1].split('{')[0].trim(),
        status: 'DONE',
        isExported
      });
      i = nextIndex;
      continue;
    }
  }

  return { symbols, imports, exports };
}

// -----------------------------------------------------------------------------
// Collector & Incremental Scanner
// -----------------------------------------------------------------------------
function collectSourceFiles(targetDir = ROOT_DIR) {
  const files = [];

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
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(targetDir);
  return files;
}

// -----------------------------------------------------------------------------
// CLI Runner
// -----------------------------------------------------------------------------
export function runSymbolIndexer(args = process.argv.slice(2)) {
  ensureExecDir();
  const isForce = args.includes('--force');
  const isQuiet = args.includes('--quiet');
  const startTime = performance.now();

  const sourceFiles = collectSourceFiles();
  const existingRegistry = isForce ? null : readJsonSafe(REGISTRY_FILE);
  const responsibilityIndex = readJsonSafe(INDEX_FILE) || { files: {} };

  const updatedRegistry = {
    version: '5.2.0',
    generatedAt: new Date().toISOString(),
    totalFiles: sourceFiles.length,
    totalSymbols: 0,
    files: {}
  };

  const doneList = [];
  const stubList = [];

  let cacheHits = 0;
  let parsedCount = 0;

  for (const fullPath of sourceFiles) {
    const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const currentHash = sha1(content);
    const cachedFile = existingRegistry?.files?.[relPath];

    let fileSymbols;
    if (cachedFile && cachedFile.sha1 === currentHash) {
      fileSymbols = cachedFile;
      cacheHits++;
    } else {
      parsedCount++;
      const ext = path.extname(fullPath).toLowerCase();
      let parseResult = { symbols: [], imports: [], exports: [] };

      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        parseResult = parseTsJsSymbols(content, relPath);
      } else if (ext === '.py') {
        parseResult = parsePythonSymbols(content, relPath);
      } else if (ext === '.dart') {
        parseResult = parseDartSymbols(content, relPath);
      } else if (ext === '.rs') {
        parseResult = parseRustSymbols(content, relPath);
      } else if (['.c', '.h', '.cpp', '.cc', '.hpp'].includes(ext)) {
        parseResult = parseCppSymbols(content, relPath);
      } else if (ext === '.cs') {
        parseResult = parseCsharpSymbols(content, relPath);
      } else if (ext === '.java') {
        parseResult = parseJavaSymbols(content, relPath);
      } else if (ext === '.go') {
        parseResult = parseGoSymbols(content, relPath);
      }

      fileSymbols = {
        filePath: relPath,
        sha1: currentHash,
        extension: ext,
        totalLines: content.split(/\r?\n/).length,
        exports: parseResult.exports,
        imports: parseResult.imports,
        symbols: parseResult.symbols
      };
    }

    updatedRegistry.files[relPath] = fileSymbols;
    updatedRegistry.totalSymbols += fileSymbols.symbols.length;

    const fileOwner = responsibilityIndex.files[relPath]?.owner || 'fullstack-backend-engineer';

    // Populate Ledger entries
    for (const sym of fileSymbols.symbols) {
      const ref = `${relPath}:${sym.name}`;
      const lineRange = `L${sym.startLine}-L${sym.endLine}`;

      if (sym.status === 'DONE') {
        doneList.push({
          ref,
          kind: sym.kind,
          signature: sym.signature,
          lines: lineRange,
          owner: fileOwner
        });
      } else {
        stubList.push({
          ref,
          kind: sym.kind,
          signature: sym.signature,
          lines: lineRange,
          reason: sym.stubReason || 'Unimplemented body',
          owner: fileOwner
        });
      }
    }
  }

  const completionPct = updatedRegistry.totalSymbols > 0
    ? ((doneList.length / updatedRegistry.totalSymbols) * 100).toFixed(1)
    : '100.0';

  const progressLedger = {
    version: '5.2.0',
    generatedAt: new Date().toISOString(),
    summary: {
      totalFilesScanned: sourceFiles.length,
      totalSymbols: updatedRegistry.totalSymbols,
      doneCount: doneList.length,
      stubCount: stubList.length,
      completionPercentage: `${completionPct}%`
    },
    stubs: stubList,
    done: doneList
  };

  atomicWrite(REGISTRY_FILE, updatedRegistry);
  atomicWrite(LEDGER_FILE, progressLedger);

  const elapsed = (performance.now() - startTime).toFixed(1);

  if (!isQuiet) {
    console.log(`\n⚡ SYMBOL REGISTRY INDEXED (<${elapsed}ms)`);
    console.log('='.repeat(50));
    console.log(`Files Scanned:  ${sourceFiles.length} (${cacheHits} cache hits, ${parsedCount} parsed)`);
    console.log(`Total Symbols:  ${updatedRegistry.totalSymbols}`);
    console.log(`Progress:       ${doneList.length} [DONE] | ${stubList.length} [STUB] (${completionPct}% complete)`);
    console.log(`\nSaved: ${path.relative(ROOT_DIR, REGISTRY_FILE)}`);
    console.log(`Saved: ${path.relative(ROOT_DIR, LEDGER_FILE)}\n`);
  }

  return { registry: updatedRegistry, ledger: progressLedger };
}

if (process.argv[1] && process.argv[1].endsWith('symbol-indexer.mjs')) {
  runSymbolIndexer();
}
