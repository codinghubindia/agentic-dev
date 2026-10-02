#!/usr/bin/env node
/**
 * gitignore_generator.js - 0-Token Deterministic .gitignore Scaffolder (v8.0)
 * Generates or merges a comprehensive production-grade .gitignore before git initialization.
 * Guarantees exclusion of framework state (.agent_execution/, .agents/), secrets (.env),
 * dependencies (node_modules/), build artifacts (dist/, .next/), and OS/editor noise.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_GITIGNORE_SECTIONS = `# ==========================================
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
`;

function ensureGitignore(targetDir = ".") {
    const gitignorePath = path.join(targetDir, ".gitignore");

    if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, DEFAULT_GITIGNORE_SECTIONS, 'utf-8');
        console.log(`✅ Created comprehensive .gitignore: ${gitignorePath}`);
        return;
    }

    const existingContent = fs.readFileSync(gitignorePath, 'utf-8');
    const requiredEntries = [
        ".agent_execution/",
        ".agents/",
        ".gemini/",
        ".env",
        "node_modules/",
        "dist/",
        "build/",
        ".DS_Store"
    ];

    const missing = requiredEntries.filter(entry => !existingContent.includes(entry));

    if (missing.length > 0) {
        const appendBlock = "\n# Required Framework & Security Exclusions\n" + missing.join("\n") + "\n";
        fs.appendFileSync(gitignorePath, appendBlock, 'utf-8');
        console.log(`✅ Appended missing exclusions to ${gitignorePath}: ${missing.join(', ')}`);
    } else {
        console.log(`✅ .gitignore already contains all critical exclusions: ${gitignorePath}`);
    }
}

const target = process.argv[2] || ".";
ensureGitignore(target);
