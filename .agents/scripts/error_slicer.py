#!/usr/bin/env python3
"""
error_slicer.py - Deterministic Compiler & Build Stack Trace Parser (v8.0)
Reduces 300-line stack traces down to a 90-token Error Tuple:
(file, line, column, errorCode, culprit, message)
Supports: TypeScript (tsc), Vite/Rollup, Python, Vitest/Jest, Rust (cargo), ESLint
"""

import sys
import re
import json

def slice_trace(raw_trace: str) -> dict:
    """Parses compiler and build tool stderr to extract actionable, compact error tuples."""
    error_tuple = {
        "file": "unknown",
        "line": 0,
        "column": 0,
        "errorCode": "",
        "message": "",
        "culprit": ""
    }

    if not raw_trace or not raw_trace.strip():
        error_tuple["message"] = "No error output provided"
        return error_tuple

    # 1. TypeScript / ESLint with colons: path/to/file.tsx:12:34 - error TS1234: Message
    ts_colon = re.search(r"([a-zA-Z0-9_\-\.\/\\:]+\.[a-zA-Z0-9]+):(\d+):(\d+)\s*-\s*error\s*(TS\d+)?:?\s*(.+)", raw_trace)
    if ts_colon:
        error_tuple["file"] = ts_colon.group(1).replace("\\", "/")
        error_tuple["line"] = int(ts_colon.group(2))
        error_tuple["column"] = int(ts_colon.group(3))
        error_tuple["errorCode"] = ts_colon.group(4) or ""
        error_tuple["message"] = ts_colon.group(5).strip()
        return error_tuple

    # 2. TypeScript / ESLint with parens: path/to/file.tsx(12,34): error TS1234: Message
    ts_paren = re.search(r"([a-zA-Z0-9_\-\.\/\\:]+\.[a-zA-Z0-9]+)\((\d+),(\d+)\):\s*error\s*(TS\d+)?:?\s*(.+)", raw_trace)
    if ts_paren:
        error_tuple["file"] = ts_paren.group(1).replace("\\", "/")
        error_tuple["line"] = int(ts_paren.group(2))
        error_tuple["column"] = int(ts_paren.group(3))
        error_tuple["errorCode"] = ts_paren.group(4) or ""
        error_tuple["message"] = ts_paren.group(5).strip()
        return error_tuple

    # 3. Vite / Rollup build error: [vite]: Rollup failed to resolve import "X" from "Y"
    vite_match = re.search(r'failed to resolve import ["\']([^"\']+)["\'] from ["\']([^"\']+)["\']', raw_trace)
    if vite_match:
        error_tuple["culprit"] = vite_match.group(1)
        error_tuple["file"] = vite_match.group(2).replace("\\", "/")
        error_tuple["errorCode"] = "VITE_IMPORT_RESOLVE"
        error_tuple["message"] = f"Failed to resolve import '{vite_match.group(1)}'"
        return error_tuple

    # 4. Rust / Cargo: error[E0308]: mismatched types --> src/main.rs:12:34
    rust_match = re.search(r"error\[(E\d+)\]:\s*(.+?)\s*-->\s*([a-zA-Z0-9_\-\.\/\\]+):(\d+):(\d+)", raw_trace, re.DOTALL)
    if rust_match:
        error_tuple["errorCode"] = rust_match.group(1)
        error_tuple["message"] = rust_match.group(2).strip()
        error_tuple["file"] = rust_match.group(3).replace("\\", "/")
        error_tuple["line"] = int(rust_match.group(4))
        error_tuple["column"] = int(rust_match.group(5))
        return error_tuple

    # 5. Python Traceback: File "app.py", line 42, in <module>
    py_match = re.search(r'File "([^"]+)", line (\d+)', raw_trace)
    if py_match:
        error_tuple["file"] = py_match.group(1).replace("\\", "/")
        error_tuple["line"] = int(py_match.group(2))
        lines = [l.strip() for l in raw_trace.strip().splitlines() if l.strip()]
        error_tuple["message"] = lines[-1] if lines else "Python Exception"
        return error_tuple

    # 6. Vitest / Jest: FAIL path/to/file.test.ts > suite > test
    test_match = re.search(r"FAIL\s+([^\s]+\.test\.[a-z]+)", raw_trace)
    if test_match:
        error_tuple["file"] = test_match.group(1).replace("\\", "/")
        error_tuple["message"] = "Test assertion failed"
        assert_line = re.search(r"AssertionError: (.+)", raw_trace)
        if assert_line:
            error_tuple["message"] = assert_line.group(1).strip()
        return error_tuple

    # 7. Fallback: Extract first 3 significant lines
    significant_lines = [l.strip() for l in raw_trace.strip().splitlines() if l.strip() and not l.startswith("npm ERR!")]
    error_tuple["message"] = " | ".join(significant_lines[:3]) if significant_lines else "Unknown build error"
    return error_tuple

if __name__ == "__main__":
    raw_input = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    result = slice_trace(raw_input)
    print(json.dumps(result, indent=2))
