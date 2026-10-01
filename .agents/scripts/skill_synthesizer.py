#!/usr/bin/env python3
"""
skill_synthesizer.py - Autonomous Living Skill Synthesis, Staging & Quarantine Engine
Generates, stages, and verifies living skills in .agents/skills/
Guarantees immutability protection for core skills, stages unverified skills in _provisional/,
and quarantines failing skills to prevent hallucination poisoning.
"""

import os
import sys
import json
import shutil
from datetime import datetime, timezone

SKILLS_DIR = os.path.join(".agents", "skills")
PROVISIONAL_DIR = os.path.join(SKILLS_DIR, "_provisional")
QUARANTINED_DIR = os.path.join(SKILLS_DIR, "_quarantined")

IMMUTABLE_SKILLS = {
    "ponytail", "professional-ui-craft", "modern-ui-motion",
    "backend-engineering", "database-engineering", "devops-infrastructure",
    "security-audit", "testing-verification"
}

STANDARD_TEMPLATE = """---
name: {domain_slug}
description: {description}
lastResearched: {date_iso}
verifiedGrounding: {verified_grounding}
provisional: {provisional}
sources:
{sources_yaml}
---

# {domain_title} Engineering & Best Practices

> [!IMPORTANT]
> This skill was autonomously synthesized. Status: {status_banner}.
> It provides authoritative invariants and a JIT Slicing Cheat Sheet for the Conductor.

---

## 1. The 5 Golden Invariants
{invariants}

---

## 2. Minimal Idiomatic Implementation (Canonical Pattern)
```{lang}
{canonical_code}
```

---

## 3. The 3 Anti-Pattern Traps (What NEVER to Do)
{anti_patterns}

---

## 4. JIT Slicing Cheat Sheet (For Conductor Sniper Prompts)
> **Inject into Worker Prompt (<45 tokens):**
> *"{jit_slice}"*
"""

def is_skill_fresh(domain_slug: str, max_age_days: int = 90) -> bool:
    """Checks if skill exists in production skills dir and is younger than max_age_days."""
    skill_path = os.path.join(SKILLS_DIR, domain_slug, "SKILL.md")
    if not os.path.exists(skill_path):
        return False
    try:
        with open(skill_path, "r", encoding="utf-8") as f:
            content = f.read()
        for line in content.splitlines():
            if line.startswith("lastResearched:"):
                date_str = line.split(":", 1)[1].strip()
                researched_date = datetime.fromisoformat(date_str)
                now = datetime.now(timezone.utc)
                if researched_date.tzinfo is None:
                    researched_date = researched_date.replace(tzinfo=timezone.utc)
                age_days = (now - researched_date).days
                return age_days <= max_age_days
    except Exception:
        pass
    return False

def save_provisional_skill(domain_slug: str, description: str, domain_title: str,
                           sources: list, invariants: str, canonical_code: str,
                           lang: str, anti_patterns: str, jit_slice: str) -> dict:
    """Stages a newly synthesized skill in _provisional/ until compiler verification."""
    if domain_slug in IMMUTABLE_SKILLS:
        return {
            "status": "error",
            "message": f"Skill '{domain_slug}' is an IMMUTABLE core protocol and cannot be modified."
        }

    target_dir = os.path.join(PROVISIONAL_DIR, domain_slug)
    os.makedirs(target_dir, exist_ok=True)
    target_file = os.path.join(target_dir, "SKILL.md")

    sources_yaml = "\n".join([f"  - {s}" for s in sources]) if sources else "  - Web Documentation"
    date_iso = datetime.now(timezone.utc).date().isoformat()

    content = STANDARD_TEMPLATE.format(
        domain_slug=domain_slug,
        description=description,
        date_iso=date_iso,
        verified_grounding="false",
        provisional="true",
        sources_yaml=sources_yaml,
        domain_title=domain_title,
        status_banner="PROVISIONAL (Awaiting Pass 1 Compiler Grounding)",
        invariants=invariants,
        lang=lang,
        canonical_code=canonical_code,
        anti_patterns=anti_patterns,
        jit_slice=jit_slice
    )

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)

    return {
        "status": "success",
        "stage": "provisional",
        "skillPath": target_file.replace("\\", "/"),
        "domain": domain_slug,
        "date": date_iso
    }

