#!/usr/bin/env python3
"""
Receipt Swapper: Content-Addressable Tool Output Garbage Collection
Hashes raw payloads to disk and emits O(1) semantic receipts (<50 tokens).
"""

import os
import sys
import hashlib
import json
from datetime import datetime, timezone

RECEIPTS_DIR = os.path.join(".agent_execution", "receipts")

def swap_payload(raw_content: str, action: str, target: str, summary: str = "", status: str = "success", diagnostics: dict = None) -> dict:
    os.makedirs(RECEIPTS_DIR, exist_ok=True)
    
    # Compute SHA256 content address
    content_bytes = raw_content.encode("utf-8")
    content_hash = hashlib.sha256(content_bytes).hexdigest()[:16]
    
    receipt_filename = f"{content_hash}.log"
    receipt_path = os.path.join(RECEIPTS_DIR, receipt_filename).replace("\\", "/")
    
    # Write full raw payload to disk
    with open(receipt_path, "wb") as f:
        f.write(content_bytes)
        
    line_count = len(raw_content.splitlines())
    byte_size = len(content_bytes)
    
    if not summary:
        summary = f"Executed {action} on {target}: processed {line_count} lines ({byte_size} bytes)."
        
    receipt = {
        "$schema": "../schemas/receipt.schema.json",
        "status": status,
        "action": action,
        "target": target,
        "summary": summary[:200],
        "metrics": {
            "lines": line_count,
            "bytes": byte_size
        },
        "receiptRef": receipt_path,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if diagnostics:
        receipt["diagnostics"] = diagnostics
        
    return receipt

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python receipt_swapper.py <action> <target> [summary]")
        sys.exit(1)
        
    action_arg = sys.argv[1]
    target_arg = sys.argv[2]
    summary_arg = sys.argv[3] if len(sys.argv) > 3 else ""
    raw_input = sys.stdin.read()
    
    receipt_data = swap_payload(raw_input, action_arg, target_arg, summary_arg)
    print(json.dumps(receipt_data, indent=2))
