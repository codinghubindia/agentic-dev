#!/usr/bin/env python3
"""
ast_surgery.py - Structural Code Grafting Engine
Performs targeted AST replacements, import injections, and export additions
without formatting destruction or full-file token burn.
"""

import sys
import os
import re

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
    # Find position after existing imports or 'use strict'
    for i, line in enumerate(lines):
        if line.strip().startswith("import ") or line.strip().startswith("require(") or \
           line.strip().startswith("from ") or line.strip().startswith("'use client'") or \
           line.strip().startswith('"use client"'):
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
    # Search for export default or module.exports
    insert_idx = len(lines)
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if line.startswith("export default") or line.startswith("module.exports"):
            insert_idx = i
            break

    lines.insert(insert_idx, "\n" + route_block + "\n")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
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

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python ast_surgery.py <action: inject_import|append_route|replace_block> <filepath> <payload> [anchor]")
        sys.exit(1)

    action = sys.argv[1]
    filepath = sys.argv[2]
    payload = sys.argv[3]
    anchor = sys.argv[4] if len(sys.argv) > 4 else ""

    if action == "inject_import":
        success = inject_import(filepath, payload)
    elif action == "append_route":
        success = append_route(filepath, payload)
    elif action == "replace_block":
        success = replace_block(filepath, anchor, payload)
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)

    if success:
        print(f"AST surgery {action} succeeded on {filepath}")
    else:
        print(f"AST surgery {action} failed on {filepath}")
        sys.exit(2)