def promote_skill(domain_slug: str) -> dict:
    """Promotes a verified provisional skill to permanent status in .agents/skills/."""
    src_file = os.path.join(PROVISIONAL_DIR, domain_slug, "SKILL.md")
    if not os.path.exists(src_file):
        return {"status": "error", "message": f"Provisional skill '{domain_slug}' not found."}

    dest_dir = os.path.join(SKILLS_DIR, domain_slug)
    os.makedirs(dest_dir, exist_ok=True)
    dest_file = os.path.join(dest_dir, "SKILL.md")

    with open(src_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Update metadata flags
    content = content.replace("verifiedGrounding: false", "verifiedGrounding: true")
    content = content.replace("provisional: true", "provisional: false")
    content = content.replace("PROVISIONAL (Awaiting Pass 1 Compiler Grounding)", "VERIFIED (Passed Compiler Grounding)")

    with open(dest_file, "w", encoding="utf-8") as f:
        f.write(content)

    # Clean up provisional
    try:
        shutil.rmtree(os.path.join(PROVISIONAL_DIR, domain_slug))
    except Exception:
        pass

    return {
        "status": "success",
        "action": "promoted",
        "skillPath": dest_file.replace("\\", "/"),
        "domain": domain_slug
    }

def quarantine_skill(domain_slug: str, reason: str = "Compiler failure") -> dict:
    """Quarantines a failing provisional skill to prevent repeated hallucinations."""
    src_file = os.path.join(PROVISIONAL_DIR, domain_slug, "SKILL.md")
    if not os.path.exists(src_file):
        src_file = os.path.join(SKILLS_DIR, domain_slug, "SKILL.md")

    if not os.path.exists(src_file):
        return {"status": "error", "message": f"Skill '{domain_slug}' not found for quarantine."}

    dest_dir = os.path.join(QUARANTINED_DIR, domain_slug)
    os.makedirs(dest_dir, exist_ok=True)
    dest_file = os.path.join(dest_dir, "SKILL.md")

    shutil.move(src_file, dest_file)

    # Record quarantine in event queue
    event_queue_path = os.path.join(".agent_execution", "event-queue.jsonl")
    os.makedirs(".agent_execution", exist_ok=True)
    with open(event_queue_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "type": "skill-quarantined",
            "domain": domain_slug,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }) + "\n")

    return {
        "status": "success",
        "action": "quarantined",
        "destPath": dest_file.replace("\\", "/"),
        "domain": domain_slug,
        "reason": reason
    }

def inspect_local_types(package_name: str, root_dir: str = ".") -> dict:
    """Inspects installed node_modules for true TypeScript type definitions as ground truth."""
    type_locations = [
        os.path.join(root_dir, "node_modules", "@types", package_name, "index.d.ts"),
        os.path.join(root_dir, "node_modules", package_name, "index.d.ts"),
        os.path.join(root_dir, "node_modules", package_name, "dist", "index.d.ts"),
        os.path.join(root_dir, "node_modules", package_name, "package.json")
    ]

    for loc in type_locations:
        if os.path.exists(loc):
            if loc.endswith(".json"):
                try:
                    with open(loc, "r", encoding="utf-8") as f:
                        pkg = json.load(f)
                    types_field = pkg.get("types") or pkg.get("typings")
                    if types_field:
                        actual_type_file = os.path.join(os.path.dirname(loc), types_field)
                        if os.path.exists(actual_type_file):
                            with open(actual_type_file, "r", encoding="utf-8", errors="ignore") as tf:
                                return {"found": True, "path": actual_type_file, "sample": tf.read()[:2000]}
                except Exception:
                    pass
            else:
                try:
                    with open(loc, "r", encoding="utf-8", errors="ignore") as f:
                        return {"found": True, "path": loc, "sample": f.read()[:2000]}
                except Exception:
                    pass

    return {"found": False, "message": f"No local type definitions found for '{package_name}'."}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python skill_synthesizer.py --check <slug>")
        print("  python skill_synthesizer.py --promote <slug>")
        print("  python skill_synthesizer.py --quarantine <slug> [reason]")
        print("  python skill_synthesizer.py --inspect-types <package_name>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "--check":
        slug = sys.argv[2] if len(sys.argv) > 2 else ""
        fresh = is_skill_fresh(slug)
        print(json.dumps({"domain": slug, "fresh": fresh}))
        sys.exit(0 if fresh else 1)
    elif cmd == "--promote":
        slug = sys.argv[2]
        res = promote_skill(slug)
        print(json.dumps(res, indent=2))
        sys.exit(0 if res.get("status") == "success" else 1)
    elif cmd == "--quarantine":
        slug = sys.argv[2]
        reason = sys.argv[3] if len(sys.argv) > 3 else "Compiler failure"
        res = quarantine_skill(slug, reason)
        print(json.dumps(res, indent=2))
        sys.exit(0 if res.get("status") == "success" else 1)
    elif cmd == "--inspect-types":
        pkg = sys.argv[2]
        res = inspect_local_types(pkg)
        print(json.dumps(res, indent=2))
        sys.exit(0 if res.get("found") else 1)
    else:
        print(f"Unknown flag: {cmd}")
        sys.exit(1)
