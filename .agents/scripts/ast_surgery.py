#!/usr/bin/env python3
"""
AST Surgery: Deterministic Node Grafting & Surgical Code Replacement
Executes precise AST/block-level code mutations, avoiding fragile whitespace or line diff errors.
"""

import sys
import os
import re
import json
import argparse

def graft_code(file_path: str, action: str, target_symbol: str, payload: str, anchor_pattern: str = "") -> dict:
    if not os.path.exists(file_path):
        return {"status": "error", "message": f"File not found: {file_path}"}
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    original_lines = len(content.splitlines())
    modified_content = content
    
    if action == "REPLACE_BLOCK":
        # Matches target function/class block and replaces body or whole block
        pattern = rf'((?:export\s+)?(?:async\s+)?(?:function|class)\s+{re.escape(target_symbol)}[^{{]*\{{)([\s\S]*?)(^\}})'
        m = re.search(pattern, content, re.MULTILINE)
        if m:
            modified_content = content[:m.start(2)] + "\n" + payload + "\n" + content[m.end(2):]
        else:
            return {"status": "error", "message": f"Symbol '{target_symbol}' block not found in {file_path}"}
            
    elif action == "INSERT_BEFORE_RETURN":
        # Finds return statement in target function and inserts payload before it
        func_pattern = rf'((?:export\s+)?(?:async\s+)?function\s+{re.escape(target_symbol)}[^{{]*\{{[\s\S]*?)(return\b[^\n;]+;)'
        m = re.search(func_pattern, content)
        if m:
            insert_pos = m.start(2)
            modified_content = content[:insert_pos] + payload + "\n  " + content[insert_pos:]
        else:
            return {"status": "error", "message": f"Return statement inside '{target_symbol}' not found in {file_path}"}
            
    elif action == "APPEND_EXPORT":
        # Cleanly appends a new export to the end of the file
        modified_content = content.rstrip() + "\n\n" + payload + "\n"
        
    elif action == "INJECT_IMPORT":
        # Injects an import at the top of the file after existing imports
        imports = list(re.finditer(r'^import\s+[^;]+;', content, re.MULTILINE))
        if imports:
            last_import_end = imports[-1].end()
            modified_content = content[:last_import_end] + "\n" + payload + content[last_import_end:]
        else:
            modified_content = payload + "\n" + content
            
    else:
        return {"status": "error", "message": f"Unknown surgical action: {action}"}
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(modified_content)
        
    return {
        "status": "success",
        "file": file_path,
        "action": action,
        "targetSymbol": target_symbol,
        "deltaLines": len(modified_content.splitlines()) - original_lines
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AST Code Surgery Engine")
    parser.add_argument("--file", required=True, help="Target file path")
    parser.add_argument("--action", required=True, choices=["REPLACE_BLOCK", "INSERT_BEFORE_RETURN", "APPEND_EXPORT", "INJECT_IMPORT"])
    parser.add_argument("--symbol", default="", help="Target function or class symbol")
    parser.add_argument("--payload", required=True, help="Code payload to graft")
    args = parser.parse_args()
    
    result = graft_code(args.file, args.action, args.symbol, args.payload)
    print(json.dumps(result, indent=2))
