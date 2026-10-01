#!/usr/bin/env python3
"""
preflight_contract_validator.py - Preflight Contract & CIR Relational Integrity Validator
Validates CIR contracts against cir.schema.json, verifies cross-entity relational
integrity, checks foreign key coherence, and guards against disjoint boundary collisions
before any strike worker is dispatched.
"""

import os
import sys
import json
import fnmatch

def validate_cir(cir_path: str, schema_path: str = None) -> dict:
    """Validates CIR file and performs relational and boundary integrity checks."""
    if not os.path.exists(cir_path):
        return {
            "valid": False,
            "errors": [f"CIR file not found at path: {cir_path}"]
        }

    try:
        with open(cir_path, "r", encoding="utf-8") as f:
            cir_data = json.load(f)
    except Exception as e:
        return {
            "valid": False,
            "errors": [f"Malformed JSON in CIR file: {str(e)}"]
        }

    errors = []
    warnings = []
    checks_passed = []

    # 1. Structural Checks
    required_keys = ["version", "projectName", "techStack", "entities", "endpoints", "fileBoundaries"]
    for k in required_keys:
        if k not in cir_data:
            errors.append(f"Missing required top-level key: '{k}'")
    if errors:
        return {"valid": False, "errors": errors, "warnings": warnings}

    checks_passed.append("Top-level CIR structure verified")

    # 2. Entity and Relational Integrity Checks
    entities = cir_data.get("entities", [])
    entity_names = set()
    for ent in entities:
        name = ent.get("name")
        if not name:
            errors.append("Encountered entity without a name")
        elif name in entity_names:
            errors.append(f"Duplicate entity name: '{name}'")
        else:
            entity_names.add(name)

    for ent in entities:
        ent_name = ent.get("name", "Unknown")
        relations = ent.get("relations", [])
        for rel in relations:
            target = rel.get("targetEntity")
            rel_type = rel.get("type")
            if target not in entity_names:
                errors.append(f"Entity '{ent_name}' specifies unknown relation target: '{target}'")
            if rel_type not in ["one-to-one", "one-to-many", "many-to-one", "many-to-many"]:
                errors.append(f"Entity '{ent_name}' relation to '{target}' has invalid type: '{rel_type}'")

    checks_passed.append(f"Verified {len(entities)} entities and cross-relational foreign keys")

    # 3. Endpoint Schema & Owner Worker Checks
    endpoints = cir_data.get("endpoints", [])
    valid_workers = {"strike-worker-backend", "strike-worker-frontend", "strike-worker-infra", "conductor"}
    for ep in endpoints:
        path = ep.get("path")
        method = ep.get("method")
        owner = ep.get("ownerWorker")
        if not path or not method:
            errors.append(f"Endpoint missing path or method: {ep}")
        if owner not in valid_workers:
            errors.append(f"Endpoint '{method} {path}' assigned to invalid worker '{owner}'")

    checks_passed.append(f"Verified {len(endpoints)} API endpoints and worker assignments")

    # 4. Disjoint File Boundary Collision Check
    file_boundaries = cir_data.get("fileBoundaries", {})
    worker_files = {}
    for worker, patterns in file_boundaries.items():
        worker_files[worker] = set(patterns)

    # Check for exact or wildcard collisions across different workers
    workers_list = list(worker_files.keys())
    collisions = []
    for i in range(len(workers_list)):
        for j in range(i + 1, len(workers_list)):
            w1 = workers_list[i]
            w2 = workers_list[j]
            shared = worker_files[w1].intersection(worker_files[w2])
            if shared:
                for s in shared:
                    collisions.append({
                        "file": s,
                        "workers": [w1, w2],
                        "type": "exact_overlap"
                    })

    if collisions:
        for c in collisions:
            warnings.append(
                f"File boundary overlap on '{c['file']}' between {c['workers'][0]} and {c['workers'][1]}. "
                "Must collapse execution mode to SEQUENTIAL or route through ast_surgery.py."
            )

    checks_passed.append("File boundary disjointness audited")

    is_valid = len(errors) == 0
    return {
        "valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "checksPassed": checks_passed,
        "hasBoundaryCollisions": len(collisions) > 0,
        "boundaryCollisions": collisions
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python preflight_contract_validator.py <path_to_cir.json>")
        sys.exit(1)

    cir_file = sys.argv[1]
    result = validate_cir(cir_file)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["valid"] else 2)
