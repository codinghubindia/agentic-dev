#!/usr/bin/env python3
"""
terminal_probe.py — Terminal Fingerprinting & Command Quirk Resolver.
Identifies the current shell/terminal type and provides the correct
command variant for each command intent. Learns from failures.

Usage:
  python terminal_probe.py                    — detect and print terminal info
  python terminal_probe.py --resolve <intent> — print correct command for intent
  python terminal_probe.py --learn <intent> <failed-cmd> <working-cmd> — record a quirk
"""

import sys
import os
import json
import subprocess
import shutil
from datetime import datetime, date

QUIRKS_FILE = os.path.join(os.path.dirname(__file__), '..', 'terminal-quirks.json')

# ─── Terminal detection ────────────────────────────────────────────────────────

TERMINAL_PROBES = [
    {
        "id": "powershell7",
        "probe_cmd": ["pwsh", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"],
        "success_contains": "7",
        "label": "PowerShell 7 (pwsh)"
    },
    {
        "id": "powershell5",
        "probe_cmd": ["powershell", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"],
        "success_contains": "5",
        "label": "PowerShell 5 (Windows PowerShell)"
    },
    {
        "id": "bash",
        "probe_cmd": ["bash", "--version"],
        "success_contains": "GNU bash",
        "label": "Bash"
    },
    {
        "id": "zsh",
        "probe_cmd": ["zsh", "--version"],
        "success_contains": "zsh",
        "label": "Zsh"
    },
    {
        "id": "cmd",
        "probe_cmd": ["cmd", "/c", "ver"],
        "success_contains": "Microsoft Windows",
        "label": "Windows CMD"
    },
]

def detect_terminal() -> dict:
    """Run probe commands to identify terminal type."""
    # Check environment variables first (fastest path)
    if os.environ.get("PSVersionTable") or os.environ.get("PSHOME"):
        return {"id": "powershell", "label": "PowerShell (env detected)"}
    
    shell = os.environ.get("SHELL", "")
    if "zsh" in shell:
        return {"id": "zsh", "label": "Zsh (SHELL env)"}
    if "bash" in shell:
        return {"id": "bash", "label": "Bash (SHELL env)"}
    
    # Active probing
    for probe in TERMINAL_PROBES:
        try:
            result = subprocess.run(
                probe["probe_cmd"],
                capture_output=True, text=True, timeout=2
            )
            output = (result.stdout + result.stderr).strip()
            if probe["success_contains"].lower() in output.lower():
                return {"id": probe["id"], "label": probe["label"]}
        except Exception:
            continue
    
    # Fallback: platform-based guess
    if sys.platform == "win32":
        return {"id": "powershell5", "label": "PowerShell 5 (platform fallback)"}
    return {"id": "bash", "label": "Bash (platform fallback)"}


# ─── Quirks management ────────────────────────────────────────────────────────

def load_quirks() -> dict:
    quirks_path = os.path.normpath(QUIRKS_FILE)
    if not os.path.exists(quirks_path):
        return {"version": "1.0.0", "quirks": {}, "learnedQuirks": [], "sessionHistory": []}
    with open(quirks_path, encoding="utf-8") as f:
        return json.load(f)


def save_quirks(data: dict):
    quirks_path = os.path.normpath(QUIRKS_FILE)
    os.makedirs(os.path.dirname(quirks_path), exist_ok=True)
    with open(quirks_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def resolve_command(intent: str, terminal_id: str) -> str:
    """Get the correct command for an intent on the current terminal."""
    quirks = load_quirks()
    
    # Check learned quirks first (most recent overrides base)
    for lq in reversed(quirks.get("learnedQuirks", [])):
        if lq["terminalId"] == terminal_id and lq["intent"] == intent:
            return lq["workingCmd"]
    
    # Fall back to base quirks table
    base = quirks.get("quirks", {}).get(terminal_id, {})
    return base.get(intent, f"[NO_COMMAND_FOR_INTENT:{intent}]")


def learn_quirk(intent: str, failed_cmd: str, working_cmd: str, terminal_id: str):
    """Record a command quirk learned from a failure."""
    quirks = load_quirks()
    entry = {
        "id": f"lq_{int(datetime.now().timestamp())}",
        "terminalId": terminal_id,
        "intent": intent,
        "failedCmd": failed_cmd,
        "workingCmd": working_cmd,
        "learnedAt": date.today().isoformat()
    }
    quirks.setdefault("learnedQuirks", []).append(entry)
    save_quirks(quirks)
    return entry


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]
    terminal = detect_terminal()
    
    if "--resolve" in args:
        idx = args.index("--resolve")
        intent = args[idx + 1] if idx + 1 < len(args) else ""
        cmd = resolve_command(intent, terminal["id"])
        print(json.dumps({"terminal": terminal, "intent": intent, "command": cmd}, indent=2))
    
    elif "--learn" in args:
        idx = args.index("--learn")
        try:
            intent = args[idx + 1]
            failed = args[idx + 2]
            working = args[idx + 3]
            result = learn_quirk(intent, failed, working, terminal["id"])
            print(json.dumps({"status": "learned", "entry": result}, indent=2))
        except IndexError:
            print(json.dumps({"error": "Usage: --learn <intent> <failed-cmd> <working-cmd>"}))
            sys.exit(1)
    
    else:
        # Default: just detect and return terminal info
        quirks = load_quirks()
        base_table = quirks.get("quirks", {}).get(terminal["id"], {})
        print(json.dumps({
            "terminal": terminal,
            "commandTable": base_table,
            "learnedCount": len([
                lq for lq in quirks.get("learnedQuirks", [])
                if lq["terminalId"] == terminal["id"]
            ])
        }, indent=2))
    
    sys.exit(0)
