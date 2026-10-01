#!/usr/bin/env python3
"""
memory_guardian.py - Chief-of-Staff Memory & Invariant Guardian
Enforces recurrence thresholds (>=3 occurrences), filters transient network/5xx hiccups,
executes AST domain-noun sanitization, and maintains .agents/memory/invariants.json
to protect system prompts from memory pollution and domain overfitting.
"""

import os
import sys
import json
import re
from datetime import datetime, timezone

MEMORY_DIR = os.path.join(".agents", "memory")
INVARIANTS_FILE = os.path.join(MEMORY_DIR, "invariants.json")
EVENT_QUEUE_FILE = os.path.join(".agent_execution", "event-queue.jsonl")

# Transient error patterns that must NEVER become system invariants
TRANSIENT_PATTERNS = [
    r"ETIMEDOUT",
    r"ECONNREFUSED",
    r"ECONNRESET",
    r"socket hang up",
    r"502 Bad Gateway",
    r"503 Service Unavailable",
    r"504 Gateway Timeout",
    r"rate limit",
    r"429 Too Many Requests",
    r"network timeout",
    r"temporary failure in name resolution"
]

DOMAIN_NOUN_REPLACEMENTS = [
    (r"\b(?:crypto|bitcoin|eth|solana|wallet)\b", "account", re.IGNORECASE),
    (r"\b(?:patient|medical|hospital|doctor)\b", "user", re.IGNORECASE),
    (r"\b(?:cart|checkout|stripe|order_item)\b", "transaction", re.IGNORECASE),
    (r"\b(?:shoe|product|inventory_item)\b", "item", re.IGNORECASE)
]

def load_invariants() -> dict:
    """Loads current invariants registry."""
    if not os.path.exists(INVARIANTS_FILE):
        return {"version": "1.0", "invariants": []}
    try:
        with open(INVARIANTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"version": "1.0", "invariants": []}

def save_invariants(data: dict):
    """Saves invariants registry."""
    os.makedirs(MEMORY_DIR, exist_ok=True)
    with open(INVARIANTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def is_transient_error(text: str) -> bool:
    """Checks if an error text represents transient environmental/network failure."""
    for pat in TRANSIENT_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False

def sanitize_domain_nouns(text: str) -> str:
    """Applies AST Domain-Noun Sanitization, replacing project-specific nouns with generic terms."""
    sanitized = text
    for pattern, replacement, flags in DOMAIN_NOUN_REPLACEMENTS:
        sanitized = re.sub(pattern, replacement, sanitized, flags=flags)
    return sanitized

def process_event_queue(queue_path: str = EVENT_QUEUE_FILE) -> dict:
    """Processes event-queue.jsonl, filters transients, applies sanitization, and updates invariants."""
    if not os.path.exists(queue_path):
        return {"processed": 0, "promoted": 0, "message": "Event queue is empty"}

    registry = load_invariants()
    invariants = registry.get("invariants", [])

    processed_count = 0
    promoted_count = 0
    unprocessed_events = []

    with open(queue_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        try:
            evt = json.loads(stripped)
        except Exception:
            continue

        processed_count += 1
        raw_pattern = evt.get("pattern") or evt.get("reason") or evt.get("lesson") or ""
        
        # 1. Filter out transient network / service outages
        if is_transient_error(raw_pattern):
            continue

        # 2. Sanitize domain nouns
        sanitized_rule = sanitize_domain_nouns(raw_pattern)

        # 3. Match against existing invariants
        matched = False
        for inv in invariants:
            # Fuzzy match or identical rule check
            if inv["rule"].lower() == sanitized_rule.lower() or inv.get("fingerprint") == evt.get("fingerprint"):
                inv["occurrences"] += 1
                inv["lastSeen"] = datetime.now(timezone.utc).isoformat()
                matched = True
                # Promote to active once threshold (>=3) is met
                if inv["occurrences"] >= 3 and inv["status"] != "active":
                    inv["status"] = "active"
                    promoted_count += 1
                break

        if not matched:
            new_inv = {
                "id": f"inv_{len(invariants) + 1:03d}",
                "rule": sanitized_rule,
                "occurrences": 1,
                "status": "provisional",
                "firstSeen": datetime.now(timezone.utc).isoformat(),
                "lastSeen": datetime.now(timezone.utc).isoformat(),
                "targetAgent": evt.get("targetAgent", "general")
            }
            invariants.append(new_inv)

    registry["invariants"] = invariants
    save_invariants(registry)

    # Clear or archive processed event queue
    try:
        with open(queue_path, "w", encoding="utf-8") as f:
            f.write("")
    except Exception:
        pass

    return {
        "status": "success",
        "processedEvents": processed_count,
        "newlyPromoted": promoted_count,
        "totalInvariants": len(invariants)
    }

def list_invariants() -> list:
    """Returns active and provisional invariants."""
    registry = load_invariants()
    return registry.get("invariants", [])

def revoke_invariant(inv_id: str) -> dict:
    """Revokes an invariant if reported inaccurate or obsolete."""
    registry = load_invariants()
    for inv in registry.get("invariants", []):
        if inv["id"] == inv_id:
            inv["status"] = "revoked"
            inv["revokedAt"] = datetime.now(timezone.utc).isoformat()
            save_invariants(registry)
            return {"status": "success", "revoked": inv_id}
    return {"status": "error", "message": f"Invariant '{inv_id}' not found."}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python memory_guardian.py process-events [queue_file]")
        print("  python memory_guardian.py list")
        print("  python memory_guardian.py revoke <id>")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "process-events":
        q = sys.argv[2] if len(sys.argv) > 2 else EVENT_QUEUE_FILE
        res = process_event_queue(q)
        print(json.dumps(res, indent=2))
    elif cmd == "list":
        print(json.dumps(list_invariants(), indent=2))
    elif cmd == "revoke":
        inv_id = sys.argv[2]
        res = revoke_invariant(inv_id)
        print(json.dumps(res, indent=2))
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
