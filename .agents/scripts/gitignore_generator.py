#!/usr/bin/env python3
"""
gitignore_generator.py - 0-Token Deterministic .gitignore Scaffolder (v8.0)
Generates or merges a comprehensive production-grade .gitignore before git initialization.
Guarantees exclusion of framework state (.agent_execution/, .agents/), secrets (.env),
dependencies (node_modules/), build artifacts (dist/, .next/), and OS/editor noise.
"""

import os
import sys

DEFAULT_GITIGNORE_SECTIONS = """# ==========================================
# Framework Internal State & Execution Data
# ==========================================
.agent_execution/
.agents/
.gemini/

# ==========================================
# Secrets & Environment Configurations
# ==========================================
.env
.env.local
.env.*.local
*.pem
*.key
*.cert
*.pfx

# ==========================================
# Dependencies & Package Managers
# ==========================================
node_modules/
vendor/
__pycache__/
*.pyc
venv/
.venv/
.pnpm-store/

# ==========================================
# Build Artifacts & Bundler Caches
# ==========================================
dist/
build/
out/
.next/
.vite/
.turbo/
.cache/
*.tsbuildinfo
coverage/

# ==========================================
# Operating System & Editor Noise
# ==========================================
.DS_Store
Thumbs.db
.vscode/
.idea/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
"""

def ensure_gitignore(target_dir="."):
    gitignore_path = os.path.join(target_dir, ".gitignore")
    
    if not os.path.exists(gitignore_path):
        with open(gitignore_path, "w", encoding="utf-8") as f:
            f.write(DEFAULT_GITIGNORE_SECTIONS)
        print(f"✅ Created comprehensive .gitignore: {gitignore_path}")
        return

    # If it exists, ensure essential lines are present
    with open(gitignore_path, "r", encoding="utf-8") as f:
        existing_content = f.read()

    required_entries = [
        ".agent_execution/",
        ".agents/",
        ".gemini/",
        ".env",
        "node_modules/",
        "dist/",
        "build/",
        ".DS_Store"
    ]

    missing = [entry for entry in required_entries if entry not in existing_content]
    
    if missing:
        append_block = "\n# Required Framework & Security Exclusions\n" + "\n".join(missing) + "\n"
        with open(gitignore_path, "a", encoding="utf-8") as f:
            f.write(append_block)
        print(f"✅ Appended missing exclusions to {gitignore_path}: {', '.join(missing)}")
    else:
        print(f"✅ .gitignore already contains all critical exclusions: {gitignore_path}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    ensure_gitignore(target)
