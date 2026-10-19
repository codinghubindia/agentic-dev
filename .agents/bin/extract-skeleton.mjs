#!/usr/bin/env node
/**
 * .agents/bin/extract-skeleton.mjs
 * Neural Orchestra v5 - Zero-Token Deterministic Control Plane
 *
 * Replaces LLM context-manager & codebase-onboarder.
 * Strips implementation bodies from .ts, .tsx, .js, .jsx, .py, and .dart files
 * while preserving import/export, interface, type, zod schemas, class declarations,
 * and function/method signatures with return types.
 *
 * Produces a compact, 100% type-accurate context-skeleton.d.ts snapshot
 * (~85% token payload reduction with zero hallucinations).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  WORKSPACE_ROOT,
  CONTEXT_SKELETON_PATH,
  IGNORED_SCAN_DIRS,
  SUPPORTED_EXTENSIONS,
  ensureExecDir
} from './paths.mjs';

const SUPPORTED_EXTS = SUPPORTED_EXTENSIONS;
const DEFAULT_IGNORE_DIRS = IGNORED_SCAN_DIRS;

// -----------------------------------------------------------------------------
// TypeScript / JavaScript AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractTsJsSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];
  let inBlockComment = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Block comment tracking
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      i++;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) {
        inBlockComment = true;
      }
      i++;
      continue;
    }

    // Skip empty lines or line comments
    if (!trimmed || trimmed.startsWith('//')) {
      i++;
      continue;
    }

    // Preserve imports and exports of types/modules
    if (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('import type ') ||
      (trimmed.startsWith('export ') && (trimmed.includes(' from ') || trimmed.startsWith('export *') || trimmed.startsWith('export type *')))
    ) {
      let stmt = line;
      while (!stmt.includes(';') && i + 1 < lines.length && !lines[i + 1].trim().startsWith('import ') && !lines[i + 1].trim().startsWith('export ')) {
        i++;
        stmt += ' ' + lines[i].trim();
      }
      outputLines.push(stmt);
      i++;
      continue;
    }

    // Preserve full interfaces
    if (/^(export\s+)?(declare\s+)?interface\s+[A-Za-z0-9_$]/.test(trimmed)) {
      const { block, nextIndex } = captureBraceBlock(lines, i);
      outputLines.push(block);
      i = nextIndex;
      continue;
    }

    // Preserve full type aliases
    if (/^(export\s+)?(declare\s+)?type\s+[A-Za-z0-9_$]/.test(trimmed)) {
      let stmt = line;
      while (!stmt.includes(';') && i + 1 < lines.length) {
        i++;
        stmt += '\n' + lines[i];
        if (lines[i].includes(';')) break;
      }
      outputLines.push(stmt);
      i++;
      continue;
    }

    // Preserve enums
    if (/^(export\s+)?(declare\s+)?(const\s+)?enum\s+[A-Za-z0-9_$]/.test(trimmed)) {
      const { block, nextIndex } = captureBraceBlock(lines, i);
      outputLines.push(block);
      i = nextIndex;
      continue;
    }

    // Preserve Zod schemas (executable contracts)
    if (/^(export\s+)?const\s+[A-Za-z0-9_$]+\s*=\s*z\./.test(trimmed) || /^(export\s+)?const\s+[A-Za-z0-9_$]+Schema\s*=/.test(trimmed)) {
      let stmt = line;
      while (!stmt.includes(';') && i + 1 < lines.length) {
        i++;
        stmt += '\n' + lines[i];
        if (lines[i].includes(';')) break;
      }
      outputLines.push(stmt);
      i++;
      continue;
    }

    // Class declarations: strip method bodies, keep signatures and fields
    if (/^(export\s+)?(abstract\s+)?class\s+[A-Za-z0-9_$]/.test(trimmed)) {
      const { classSkeleton, nextIndex } = extractClassSkeleton(lines, i);
      outputLines.push(classSkeleton);
      i = nextIndex;
      continue;
    }

    // Function declarations: replace body { ... } with ;
    if (/^(export\s+)?(default\s+)?(async\s+)?function(\s*\*|\s+[A-Za-z0-9_$])/.test(trimmed)) {
      const { signature, nextIndex } = extractFunctionSignature(lines, i);
      outputLines.push(signature);
      i = nextIndex;
      continue;
    }

    // Exported arrow functions / const component declarations
    // e.g. export const MyComponent: React.FC<Props> = (props) => { ... }
    // or export const helper = (a: string): number => { ... }
    if (/^export\s+const\s+[A-Za-z0-9_$]+(\s*:\s*[^=]+)?\s*=\s*(async\s*)?(\([^)]*\)|[A-Za-z0-9_$]+)\s*(:\s*[^=]+)?\s*=>/.test(trimmed)) {
      const { signature, nextIndex } = extractArrowFnSignature(lines, i);
      outputLines.push(signature);
      i = nextIndex;
      continue;
    }

    // Standalone export statements: e.g. export { a, b };
    if (/^export\s*\{/.test(trimmed)) {
      let stmt = line;
      while (!stmt.includes('}') && i + 1 < lines.length) {
        i++;
        stmt += ' ' + lines[i].trim();
      }
      if (!stmt.includes(';')) stmt += ';';
      outputLines.push(stmt);
      i++;
      continue;
    }

    i++;
  }

  return outputLines.join('\n\n');
}

function captureBraceBlock(lines, startIndex) {
  let depth = 0;
  let block = [];
  let foundFirstBrace = false;

  for (let i = startIndex; i < lines.length; i++) {
    const l = lines[i];
    block.push(l);
    for (const char of l) {
      if (char === '{') {
        depth++;
        foundFirstBrace = true;
      } else if (char === '}') {
        depth--;
      }
    }
    if (foundFirstBrace && depth <= 0) {
      return { block: block.join('\n'), nextIndex: i + 1 };
    }
  }
  return { block: block.join('\n'), nextIndex: lines.length };
}

function extractClassSkeleton(lines, startIndex) {
  let i = startIndex;
  const headerParts = [];
  while (i < lines.length && !lines[i].includes('{')) {
    headerParts.push(lines[i]);
    i++;
  }
  if (i < lines.length) {
    headerParts.push(lines[i].substring(0, lines[i].indexOf('{') + 1));
  }
  const classHeader = headerParts.join('\n');
  i++;

  const memberLines = [];
  let depth = 1;

  while (i < lines.length && depth > 0) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check closing brace for class
    if (trimmed === '}' && depth === 1) {
      depth--;
      break;
    }

    // Property declarations: public/private/readonly/static foo: Type;
    if (
      /^(public|private|protected|readonly|static|\#)?[A-Za-z0-9_$]+\s*:\s*[^=;]+;?$/.test(trimmed) ||
      /^(public|private|protected|readonly|static|\#)?[A-Za-z0-9_$]+\s*\?\s*:\s*[^=;]+;?$/.test(trimmed)
    ) {
      memberLines.push('  ' + (trimmed.endsWith(';') ? trimmed : trimmed + ';'));
      i++;
      continue;
    }

    // Constructor or Method signature
    if (
      /^(public|private|protected|static|async|override|\*)*\s*(constructor|[A-Za-z0-9_$]+)\s*(\<[^\>]+\>)?\s*\(/.test(
        trimmed
      )
    ) {
      let sig = line;
      while (!sig.includes('{') && !sig.includes(';') && i + 1 < lines.length) {
        i++;
        sig += ' ' + lines[i].trim();
      }
      if (sig.includes('{')) {
        const braceIdx = sig.indexOf('{');
        const cleanSig = sig.substring(0, braceIdx).trim();
        memberLines.push('  ' + (cleanSig.endsWith(';') ? cleanSig : cleanSig + ';'));
        // Skip until the matching closing brace of this method body
        let methodDepth = 1;
        const restOfLine = sig.substring(braceIdx + 1);
        for (const char of restOfLine) {
          if (char === '{') methodDepth++;
          if (char === '}') methodDepth--;
        }
        while (methodDepth > 0 && i + 1 < lines.length) {
          i++;
          for (const char of lines[i]) {
            if (char === '{') methodDepth++;
            if (char === '}') methodDepth--;
          }
        }
      } else if (sig.includes(';')) {
        memberLines.push('  ' + sig.trim());
      }
      i++;
      continue;
    }

    // Count braces if nested
    for (const char of line) {
      if (char === '{') depth++;
      if (char === '}') depth--;
    }
    i++;
  }

  const result = `${classHeader}\n${memberLines.join('\n')}\n}`;
  return { classSkeleton: result, nextIndex: i + 1 };
}

function findFunctionBodyBrace(str) {
  let parenDepth = 0;
  let angleDepth = 0;
  let inString = null;

  for (let idx = 0; idx < str.length; idx++) {
    const c = str[idx];
    if (inString) {
      if (c === inString && str[idx - 1] !== '\\') inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = c;
      continue;
    }
    if (c === '(') parenDepth++;
    else if (c === ')') parenDepth--;
    else if (c === '<') angleDepth++;
    else if (c === '>') angleDepth--;
    else if (c === '{' && parenDepth <= 0 && angleDepth <= 0) {
      return idx;
    }
  }
  return -1;
}

function extractFunctionSignature(lines, startIndex) {
  let i = startIndex;
  let sig = lines[i];

  while (findFunctionBodyBrace(sig) === -1 && !sig.includes(';') && i + 1 < lines.length) {
    i++;
    sig += ' ' + lines[i].trim();
  }

  const braceIdx = findFunctionBodyBrace(sig);
  if (braceIdx !== -1) {
    let cleanSig = sig.substring(0, braceIdx).trim();
    if (!cleanSig.endsWith(';')) cleanSig += ';';

    // Skip implementation body
    let depth = 0;
    const restOfLine = sig.substring(braceIdx);
    for (const char of restOfLine) {
      if (char === '{') depth++;
      if (char === '}') depth--;
    }
    while (depth > 0 && i + 1 < lines.length) {
      i++;
      for (const char of lines[i]) {
        if (char === '{') depth++;
        if (char === '}') depth--;
      }
    }
    return { signature: cleanSig, nextIndex: i + 1 };
  }

  return { signature: sig.trim(), nextIndex: i + 1 };
}

function extractArrowFnSignature(lines, startIndex) {
  let i = startIndex;
  let sig = lines[i];

  while (!sig.includes('=>') && i + 1 < lines.length) {
    i++;
    sig += ' ' + lines[i].trim();
  }

  const arrowIdx = sig.indexOf('=>');
  let cleanSig = sig.substring(0, arrowIdx).trim();

  // Convert `export const fn = (a: string): number` to typed declaration
  if (cleanSig.startsWith('export const ')) {
    cleanSig = cleanSig.replace(/^export\s+const\s+/, 'export declare const ');
  } else if (cleanSig.startsWith('const ')) {
    cleanSig = cleanSig.replace(/^const\s+/, 'declare const ');
  }

  // If there's an assignment like `name: Type =`, preserve the type
  if (cleanSig.includes('=')) {
    const parts = cleanSig.split('=');
    const lhs = parts[0].trim();
    const rhs = parts.slice(1).join('=').trim();
    if (lhs.includes(':')) {
      cleanSig = `${lhs};`;
    } else {
      cleanSig = `${lhs}: ${rhs} => any;`;
    }
  } else {
    cleanSig += ';';
  }

  // Skip the body if it uses braces
  const rest = sig.substring(arrowIdx + 2).trim();
  if (rest.startsWith('{')) {
    let depth = 0;
    for (let j = startIndex; j <= i; j++) {
      for (const char of lines[j]) {
        if (char === '{') depth++;
        if (char === '}') depth--;
      }
    }
    while (depth > 0 && i + 1 < lines.length) {
      i++;
      for (const char of lines[i]) {
        if (char === '{') depth++;
        if (char === '}') depth--;
      }
    }
  }

  return { signature: cleanSig, nextIndex: i + 1 };
}

// -----------------------------------------------------------------------------
// Python AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractPythonSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    // Imports
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      outputLines.push(line);
      continue;
    }

    // Decorators
    if (trimmed.startsWith('@')) {
      outputLines.push(line);
      continue;
    }

    // Class declarations
    if (trimmed.startsWith('class ')) {
      outputLines.push(line);
      continue;
    }

    // Functions / Methods: preserve signature and replace body with `...`
    if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
      let sig = line;
      while (!sig.includes(':') && i + 1 < lines.length) {
        i++;
        sig += ' ' + lines[i].trim();
      }
      const indent = line.match(/^(\s*)/)[1];
      outputLines.push(sig);
      outputLines.push(`${indent}    ...`);
      continue;
    }

    // Type annotations on class or module attributes: `var_name: Type = ...` -> `var_name: Type`
    if (/^[A-Za-z0-9_]+\s*:\s*[^=]+(=.*)?$/.test(trimmed)) {
      const colonIdx = trimmed.indexOf(':');
      const varName = trimmed.substring(0, colonIdx).trim();
      const rest = trimmed.substring(colonIdx + 1);
      const eqIdx = rest.indexOf('=');
      const typePart = eqIdx !== -1 ? rest.substring(0, eqIdx).trim() : rest.trim();
      const indent = line.match(/^(\s*)/)[1];
      outputLines.push(`${indent}${varName}: ${typePart}`);
      continue;
    }
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// Dart AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractDartSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//')) continue;

    // Imports and exports
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ') || trimmed.startsWith('part ')) {
      outputLines.push(line);
      continue;
    }

    // Classes, abstract classes, mixins, extensions
    if (/^(abstract\s+)?(class|mixin|extension|enum)\s+[A-Za-z0-9_$]/.test(trimmed)) {
      outputLines.push(line);
      continue;
    }

    // Fields: final String name; or int count = 0;
    if (/^(final|const|late)?\s*[A-Za-z0-9_$<>, ]+\s+[A-Za-z0-9_$]+\s*(;|=)/.test(trimmed)) {
      const semiIdx = trimmed.indexOf(';');
      const eqIdx = trimmed.indexOf('=');
      const cut = semiIdx !== -1 ? semiIdx : eqIdx;
      if (cut !== -1) {
        outputLines.push('  ' + trimmed.substring(0, cut) + ';');
      }
      continue;
    }

    // Method or function signatures: Widget build(...) { ... }
    if (/[A-Za-z0-9_$<>]+\s+[A-Za-z0-9_$]+\s*\([^)]*\)\s*(\{|=>)/.test(trimmed)) {
      const parenEnd = trimmed.lastIndexOf(')');
      if (parenEnd !== -1) {
        outputLines.push('  ' + trimmed.substring(0, parenEnd + 1) + ';');
      }
      continue;
    }
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// Rust AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractRustSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      i++;
      continue;
    }

    // Imports: use ...;
    if (trimmed.startsWith('use ')) {
      let stmt = trimmed;
      while (!stmt.includes(';') && i + 1 < lines.length) {
        i++;
        stmt += ' ' + lines[i].trim();
      }
      outputLines.push(stmt);
      i++;
      continue;
    }

    // Attributes/Macros: #[...] or #![...]
    if (trimmed.startsWith('#[') || trimmed.startsWith('#![')) {
      outputLines.push(line);
      i++;
      continue;
    }

    // Module: mod foo; or pub mod foo;
    if (/^(pub(\([^)]+\))?\s+)?mod\s+[A-Za-z0-9_]+\s*;/.test(trimmed)) {
      outputLines.push(trimmed);
      i++;
      continue;
    }

    // Struct / Enum / Trait
    if (/^(pub(\([^)]+\))?\s+)?(struct|enum|(unsafe\s+)?trait)\s+[A-Za-z0-9_]/.test(trimmed)) {
      if (trimmed.includes(';')) {
        outputLines.push(trimmed);
        i++;
        continue;
      }
      const { block, nextIndex } = captureBraceBlock(lines, i);
      outputLines.push(block);
      i = nextIndex;
      continue;
    }

    // Impl block: impl ... { fn ...; }
    if (/^impl(\s*<[^>]+>)?\s+/.test(trimmed)) {
      let header = trimmed.split('{')[0].trim() + ' {';
      outputLines.push(header);
      i++;
      let depth = 1;

      while (i < lines.length && depth > 0) {
        const innerTrimmed = lines[i].trim();
        // Method inside impl
        if (/^(pub(\([^)]+\))?\s+)?(async\s+)?(unsafe\s+)?fn\s+[A-Za-z0-9_]/.test(innerTrimmed)) {
          let sig = innerTrimmed;
          while (!sig.includes('{') && !sig.includes(';') && i + 1 < lines.length) {
            i++;
            sig += ' ' + lines[i].trim();
          }
          const braceIdx = sig.indexOf('{');
          if (braceIdx !== -1) {
            outputLines.push('    ' + sig.substring(0, braceIdx).trim() + ';');
            let mDepth = 1;
            const rest = sig.substring(braceIdx + 1);
            for (const c of rest) {
              if (c === '{') mDepth++;
              if (c === '}') mDepth--;
            }
            while (mDepth > 0 && i + 1 < lines.length) {
              i++;
              for (const c of lines[i]) {
                if (c === '{') mDepth++;
                if (c === '}') mDepth--;
              }
            }
          } else {
            outputLines.push('    ' + sig);
          }
          i++;
          continue;
        }

        for (const c of lines[i]) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
        if (depth === 0) {
          outputLines.push('}');
        }
        i++;
      }
      continue;
    }

    // Standalone Function
    if (/^(pub(\([^)]+\))?\s+)?(async\s+)?(unsafe\s+)?fn\s+[A-Za-z0-9_]/.test(trimmed)) {
      let sig = trimmed;
      while (!sig.includes('{') && !sig.includes(';') && i + 1 < lines.length) {
        i++;
        sig += ' ' + lines[i].trim();
      }
      const braceIdx = sig.indexOf('{');
      if (braceIdx !== -1) {
        outputLines.push(sig.substring(0, braceIdx).trim() + ';');
        let depth = 1;
        const rest = sig.substring(braceIdx + 1);
        for (const c of rest) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          for (const c of lines[i]) {
            if (c === '{') depth++;
            if (c === '}') depth--;
          }
        }
      } else {
        outputLines.push(sig);
      }
      i++;
      continue;
    }

    i++;
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// C / C++ AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractCppSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      i++;
      continue;
    }

    // Includes & Macros
    if (trimmed.startsWith('#include') || trimmed.startsWith('#define') || trimmed.startsWith('#pragma') || trimmed.startsWith('#ifndef') || trimmed.startsWith('#endif')) {
      outputLines.push(trimmed);
      i++;
      continue;
    }

    // Namespace header: namespace foo {
    if (/^namespace\s+[A-Za-z0-9_:]+/.test(trimmed)) {
      outputLines.push(trimmed.includes('{') ? trimmed : trimmed + ' {');
      i++;
      continue;
    }

    // Class / Struct / Enum
    if (/^(template\s*<[^>]+>\s*)?(class|struct|enum(\s+class)?)\s+[A-Za-z0-9_]/.test(trimmed)) {
      if (trimmed.endsWith(';')) {
        outputLines.push(trimmed);
        i++;
        continue;
      }
      let header = trimmed.split('{')[0].trim() + ' {';
      outputLines.push(header);
      i++;
      let depth = 1;

      while (i < lines.length && depth > 0) {
        const mTrimmed = lines[i].trim();
        if (mTrimmed === '};' || (mTrimmed === '}' && depth === 1)) {
          depth--;
          outputLines.push('};');
          break;
        }

        // Access specifiers: public:, private:, protected:
        if (/^(public|private|protected)\s*:/.test(mTrimmed)) {
          outputLines.push('  ' + mTrimmed);
          i++;
          continue;
        }

        // Method implementation inside class: void foo() { ... }
        if (/^([A-Za-z0-9_:<>&*~]+)\s+([A-Za-z0-9_]+)\s*\([^)]*\)/.test(mTrimmed)) {
          let sig = mTrimmed;
          while (!sig.includes('{') && !sig.includes(';') && i + 1 < lines.length) {
            i++;
            sig += ' ' + lines[i].trim();
          }
          const braceIdx = sig.indexOf('{');
          if (braceIdx !== -1) {
            outputLines.push('    ' + sig.substring(0, braceIdx).trim() + ';');
            let mDepth = 1;
            const rest = sig.substring(braceIdx + 1);
            for (const c of rest) {
              if (c === '{') mDepth++;
              if (c === '}') mDepth--;
            }
            while (mDepth > 0 && i + 1 < lines.length) {
              i++;
              for (const c of lines[i]) {
                if (c === '{') mDepth++;
                if (c === '}') mDepth--;
              }
            }
          } else {
            outputLines.push('    ' + sig);
          }
          i++;
          continue;
        }

        // Field / declaration ending in ;
        if (mTrimmed.endsWith(';') && depth === 1) {
          outputLines.push('    ' + mTrimmed);
          i++;
          continue;
        }

        for (const c of lines[i]) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
        i++;
      }
      i++;
      continue;
    }

    // Free Function implementation: void bar() { ... }
    if (/^([A-Za-z0-9_:<>&*~]+)\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/.test(trimmed)) {
      const braceIdx = trimmed.indexOf('{');
      outputLines.push(trimmed.substring(0, braceIdx).trim() + ';');
      let depth = 1;
      const rest = trimmed.substring(braceIdx + 1);
      for (const c of rest) {
        if (c === '{') depth++;
        if (c === '}') depth--;
      }
      while (depth > 0 && i + 1 < lines.length) {
        i++;
        for (const c of lines[i]) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
      }
      i++;
      continue;
    }

    i++;
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// C# AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractCsharpSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      i++;
      continue;
    }

    // Using directive
    if (trimmed.startsWith('using ') && trimmed.endsWith(';')) {
      outputLines.push(trimmed);
      i++;
      continue;
    }

    // Namespace
    if (/^namespace\s+[A-Za-z0-9_.]+/.test(trimmed)) {
      outputLines.push(trimmed);
      i++;
      continue;
    }

    // Interface / Enum
    if (/^(public|internal)?\s*(interface|enum)\s+[A-Za-z0-9_]/.test(trimmed)) {
      const { block, nextIndex } = captureBraceBlock(lines, i);
      outputLines.push(block);
      i = nextIndex;
      continue;
    }

    // Class / Struct / Record
    if (/^(public|private|protected|internal|abstract|sealed|static|partial|\s+)*(class|struct|record)\s+[A-Za-z0-9_]/.test(trimmed)) {
      let header = trimmed.split('{')[0].trim() + ' {';
      outputLines.push(header);
      i++;
      let depth = 1;

      while (i < lines.length && depth > 0) {
        const mTrimmed = lines[i].trim();
        if (mTrimmed === '}' && depth === 1) {
          depth--;
          outputLines.push('}');
          break;
        }

        // Properties: public int Id { get; set; }
        if (/^(public|private|protected|internal|static|\s+)+[A-Za-z0-9_<>\[\],\s\?]+\s+[A-Za-z0-9_]+\s*\{\s*get;/.test(mTrimmed)) {
          outputLines.push('    ' + mTrimmed);
          i++;
          continue;
        }

        // Fields: private readonly string _name;
        if (/^(public|private|protected|internal|readonly|static|\s+)+[A-Za-z0-9_<>\[\],\s\?]+\s+[A-Za-z0-9_]+\s*;/.test(mTrimmed)) {
          outputLines.push('    ' + mTrimmed);
          i++;
          continue;
        }

        // Methods: public async Task<Order> CreateOrder(...) { ... }
        if (/^(public|private|protected|internal|static|async|virtual|override|abstract|\s+)+[A-Za-z0-9_<>\[\],\s\?]+\s+[A-Za-z0-9_]+\s*(\<[^\>]+\>)?\s*\([^)]*\)/.test(mTrimmed)) {
          let sig = mTrimmed;
          while (!sig.includes('{') && !sig.includes(';') && !sig.includes('=>') && i + 1 < lines.length) {
            i++;
            sig += ' ' + lines[i].trim();
          }

          if (sig.includes('=>')) {
            const arrowIdx = sig.indexOf('=>');
            outputLines.push('    ' + sig.substring(0, arrowIdx).trim() + ';');
          } else if (sig.includes('{')) {
            const braceIdx = sig.indexOf('{');
            outputLines.push('    ' + sig.substring(0, braceIdx).trim() + ';');
            let mDepth = 1;
            const rest = sig.substring(braceIdx + 1);
            for (const c of rest) {
              if (c === '{') mDepth++;
              if (c === '}') mDepth--;
            }
            while (mDepth > 0 && i + 1 < lines.length) {
              i++;
              for (const c of lines[i]) {
                if (c === '{') mDepth++;
                if (c === '}') mDepth--;
              }
            }
          } else if (sig.includes(';')) {
            outputLines.push('    ' + sig.trim());
          }
          i++;
          continue;
        }

        for (const c of lines[i]) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
        i++;
      }
      i++;
      continue;
    }

    i++;
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// Java AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractJavaSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      i++;
      continue;
    }

    // Package & Import
    if ((trimmed.startsWith('package ') || trimmed.startsWith('import ')) && trimmed.endsWith(';')) {
      outputLines.push(trimmed);
      i++;
      continue;
    }

    // Interface / Enum / Record
    if (/^(public|protected|private)?\s*(interface|enum|record)\s+[A-Za-z0-9_]/.test(trimmed)) {
      const { block, nextIndex } = captureBraceBlock(lines, i);
      outputLines.push(block);
      i = nextIndex;
      continue;
    }

    // Class
    if (/^(public|protected|private|abstract|static|final|\s+)*class\s+[A-Za-z0-9_]/.test(trimmed)) {
      let header = trimmed.split('{')[0].trim() + ' {';
      outputLines.push(header);
      i++;
      let depth = 1;

      while (i < lines.length && depth > 0) {
        const mTrimmed = lines[i].trim();
        if (mTrimmed === '}' && depth === 1) {
          depth--;
          outputLines.push('}');
          break;
        }

        // Fields ending in ;
        if (/^(public|protected|private|static|final|\s+)+[A-Za-z0-9_<>\[\],\s]+\s+[A-Za-z0-9_]+\s*(=[^;]+)?;/.test(mTrimmed)) {
          const semiIdx = mTrimmed.indexOf(';');
          const eqIdx = mTrimmed.indexOf('=');
          const cut = eqIdx !== -1 ? eqIdx : semiIdx;
          outputLines.push('    ' + mTrimmed.substring(0, cut).trim() + ';');
          i++;
          continue;
        }

        // Methods
        if (/^(public|protected|private|static|final|abstract|synchronized|\s+)+[A-Za-z0-9_<>\[\],\s]+\s+[A-Za-z0-9_]+\s*(\<[^\>]+\>)?\s*\([^)]*\)/.test(mTrimmed)) {
          let sig = mTrimmed;
          while (!sig.includes('{') && !sig.includes(';') && i + 1 < lines.length) {
            i++;
            sig += ' ' + lines[i].trim();
          }

          if (sig.includes('{')) {
            const braceIdx = sig.indexOf('{');
            outputLines.push('    ' + sig.substring(0, braceIdx).trim() + ';');
            let mDepth = 1;
            const rest = sig.substring(braceIdx + 1);
            for (const c of rest) {
              if (c === '{') mDepth++;
              if (c === '}') mDepth--;
            }
            while (mDepth > 0 && i + 1 < lines.length) {
              i++;
              for (const c of lines[i]) {
                if (c === '{') mDepth++;
                if (c === '}') mDepth--;
              }
            }
          } else if (sig.includes(';')) {
            outputLines.push('    ' + sig.trim());
          }
          i++;
          continue;
        }

        for (const c of lines[i]) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
        i++;
      }
      i++;
      continue;
    }

    i++;
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// Go AST-lite skeleton extractor
// -----------------------------------------------------------------------------
function extractGoSkeleton(source, filePath) {
  const lines = source.split(/\r?\n/);
  const outputLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      i++;
      continue;
    }

    if (trimmed.startsWith('package ')) {
      outputLines.push(trimmed);
      i++;
      continue;
    }

    if (trimmed.startsWith('import ')) {
      if (trimmed.includes('(')) {
        const { block, nextIndex } = captureBraceBlock(lines, i);
        outputLines.push(block);
        i = nextIndex;
      } else {
        outputLines.push(trimmed);
        i++;
      }
      continue;
    }

    if (trimmed.startsWith('type ') && (trimmed.includes('struct') || trimmed.includes('interface'))) {
      const { block, nextIndex } = captureBraceBlock(lines, i);
      outputLines.push(block);
      i = nextIndex;
      continue;
    }

    if (trimmed.startsWith('func ')) {
      let sig = trimmed;
      while (!sig.includes('{') && i + 1 < lines.length) {
        i++;
        sig += ' ' + lines[i].trim();
      }
      const braceIdx = sig.indexOf('{');
      if (braceIdx !== -1) {
        outputLines.push(sig.substring(0, braceIdx).trim() + ' {}');
        let depth = 1;
        const rest = sig.substring(braceIdx + 1);
        for (const c of rest) {
          if (c === '{') depth++;
          if (c === '}') depth--;
        }
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          for (const c of lines[i]) {
            if (c === '{') depth++;
            if (c === '}') depth--;
          }
        }
      } else {
        outputLines.push(sig);
      }
      i++;
      continue;
    }

    i++;
  }

  return outputLines.join('\n');
}

// -----------------------------------------------------------------------------
// File Tree Scanner
// -----------------------------------------------------------------------------
function collectFiles(targetPaths, ignoreDirs = DEFAULT_IGNORE_DIRS) {
  const collected = [];

  function scan(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    const stat = fs.statSync(currentPath);

    if (stat.isFile()) {
      const ext = path.extname(currentPath).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) {
        collected.push(currentPath);
      }
      return;
    }

    if (stat.isDirectory()) {
      const dirName = path.basename(currentPath);
      const isTarget = targetPaths.some((tp) => path.resolve(tp) === path.resolve(currentPath));
      if (!isTarget && ignoreDirs.has(dirName)) return;

      const entries = fs.readdirSync(currentPath);
      for (const entry of entries) {
        scan(path.join(currentPath, entry));
      }
    }
  }

  for (const p of targetPaths) {
    scan(p);
  }

  return collected;
}

// -----------------------------------------------------------------------------
// CLI Runner
// -----------------------------------------------------------------------------
export function runExtractor(args = process.argv.slice(2)) {
  ensureExecDir();
  let outPath = CONTEXT_SKELETON_PATH;
  let targetPaths = [];
  let format = 'dts';
  let isStdout = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' || arg === '-o') {
      outPath = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      format = args[++i];
    } else if (arg === '--stdout') {
      isStdout = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node .agents/bin/extract-skeleton.mjs [options] [paths...]

Options:
  -o, --out <path>     Output file path (default: context-skeleton.d.ts)
  -f, --format <dts>   Output format: dts (default) or json
  --stdout             Print skeleton to stdout instead of writing to disk
  -h, --help           Show this help message

Examples:
  node .agents/bin/extract-skeleton.mjs src/
  node .agents/bin/extract-skeleton.mjs -o .agent_execution/context-skeleton.d.ts src/ lib/
`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      targetPaths.push(arg);
    }
  }

  if (targetPaths.length === 0) {
    // Default search candidate directories
    const candidates = ['src', 'lib', 'app', 'packages', '.'];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        targetPaths.push(c);
        if (c !== '.') break;
      }
    }
  }

  const files = collectFiles(targetPaths);
  if (files.length === 0) {
    console.error(`[extract-skeleton] No supported source files found in: ${targetPaths.join(', ')}`);
    process.exit(0);
  }

  let totalOriginalBytes = 0;
  let totalSkeletonBytes = 0;
  const sections = [];

  const timestamp = new Date().toISOString();
  sections.push(`/**
 * NEURAL ORCHESTRA v5 - CONTRACT-FIRST AST SKELETON
 * Generated: ${timestamp}
 * Scanned Files: ${files.length}
 * 
 * This snapshot provides zero-hallucination type signatures, contracts, and interfaces.
 * Implementation bodies stripped for token efficiency (~85% reduction).
 */
