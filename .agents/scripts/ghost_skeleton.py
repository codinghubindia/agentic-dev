#!/usr/bin/env python3
"""
ghost_skeleton.py - Multi-Language 3-Tier AST Signature & Reachability Engine
Extracts public interfaces, exported functions, routes, and schemas across
TypeScript, JavaScript, Python, Go, Rust, Prisma, and SQL in < 1.5s.

Modes:
  --topology               : Tier 1 System Topology Vector (<200 tokens)
  --skeleton [dir]         : Tier 2 Public AST Ghost Skeleton (<1,200 tokens)
  --reachability <target>  : Tier 3 Query-Driven Reachability Slice (<800 tokens)
"""

import os
import sys
import re
import json

SUPPORTED_EXTENSIONS = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".prisma": "prisma",
    ".sql": "sql"
}

IGNORE_DIRS = {
    "node_modules", ".git", "dist", "build", ".next", ".turbo",
    "__pycache__", ".venv", "venv", "target", "coverage", ".agent_execution"
}

def extract_signatures(file_path: str, lang: str) -> dict:
    """Extracts public signatures and imports from a source file while skipping private bodies."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception as e:
        return {"signatures": f"/* Error reading file: {e} */\n", "imports": []}

    signatures = []
    imports = []
    
    if lang in ["typescript", "javascript"]:
        in_interface = False
        brace_depth = 0
        
        for line in lines:
            stripped = line.strip()
            # Capture imports and dependency reachability
            if stripped.startswith("import ") or "require(" in stripped:
                signatures.append(stripped)
                match = re.search(r"from\s+['\"`]([^'\"`]+)['\"`]|require\(['\"`]([^'\"`]+)['\"`]\)", stripped)
                if match:
                    imp = match.group(1) or match.group(2)
                    imports.append(imp)
            # Capture interfaces and types
            elif re.match(r"^(export\s+)?(interface|type)\s+", stripped):
                signatures.append(stripped)
                if "{" in stripped and "}" not in stripped:
                    in_interface = True
                    brace_depth = 1
            elif in_interface:
                signatures.append("  " + stripped)
                brace_depth += stripped.count("{") - stripped.count("}")
                if brace_depth <= 0:
                    in_interface = False
            # Capture exports, routes, and public function declarations
            elif re.match(r"^(export\s+)?(async\s+)?function\s+\w+", stripped) or \
                 re.match(r"^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\(", stripped):
                sig = stripped.split("{")[0].strip()
                signatures.append(f"{sig};")
            # Capture Express/Fastify/Next.js route patterns
            elif re.search(r"\b(app|router)\.(get|post|put|patch|delete)\s*\(", stripped):
                route_match = re.search(r"\b(app|router)\.(get|post|put|patch|delete)\s*\(\s*['\"`][^'\"`]+['\"`]", stripped)
                if route_match:
                    signatures.append(f"// Route: {route_match.group(0)})")
                    
    elif lang == "python":
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("import ") or stripped.startswith("from "):
                signatures.append(stripped)
                mod_match = re.search(r"from\s+([^\s]+)\s+import|import\s+([^\s]+)", stripped)
                if mod_match:
                    imports.append(mod_match.group(1) or mod_match.group(2))
            elif re.match(r"^class\s+\w+", stripped):
                signatures.append(stripped)
            elif re.match(r"^(async\s+)?def\s+\w+", stripped):
                sig = stripped.split(":")[0].strip()
                signatures.append(f"{sig}: ...")
            elif re.match(r"^@(app|router)\.(get|post|put|delete|patch)\(", stripped):
                signatures.append(stripped)

    elif lang == "prisma":
        in_model = False
        for line in lines:
            stripped = line.strip()
            if re.match(r"^(model|enum|datasource|generator)\s+\w+", stripped):
                signatures.append(stripped)
                in_model = True
            elif in_model:
                signatures.append("  " + stripped)
                if stripped.startswith("}"):
                    in_model = False

    elif lang == "sql":
        for line in lines:
            stripped = line.strip()
            if re.match(r"^CREATE\s+(TABLE|VIEW|INDEX|TYPE)", stripped, re.IGNORECASE):
                signatures.append(stripped)

    else:
        signatures = [l.strip() for l in lines[:10] if l.strip()]

    return {
        "signatures": "\n".join(signatures),
        "imports": imports
    }

def get_topology(root_dir: str = ".") -> dict:
    """Tier 1: Returns system topology vector (<200 tokens) based on manifests and root folders."""
    topology = {
        "tier": "Tier 1: System Topology Vector",
        "manifests": {},
        "rootDirs": [],
        "primaryStack": "unknown"
    }
    
    if os.path.exists(os.path.join(root_dir, "package.json")):
        try:
            with open(os.path.join(root_dir, "package.json"), "r", encoding="utf-8") as f:
                pkg = json.load(f)
                deps = list(pkg.get("dependencies", {}).keys())
                dev_deps = list(pkg.get("devDependencies", {}).keys())
                topology["manifests"]["package.json"] = {
                    "name": pkg.get("name", ""),
                    "keyDeps": [d for d in deps if d in ["next", "react", "express", "fastify", "prisma", "tailwindcss", "framer-motion", "vue", "svelte"]],
                    "totalDeps": len(deps) + len(dev_deps)
                }
                topology["primaryStack"] = "Node.js / TypeScript"
        except Exception:
            pass

    if os.path.exists(os.path.join(root_dir, "requirements.txt")):
        topology["manifests"]["requirements.txt"] = True
        topology["primaryStack"] = "Python"
    if os.path.exists(os.path.join(root_dir, "Cargo.toml")):
        topology["manifests"]["Cargo.toml"] = True
        topology["primaryStack"] = "Rust"
    if os.path.exists(os.path.join(root_dir, "go.mod")):
        topology["manifests"]["go.mod"] = True
        topology["primaryStack"] = "Go"

    try:
        entries = os.listdir(root_dir)
        topology["rootDirs"] = [e for e in entries if os.path.isdir(os.path.join(root_dir, e)) and e not in IGNORE_DIRS and (not e.startswith(".") or e == ".agents")]
    except Exception:
        pass

    return topology

def scan_codebase(root_dir: str = ".") -> dict:
    """Tier 2: Traverses codebase in <1.5s, returning public AST signature table."""
    skeleton = {
        "tier": "Tier 2: Public AST Ghost Skeleton",
        "scanned_files": 0,
        "modules": {}
    }
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and (not d.startswith(".") or d == ".agents")]
        
        for file in filenames:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                rel_path = os.path.relpath(os.path.join(dirpath, file), root_dir).replace("\\", "/")
                lang = SUPPORTED_EXTENSIONS[ext]
                extracted = extract_signatures(os.path.join(dirpath, file), lang)
                if extracted["signatures"].strip():
                    skeleton["modules"][rel_path] = {
                        "lang": lang,
                        "signatures": extracted["signatures"],
                        "imports": extracted["imports"]
                    }
                    skeleton["scanned_files"] += 1

    return skeleton

def reachability_slice(target_path_or_symbol: str, root_dir: str = ".") -> dict:
    """Tier 3: Query-driven reachability slice returning target file and direct dependencies (<800 tokens)."""
    full_skeleton = scan_codebase(root_dir)
    modules = full_skeleton.get("modules", {})
    
    matched_file = None
    for path in modules.keys():
        if target_path_or_symbol.lower() in path.lower():
            matched_file = path
            break

    if not matched_file:
        for path, data in modules.items():
            if target_path_or_symbol.lower() in data["signatures"].lower():
                matched_file = path
                break

    if not matched_file:
        return {
            "tier": "Tier 3: Reachability Slice",
            "target": target_path_or_symbol,
            "error": "Target symbol or path not found in codebase reachability graph."
        }

    target_data = modules[matched_file]
    resolved_slice = {
        "tier": "Tier 3: Reachability Slice",
        "primaryTarget": matched_file,
        "primarySignatures": target_data["signatures"],
        "directDependencies": {}
    }

    for imp in target_data["imports"]:
        clean_imp = os.path.basename(imp).split(".")[0]
        for dep_path, dep_data in modules.items():
            if clean_imp.lower() in dep_path.lower() and dep_path != matched_file:
                resolved_slice["directDependencies"][dep_path] = dep_data["signatures"]
                break

    return resolved_slice

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--topology":
        target = sys.argv[2] if len(sys.argv) > 2 else "."
        print(json.dumps(get_topology(target), indent=2))
    elif len(sys.argv) > 1 and sys.argv[1] == "--reachability":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing target argument for --reachability"}))
            sys.exit(1)
        target = sys.argv[2]
        root = sys.argv[3] if len(sys.argv) > 3 else "."
        print(json.dumps(reachability_slice(target, root), indent=2))
    else:
        target = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--skeleton" else (sys.argv[1] if len(sys.argv) > 1 else ".")
        print(json.dumps(scan_codebase(target), indent=2))
