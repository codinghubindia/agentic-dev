#!/usr/bin/env python3
"""
Error Slicer: Deterministic Compiler & Test Error Parser
Reduces 300-line stack traces (4,500 tokens) to a 90-token Error Tuple.
"""

import sys
import re
import json

def slice_compiler_error(raw_stderr: str) -> dict:
    lines = raw_stderr.splitlines()
    error_tuple = {
        "file": "unknown",
        "line": 0,
        "column": 0,
        "errorCode": "",
        "message": "",
        "culpritSnippet": "",
        "filteredLinesCount": len(lines)
    }
    
    # 1. Check TypeScript / ESLint error patterns (file.ts:line:col - error TSxxxx: message)
    ts_match = re.search(r'([A-Za-z0-9_\-\.\/]+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\s*-\s*error\s*([A-Za-z0-9]+):\s*([^\n]+)', raw_stderr)
    if ts_match:
        error_tuple["file"] = ts_match.group(1).replace("\\", "/")
        error_tuple["line"] = int(ts_match.group(2))
        error_tuple["column"] = int(ts_match.group(3))
        error_tuple["errorCode"] = ts_match.group(4)
        error_tuple["message"] = ts_match.group(5).strip()
        
    # 2. Check Python Traceback (File "...", line X, in ...)
    py_match = re.findall(r'File "([^"]+)", line (\d+), in ([^\n]+)\n\s*([^\n]+)', raw_stderr)
    if py_match:
        # Get the last non-library frame
        app_frames = [f for f in py_match if 'site-packages' not in f[0] and 'lib/python' not in f[0]]
        target_frame = app_frames[-1] if app_frames else py_match[-1]
        error_tuple["file"] = target_frame[0].replace("\\", "/")
        error_tuple["line"] = int(target_frame[1])
        error_tuple["message"] = f"In {target_frame[2]}: {target_frame[3]}"
        error_tuple["culpritSnippet"] = target_frame[3].strip()
        
    # 3. Check Rust / Cargo errors (error[Exxxx]: ... --> file.rs:line:col)
    rust_match = re.search(r'error(?:\[([A-Za-z0-9]+)\])?:\s*([^\n]+)\n\s*-->\s*([A-Za-z0-9_\-\.\/]+\.rs):(\d+):(\d+)', raw_stderr)
    if rust_match:
        error_tuple["errorCode"] = rust_match.group(1) or ""
        error_tuple["message"] = rust_match.group(2).strip()
        error_tuple["file"] = rust_match.group(3).replace("\\", "/")
        error_tuple["line"] = int(rust_match.group(4))
        error_tuple["column"] = int(rust_match.group(5))

    # If no structured pattern matched, grab the first 3 lines containing 'error'
    if error_tuple["file"] == "unknown":
        err_lines = [l.strip() for l in lines if re.search(r'\b(error|fail|cannot find|exception)\b', l, re.IGNORECASE)]
        error_tuple["message"] = " | ".join(err_lines[:3]) if err_lines else lines[0][:150] if lines else "Unknown error"

    return error_tuple

if __name__ == "__main__":
    raw_input = sys.stdin.read()
    tuple_result = slice_compiler_error(raw_input)
    print(json.dumps(tuple_result, indent=2))
