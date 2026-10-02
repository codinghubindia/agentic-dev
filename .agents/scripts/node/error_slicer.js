#!/usr/bin/env node
/**
 * error_slicer.js - Deterministic Compiler & Build Stack Trace Parser (v8.0)
 * Reduces 300-line stack traces down to a 90-token Error Tuple:
 * (file, line, column, errorCode, culprit, message)
 * Supports: TypeScript (tsc), Vite/Rollup, Python, Vitest/Jest, Rust (cargo), ESLint
 */

const fs = require('fs');

function sliceTrace(rawTrace) {
    const errorTuple = {
        file: "unknown",
        line: 0,
        column: 0,
        errorCode: "",
        message: "",
        culprit: ""
    };

    if (!rawTrace || !rawTrace.trim()) {
        errorTuple.message = "No error output provided";
        return errorTuple;
    }

    // 1. TypeScript / ESLint with colons: path/to/file.tsx:12:34 - error TS1234: Message
    const tsColon = rawTrace.match(/([a-zA-Z0-9_\-\.\/\\:]+\.[a-zA-Z0-9]+):(\d+):(\d+)\s*-\s*error\s*(TS\d+)?:?\s*(.+)/);
    if (tsColon) {
        errorTuple.file = tsColon[1].replace(/\\/g, '/');
        errorTuple.line = parseInt(tsColon[2], 10);
        errorTuple.column = parseInt(tsColon[3], 10);
        errorTuple.errorCode = tsColon[4] || "";
        errorTuple.message = tsColon[5].trim();
        return errorTuple;
    }

    // 2. TypeScript / ESLint with parens: path/to/file.tsx(12,34): error TS1234: Message
    const tsParen = rawTrace.match(/([a-zA-Z0-9_\-\.\/\\:]+\.[a-zA-Z0-9]+)\((\d+),(\d+)\):\s*error\s*(TS\d+)?:?\s*(.+)/);
    if (tsParen) {
        errorTuple.file = tsParen[1].replace(/\\/g, '/');
        errorTuple.line = parseInt(tsParen[2], 10);
        errorTuple.column = parseInt(tsParen[3], 10);
        errorTuple.errorCode = tsParen[4] || "";
        errorTuple.message = tsParen[5].trim();
        return errorTuple;
    }

    // 3. Vite / Rollup build error: failed to resolve import "X" from "Y"
    const viteMatch = rawTrace.match(/failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/);
    if (viteMatch) {
        errorTuple.culprit = viteMatch[1];
        errorTuple.file = viteMatch[2].replace(/\\/g, '/');
        errorTuple.errorCode = "VITE_IMPORT_RESOLVE";
        errorTuple.message = `Failed to resolve import '${viteMatch[1]}'`;
        return errorTuple;
    }

    // 4. Rust / Cargo: error[E0308]: mismatched types --> src/main.rs:12:34
    const rustMatch = rawTrace.match(/error\[(E\d+)\]:\s*([\s\S]+?)\s*-->\s*([a-zA-Z0-9_\-\.\/\\]+):(\d+):(\d+)/);
    if (rustMatch) {
        errorTuple.errorCode = rustMatch[1];
        errorTuple.message = rustMatch[2].trim().replace(/\n/g, ' ');
        errorTuple.file = rustMatch[3].replace(/\\/g, '/');
        errorTuple.line = parseInt(rustMatch[4], 10);
        errorTuple.column = parseInt(rustMatch[5], 10);
        return errorTuple;
    }

    // 5. Python Traceback: File "app.py", line 42, in <module>
    const pyMatch = rawTrace.match(/File "([^"]+)", line (\d+)/);
    if (pyMatch) {
        errorTuple.file = pyMatch[1].replace(/\\/g, '/');
        errorTuple.line = parseInt(pyMatch[2], 10);
        const lines = rawTrace.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        errorTuple.message = lines[lines.length - 1] || "Python Exception";
        return errorTuple;
    }

    // 6. Vitest / Jest: FAIL path/to/file.test.ts
    const testMatch = rawTrace.match(/FAIL\s+([^\s]+\.test\.[a-z]+)/);
    if (testMatch) {
        errorTuple.file = testMatch[1].replace(/\\/g, '/');
        errorTuple.message = "Test assertion failed";
        const assertLine = rawTrace.match(/AssertionError: (.+)/);
        if (assertLine) {
            errorTuple.message = assertLine[1].trim();
        }
        return errorTuple;
    }

    // 7. Fallback: Extract first 3 significant lines
    const significantLines = rawTrace.trim().split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("npm ERR!"));
    errorTuple.message = significantLines.slice(0, 3).join(" | ") || "Unknown build error";
    return errorTuple;
}

let input = "";
if (process.argv.length > 2) {
    input = process.argv.slice(2).join(" ");
    console.log(JSON.stringify(sliceTrace(input), null, 2));
} else {
    input = fs.readFileSync(0, 'utf-8');
    console.log(JSON.stringify(sliceTrace(input), null, 2));
}
