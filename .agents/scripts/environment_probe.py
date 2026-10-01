#!/usr/bin/env python3
"""
environment_probe.py - Host Toolchain & Dependency Preflight Probe
Detects available local compilers, package managers, and container runtimes.
Verifies project dependency installation status to determine whether Pass 1
Machine Compiler Gating can execute safely or must gracefully fall back to
Pass 2 Adversarial Diff Auditing.
"""

import os
import sys
import shutil
import subprocess
import json

def check_command(cmd: str) -> dict:
    """Checks if a command-line tool exists and captures its version."""
    path = shutil.which(cmd)
    if not path:
        return {"available": False, "path": None, "version": None}

    version = None
    try:
        # Run version check with short timeout
        proc = subprocess.run([cmd, "--version"], capture_output=True, text=True, timeout=3)
        out = (proc.stdout or proc.stderr).strip().splitlines()
        if out:
            version = out[0].strip()
    except Exception:
        version = "detected (version query timed out)"

    return {"available": True, "path": path.replace("\\", "/"), "version": version}

def probe_environment(root_dir: str = ".") -> dict:
    """Runs a complete environment preflight probe and recommends QA gate strategy."""
    probe_results = {
        "timestamp": None,
        "tools": {
            "bun": check_command("bun"),
            "node": check_command("node"),
            "npm": check_command("npm"),
            "tsc": check_command("tsc"),
            "python": check_command("python"),
            "pytest": check_command("pytest"),
            "cargo": check_command("cargo"),
            "docker": check_command("docker"),
            "git": check_command("git")
        },
        "workspaceState": {
            "hasPackageJson": os.path.exists(os.path.join(root_dir, "package.json")),
            "hasNodeModules": os.path.exists(os.path.join(root_dir, "node_modules")),
            "hasRequirementsTxt": os.path.exists(os.path.join(root_dir, "requirements.txt")),
            "hasCargoToml": os.path.exists(os.path.join(root_dir, "Cargo.toml")),
            "hasGitRepo": os.path.exists(os.path.join(root_dir, ".git"))
        },
        "gateStrategy": {}
    }

    # Evaluate Node/TypeScript Readiness
    ws = probe_results["workspaceState"]
    tools = probe_results["tools"]

    if ws["hasPackageJson"]:
        if not ws["hasNodeModules"]:
            probe_results["gateStrategy"]["typescript"] = {
                "strategy": "DIFF_AUDIT_FALLBACK",
                "reason": "package.json exists but node_modules is missing (npm install not run). Compiler gate bypassed.",
                "fallbackCommand": None
            }
        elif tools["tsc"]["available"]:
            probe_results["gateStrategy"]["typescript"] = {
                "strategy": "LOCAL_MACHINE_COMPILER",
                "command": "npx tsc --noEmit" if not tools["tsc"]["available"] else "tsc --noEmit",
                "reason": "TypeScript compiler is available and node_modules installed."
            }
        else:
            probe_results["gateStrategy"]["typescript"] = {
                "strategy": "DIFF_AUDIT_FALLBACK",
                "reason": "TypeScript compiler 'tsc' not found in PATH or npx.",
                "fallbackCommand": None
            }

    # Evaluate Python Readiness
    if ws["hasRequirementsTxt"]:
        if tools["pytest"]["available"]:
            probe_results["gateStrategy"]["python"] = {
                "strategy": "LOCAL_MACHINE_COMPILER",
                "command": "pytest",
                "reason": "pytest is available in PATH."
            }
        elif tools["python"]["available"]:
            probe_results["gateStrategy"]["python"] = {
                "strategy": "LOCAL_MACHINE_COMPILER",
                "command": "python -m unittest",
                "reason": "python is available; falling back to standard library unittest."
            }
        else:
            probe_results["gateStrategy"]["python"] = {
                "strategy": "DIFF_AUDIT_FALLBACK",
                "reason": "Python runtime not detected in PATH.",
                "fallbackCommand": None
            }

    # Evaluate Rust Readiness
    if ws["hasCargoToml"]:
        if tools["cargo"]["available"]:
            probe_results["gateStrategy"]["rust"] = {
                "strategy": "LOCAL_MACHINE_COMPILER",
                "command": "cargo check",
                "reason": "cargo is available in PATH."
            }
        else:
            probe_results["gateStrategy"]["rust"] = {
                "strategy": "DIFF_AUDIT_FALLBACK",
                "reason": "Cargo/Rust toolchain not detected in PATH.",
                "fallbackCommand": None
            }

    # Default fallback if no specific manifest exists
    if not probe_results["gateStrategy"]:
        probe_results["gateStrategy"]["default"] = {
            "strategy": "DIFF_AUDIT_FALLBACK",
            "reason": "No manifest (package.json / requirements.txt / Cargo.toml) detected. Using pure Adversarial Diff Audit."
        }

    # v7.1: Runtime recommendation in priority order: bun → node → python
    runtime_priority = ["bun", "node", "python"]
    probe_results["runtimeRecommendation"] = [
        rt for rt in runtime_priority if probe_results["tools"].get(rt, {}).get("available", False)
    ]

    return probe_results

if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    results = probe_environment(root)
    
    # Save report to .agent_execution if possible
    try:
        report_dir = os.path.join(root, ".agent_execution")
        os.makedirs(report_dir, exist_ok=True)
        report_file = os.path.join(report_dir, "environment-preflight.json")
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
    except Exception:
        pass

    print(json.dumps(results, indent=2))
    sys.exit(0)
