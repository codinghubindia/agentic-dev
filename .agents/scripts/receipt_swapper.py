#!/usr/bin/env python3
"""
receipt_swapper.py - Content-Addressable Tool Output Garbage Collection
Hashes terminal outputs and large payloads to disk and emits O(1) semantic receipts (<50 tokens).
"""

import os
import sys
import hashlib
import json
from datetime import datetime, timezone

RECEIPTS_DIR = os.path.join(".agent_execution", "receipts")

def swap_payload(raw_content: str, action: str, target: str, summary: str = "", status: str = "success", exit_code: int = 0) -> dict:
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
        summary = f"Executed {action} on {target}: {line_count} lines ({byte_size} bytes)."
        
    receipt = {
        "$schema": "../schemas/receipt.schema.json",
        "status": status,
        "exit_code": exit_code,
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
        
    return receipt

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python receipt_swapper.py <action> <target> [raw_content]")
        sys.exit(1)
        
    action_arg = sys.argv[1]
    target_arg = sys.argv[2]
    raw_content_arg = sys.argv[3] if len(sys.argv) > 3 else sys.stdin.read()
    
    res = swap_payload(raw_content_arg, action_arg, target_arg)
    print(json.dumps(res, indent=2))
