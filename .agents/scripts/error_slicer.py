#!/usr/bin/env python3
"""
error_slicer.py - Deterministic Compiler & Test Stack Trace Parser
Reduces 300-line stack traces down to a 90-token Error Tuple:
(file, line, column, error_code, culprit, message)
"""

import sys
import re
import json

def slice_trace(raw_trace: str) -> dict:
    """Parses compiler output (tsc, python, rustc, vitest) to extract actionable error tuples."""
    error_tuple = {
        "file": "unknown",
        "line": 0,
        "column": 0,
        "errorCode": "",
        "message": "",
        "culprit": ""
    }

    # TypeScript / ESLint pattern: file.ts(12,34): error TS1234: Message
    ts_match = re.search(r"([a-zA-Z0-9_\-\.\/]+\.tsx?)\((\d+),(\d+)\):\s*error\s*(TS\d+)?:\s*(.+)", raw_trace)
    if ts_match:
        error_tuple["file"] = ts_match.group(1)
        error_tuple["line"] = int(ts_match.group(2))
        error_tuple["column"] = int(ts_match.group(3))
        error_tuple["errorCode"] = ts_match.group(4) or ""
        error_tuple["message"] = ts_match.group(5).strip()
        return error_tuple

    # Python Traceback pattern: File "app.py", line 42, in <module>
    py_match = re.search(r'File "([^"]+)", line (\d+)', raw_trace)
    if py_match:
        error_tuple["file"] = py_match.group(1)
        error_tuple["line"] = int(py_match.group(2))
        lines = [l.strip() for l in raw_trace.strip().splitlines() if l.strip()]
        error_tuple["message"] = lines[-1] if lines else "Python Exception"
        return error_tuple

    # Vitest / Jest pattern: FAIL path/to/file.test.ts > suite > test
    test_match = re.search(r"FAIL\s+([^\s]+\.test\.[a-z]+)", raw_trace)
    if test_match:
        error_tuple["file"] = test_match.group(1)
        error_tuple["message"] = "Test assertion failed"
        # Find AssertionError line
        assert_line = re.search(r"AssertionError: (.+)", raw_trace)
        if assert_line:
            error_tuple["message"] = assert_line.group(1).strip()
        return error_tuple

    # Fallback: Extract first 3 non-empty lines
    lines = [l.strip() for l in raw_trace.strip().splitlines() if l.strip()][:3]
    error_tuple["message"] = " | ".join(lines)
    return error_tuple

if __name__ == "__main__":
    raw_input = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    result = slice_trace(raw_input)
    print(json.dumps(result, indent=2))
