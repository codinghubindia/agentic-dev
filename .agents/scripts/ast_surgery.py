#!/usr/bin/env python3
"""
ast_surgery.py - Structural Code Grafting & Boundary Collision Engine
Performs targeted AST replacements, import injections, route grafting,
model merging, and detects boundary collisions across parallel strike teams.
"""

import sys
import os
import re
import json

def inject_import(file_path: str, import_statement: str) -> bool:
    """Injects an import statement at the top of a file if not already present."""
    if not os.path.exists(file_path):
        return False

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if import_statement.strip() in content:
        return True  # Already present

    lines = content.splitlines()
    insert_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("require(") or \
           stripped.startswith("from ") or stripped.startswith("'use client'") or \
           stripped.startswith('"use client"'):
            insert_idx = i + 1

    lines.insert(insert_idx, import_statement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return True

def append_route(file_path: str, route_block: str) -> bool:
    """Appends a route definition or export before the final module.exports or export default."""
    if not os.path.exists(file_path):
        return False

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    insert_idx = len(lines)
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if line.startswith("export default") or line.startswith("module.exports") or line.startswith("if __name__ == '__main__':"):
            insert_idx = i
            break

    lines.insert(insert_idx, "\n" + route_block.strip() + "\n")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return True

def safe_merge_models(file_path: str, model_code: str, syntax: str = "prisma") -> bool:
    """Safely appends a database model or entity schema if not already present."""
    if not os.path.exists(file_path):
        # Create file if missing
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(model_code.strip() + "\n")
        return True

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract model or table identifier to avoid duplicate declarations
    match = re.search(r"(?:model|class|CREATE TABLE)\s+([A-Za-z0-9_]+)", model_code)
    if match:
        identifier = match.group(1)
        if re.search(rf"\b(model|class|CREATE TABLE)\s+{identifier}\b", content):
            return True  # Already defined

    with open(file_path, "a", encoding="utf-8") as f:
        f.write("\n\n" + model_code.strip() + "\n")
    return True

def replace_block(file_path: str, target_anchor: str, replacement: str) -> bool:
    """Replaces a targeted block identified by an anchor string."""
    if not os.path.exists(file_path):
        return False

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if target_anchor not in content:
        return False

    content = content.replace(target_anchor, replacement, 1)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return True

def detect_file_collisions(file_boundaries: dict) -> dict:
    """Detects overlapping file paths among parallel workers and advises resolution."""
    collisions = []
    workers = list(file_boundaries.keys())
    
    for i in range(len(workers)):
        for j in range(i + 1, len(workers)):
            w1 = workers[i]
            w2 = workers[j]
            set1 = set(file_boundaries[w1])
            set2 = set(file_boundaries[w2])
            shared = set1.intersection(set2)
            for f in shared:
                collisions.append({
                    "file": f,
                    "workers": [w1, w2],
                    "resolution": "COLLAPSE_TO_SEQUENTIAL" if f.endswith((".ts", ".js", ".py")) else "AST_SURGERY_MERGE"
                })

    return {
        "hasCollisions": len(collisions) > 0,
        "collisions": collisions,
        "recommendedExecutionMode": "COLLAPSED_SEQUENTIAL" if any(c["resolution"] == "COLLAPSE_TO_SEQUENTIAL" for c in collisions) else "PARALLEL"
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python ast_surgery.py <action> <args...>")
        print("Actions:")
        print("  inject_import <filepath> <import_stmt>")
        print("  append_route <filepath> <route_block>")
        print("  merge_model <filepath> <model_block> [syntax]")
        print("  replace_block <filepath> <target_anchor> <replacement>")
        print("  detect_collisions <boundaries_json_file_or_string>")
        sys.exit(1)

    action = sys.argv[1]

    if action == "inject_import":
        filepath = sys.argv[2]
        payload = sys.argv[3]
        success = inject_import(filepath, payload)
    elif action == "append_route":
        filepath = sys.argv[2]
        payload = sys.argv[3]
        success = append_route(filepath, payload)
    elif action == "merge_model":
        filepath = sys.argv[2]
        payload = sys.argv[3]
        syntax = sys.argv[4] if len(sys.argv) > 4 else "prisma"
        success = safe_merge_models(filepath, payload, syntax)
    elif action == "replace_block":
        filepath = sys.argv[2]
        anchor = sys.argv[3]
        payload = sys.argv[4]
        success = replace_block(filepath, anchor, payload)
    elif action == "detect_collisions":
        arg = sys.argv[2]
        if os.path.exists(arg):
            with open(arg, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            try:
                data = json.loads(arg)
            except Exception:
                # Try normalizing quotes from PowerShell
                normalized = arg.replace("'", '"')
                data = json.loads(normalized)
        result = detect_file_collisions(data)
        print(json.dumps(result, indent=2))
        sys.exit(0)
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)

    if success:
        print(f"AST surgery {action} succeeded on {filepath}")
        sys.exit(0)
    else:
        print(f"AST surgery {action} failed on {filepath}")
        sys.exit(2)