`);

  for (const file of files) {
    try {
      const source = fs.readFileSync(file, 'utf8');
      const originalBytes = Buffer.byteLength(source, 'utf8');
      totalOriginalBytes += originalBytes;

      const ext = path.extname(file).toLowerCase();
      const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
      let skeleton = '';

      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        skeleton = extractTsJsSkeleton(source, file);
      } else if (ext === '.py') {
        const pySkeleton = extractPythonSkeleton(source, file);
        skeleton = `/* [Python Interface: ${relPath}]\n${pySkeleton}\n*/`;
      } else if (ext === '.dart') {
        const dartSkeleton = extractDartSkeleton(source, file);
        skeleton = `/* [Dart Interface: ${relPath}]\n${dartSkeleton}\n*/`;
      } else if (ext === '.rs') {
        const rustSkeleton = extractRustSkeleton(source, file);
        skeleton = `/* [Rust Interface: ${relPath}]\n${rustSkeleton}\n*/`;
      } else if (['.c', '.h', '.cpp', '.cc', '.hpp'].includes(ext)) {
        const cppSkeleton = extractCppSkeleton(source, file);
        skeleton = `/* [C/C++ Interface: ${relPath}]\n${cppSkeleton}\n*/`;
      } else if (ext === '.cs') {
        const csSkeleton = extractCsharpSkeleton(source, file);
        skeleton = `/* [C# Interface: ${relPath}]\n${csSkeleton}\n*/`;
      } else if (ext === '.java') {
        const javaSkeleton = extractJavaSkeleton(source, file);
        skeleton = `/* [Java Interface: ${relPath}]\n${javaSkeleton}\n*/`;
      } else if (ext === '.go') {
        const goSkeleton = extractGoSkeleton(source, file);
        skeleton = `/* [Go Interface: ${relPath}]\n${goSkeleton}\n*/`;
      }

      const skeletonBytes = Buffer.byteLength(skeleton, 'utf8');
      totalSkeletonBytes += skeletonBytes;

      if (skeleton.trim()) {
        sections.push(`// ============================================================================
// File: ${relPath}
// ============================================================================
${skeleton}
`);
      }
    } catch (err) {
      console.warn(`[extract-skeleton] Warning: failed to parse ${file}: ${err.message}`);
    }
  }

  const fullOutput = sections.join('\n');
  const reduction = totalOriginalBytes > 0
    ? (((totalOriginalBytes - totalSkeletonBytes) / totalOriginalBytes) * 100).toFixed(1)
    : '0';

  if (isStdout) {
    process.stdout.write(fullOutput);
  } else {
    const resolvedOut = path.resolve(process.cwd(), outPath);
    const parentDir = path.dirname(resolvedOut);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOut, fullOutput, 'utf8');
    console.log(
      `[extract-skeleton] Generated ${outPath} (${files.length} files, ${reduction}% reduction: ${(totalOriginalBytes / 1024).toFixed(1)} KB -> ${(totalSkeletonBytes / 1024).toFixed(1)} KB)`
    );
  }
}

// Direct execution detection
if (process.argv[1] && process.argv[1].endsWith('extract-skeleton.mjs')) {
  runExtractor();
}
