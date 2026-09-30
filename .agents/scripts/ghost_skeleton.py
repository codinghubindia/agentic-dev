#!/usr/bin/env python3
"""
Ghost Skeleton: Ultra-Fast Deterministic AST & Signature Extractor
Extracts exported types, interfaces, classes, functions, and DB schemas at 0 LLM tokens.
"""

import os
import sys
import re
import json
import argparse

IGNORE_DIRS = {
    'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next',
    '__pycache__', 'venv', '.venv', 'vendor', '.agent_execution', '.gemini'
}

EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.prisma', '.sql'
}

def extract_typescript_signatures(content: str) -> list:
    signatures = []
    # Match interfaces
    for m in re.finditer(r'(?:export\s+)?interface\s+([A-Za-z0-9_]+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{([^}]*)\}', content):
        name = m.group(1)
        body = m.group(2).strip()
        body_clean = '; '.join([l.strip() for l in body.splitlines() if l.strip()])
        signatures.append(f"interface {name} {{ {body_clean} }}")
    
    # Match types
    for m in re.finditer(r'(?:export\s+)?type\s+([A-Za-z0-9_]+)(?:<[^>]+>)?\s*=\s*([^;]+);', content):
        name = m.group(1)
        val = ' '.join(m.group(2).split())
        signatures.append(f"type {name} = {val}")

    # Match exported functions
    for m in re.finditer(r'export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?', content):
        name = m.group(1)
        params = ' '.join(m.group(2).split())
        ret = m.group(3).strip() if m.group(3) else 'void'
        signatures.append(f"function {name}({params}): {ret}")

    # Match exported classes and their public methods
    for m in re.finditer(r'export\s+class\s+([A-Za-z0-9_]+)(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?(?:\s+implements\s+[^{]+)?\s*\{', content):
        signatures.append(f"class {m.group(1)}")

    return signatures

def extract_python_signatures(content: str) -> list:
    signatures = []
    # Classes
    for m in re.finditer(r'class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:', content):
        name = m.group(1)
        bases = m.group(2) if m.group(2) else ""
        signatures.append(f"class {name}({bases})")

    # Functions
    for m in re.finditer(r'(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:', content):
        name = m.group(1)
        params = ' '.join(m.group(2).split())
        ret = m.group(3).strip() if m.group(3) else "Any"
        signatures.append(f"def {name}({params}) -> {ret}")

    return signatures

def extract_prisma_models(content: str) -> list:
    models = []
    for m in re.finditer(r'model\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}', content):
        name = m.group(1)
        fields = [f.strip().split()[0] + ':' + f.strip().split()[1] 
                  for f in m.group(2).splitlines() if f.strip() and not f.strip().startswith('//') and len(f.strip().split()) >= 2]
        models.append(f"model {name} {{ {', '.join(fields[:10])} }}")
    return models

def scan_codebase(root_dir: str, target_symbols: list = None) -> dict:
    skeleton = {}
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        for f in files:
            ext = os.path.splitext(f)[1]
            if ext in EXTENSIONS:
                filepath = os.path.join(root, f)
                relpath = os.path.relpath(filepath, root_dir).replace('\\', '/')
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                except Exception:
                    continue

                sigs = []
                if ext in ('.ts', '.tsx', '.js', '.jsx'):
                    sigs = extract_typescript_signatures(content)
                elif ext == '.py':
                    sigs = extract_python_signatures(content)
                elif ext == '.prisma':
                    sigs = extract_prisma_models(content)

                if sigs:
                    if target_symbols:
                        # Filter to reachability query
                        matched = [s for s in sigs if any(sym.lower() in s.lower() for sym in target_symbols)]
                        if matched:
                            skeleton[relpath] = matched
                    else:
                        skeleton[relpath] = sigs

    return skeleton

def main():
    parser = argparse.ArgumentParser(description="Ghost Skeleton Extractor")
    parser.add_argument("--dir", default=".", help="Root directory to scan")
    parser.add_argument("--symbols", nargs="*", help="Filter to symbols for reachability")
    parser.add_argument("--output", help="Output JSON path")
    args = parser.parse_args()

    skeleton = scan_codebase(args.dir, args.symbols)
    output_data = {
        "version": "1.0",
        "scannedRoot": os.path.abspath(args.dir),
        "totalFilesIndexed": len(skeleton),
        "skeleton": skeleton
    }

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2)
        print(f"Ghost skeleton written to {args.output} ({len(skeleton)} files indexed).")
    else:
        print(json.dumps(output_data, indent=2))

if __name__ == "__main__":
    main()
