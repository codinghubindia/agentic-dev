#!/usr/bin/env python3
"""
skill_validator.py — Native skill file validator.
Checks user-imported SKILL.md files for required fields using native filesystem
operations (zero LLM tokens). Injects missing fields like lastResearched.

Usage: python skill_validator.py <skill-file-path> [--fix]
  --fix: auto-inject missing fields
"""

import sys
import os
import re
import json
from datetime import date

RESULT = {
    "file": "",
    "valid": True,
    "issues": [],
    "fixed": [],
    "warnings": []
}


def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def write_file(path: str, content: str):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def parse_frontmatter(content: str) -> tuple[dict, int]:
    """Extract YAML frontmatter fields as a raw dict (no yaml dep needed)."""
    if not content.startswith("---"):
        return {}, -1
    end = content.find("---", 3)
    if end == -1:
        return {}, -1
    frontmatter_text = content[3:end].strip()
    fields = {}
    for line in frontmatter_text.splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            fields[key.strip()] = val.strip()
    return fields, end + 3  # end position including closing ---


def inject_field_into_frontmatter(content: str, field: str, value: str) -> str:
    """Insert a field after the 'description:' line in frontmatter, or before closing ---."""
    # Find closing --- of frontmatter
    end_idx = content.find("---", 3)
    if end_idx == -1:
        return content
    
    frontmatter = content[3:end_idx]
    rest = content[end_idx:]
    
    # Insert after 'description:' line if present, else before end
    if "description:" in frontmatter:
        lines = frontmatter.splitlines()
        new_lines = []
        inserted = False
        for line in lines:
            new_lines.append(line)
            if line.startswith("description:") and not inserted:
                new_lines.append(f"{field}: {value}")
                inserted = True
        if not inserted:
            new_lines.append(f"{field}: {value}")
        frontmatter = "\n".join(new_lines)
    else:
        frontmatter = frontmatter.rstrip() + f"\n{field}: {value}\n"
    
    return "---" + frontmatter + rest


def validate(path: str, fix: bool = False) -> dict:
    RESULT["file"] = path
    
    # Check file exists
    if not os.path.exists(path):
        RESULT["valid"] = False
        RESULT["issues"].append(f"File not found: {path}")
        return RESULT
    
    content = read_file(path)
    
    # Check 1: Starts with ---
    if not content.startswith("---"):
        RESULT["valid"] = False
        RESULT["issues"].append("Missing YAML frontmatter: file must start with '---'")
        return RESULT
    
    # Check 2: Has closing ---
    if content.count("---") < 2:
        RESULT["valid"] = False
        RESULT["issues"].append("Malformed frontmatter: missing closing '---'")
        return RESULT
    
    fields, end_pos = parse_frontmatter(content)
    
    # Check 3: name field
    if "name" not in fields:
        RESULT["valid"] = False
        RESULT["issues"].append("Missing required field: 'name'")
    
    # Check 4: description field
    if "description" not in fields:
        RESULT["valid"] = False
        RESULT["issues"].append("Missing required field: 'description'")
    
    # Check 5: lastResearched field — auto-inject if missing
    if "lastResearched" not in fields:
        today = date.today().isoformat()
        if fix:
            content = inject_field_into_frontmatter(content, "lastResearched", today)
            write_file(path, content)
            RESULT["fixed"].append(f"Injected 'lastResearched: {today}'")
        else:
            RESULT["issues"].append(
                f"Missing 'lastResearched' field. Run with --fix to auto-inject today's date ({today})."
            )
            RESULT["valid"] = False
    
    # Check 6: File is not empty below frontmatter
    body = content[end_pos:].strip() if end_pos > 0 else ""
    if len(body) < 50:
        RESULT["warnings"].append("Skill body is very short (<50 chars). Consider adding more guidance.")
    
    # Check 7: Encoding (already handled by read_file utf-8)
    
    # Check 8: No binary/null chars
    if "\x00" in content:
        RESULT["valid"] = False
        RESULT["issues"].append("File contains null bytes — possible encoding issue.")
    
    return RESULT


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: skill_validator.py <path> [--fix]"}))
        sys.exit(1)
    
    skill_path = sys.argv[1]
    auto_fix = "--fix" in sys.argv
    
    result = validate(skill_path, fix=auto_fix)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["valid"] else 1)
