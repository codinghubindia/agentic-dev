---
name: cest-software-project
description: CEST Adaptive Fullstack Software Pipeline workflow. Defines all phases, phase gates, agents, and required artifacts for building a new software project from scratch using the CEST framework.
lastResearched: 2026-10-01
sources:
  - .agents/workflows/cest-software-project.json
---

# CEST Adaptive Fullstack Software Pipeline

> [!IMPORTANT]
> This skill describes the canonical phase sequence for building a new fullstack project. Conductor reads this to understand the correct phase order, required artifacts, and hard gates.

## Workflow Overview

| Phase | Name | Lead | Hard Gate |
|---|---|---|---|
| 1 | Direct Intake, Environment Probe & Preflight Architecture | conductor | ✅ |
| 2 | Architecture Blueprint & Design Specification | conductor | ✅ |
| 3 | CLI Scaffolding & Project Skeleton | conductor | ✅ |
| 4 | Ephemeral Parallel Strike Execution | conductor + strike workers | ✅ |
| 5 | Deterministic Compiler Gate & Adversarial Audit | conductor + qa-auditor | ✅ |
| 6 | Live Browser Checkpoint & Evolutionary Memory | conductor | ✅ |

## Phase 1: Direct Intake, Environment Probe & Preflight Architecture
- **Lead**: conductor
- **Actions**: Runtime probe (bun→node→python), environment probe script, brownfield AST skeleton, resumability check, interactive intake, CIR synthesis, preflight contract validation.
- **Required Artifacts**: `.agent_execution/cir.json`, `.agent_execution/workflow-state.json`, `.agent_execution/environment-preflight.json`

## Phase 2: Architecture Blueprint & Design Specification
- **Lead**: conductor
- **Actions**: Write `architecture-blueprint.md` (stack, modules, data models, API surface, dependency graph). Write `design-spec.md` (color system, typography, component inventory, Motion Contract — entrance/micro-interactions/stagger/page transitions, skeleton screens).
- **Required Artifacts**: `.agent_execution/architecture-blueprint.md`, `.agent_execution/design-spec.md`
- **Motion Contract Gate**: design-spec.md MUST contain a complete Motion Contract. Missing = block.

## Phase 3: CLI Scaffolding & Project Skeleton
- **Lead**: conductor
- **Actions**: Run official CLI to scaffold project skeleton (`npm create vite@latest`, `npx create-next-app@latest`, `npx prisma init`, etc.). NEVER manually create config files.
- **Required Artifacts**: Project skeleton directories with official config files

## Phase 4: Ephemeral Parallel Strike Execution
- **Lead**: conductor
- **Agents**: strike-worker-backend, strike-worker-frontend, strike-worker-infra (skip infra for local projects)
- **Actions**: Concurrent micro-dispatch. Each worker receives Sniper Prompt with: file paths, CIR slice, skill URIs (NOT skill content), motion contract, deprecation check mandate.
- **Required Artifacts**: `.agent_execution/receipts/`
- **Deprecation Gate**: Every worker MUST run `npm view <pkg> deprecated` before any install.

## Phase 5: Deterministic Compiler Gate & Adversarial Audit
- **Lead**: conductor
- **Agents**: qa-auditor
- **Actions**: Run compiler (tsc/pytest/cargo check). On fail: error-slice → worker fix. On pass: invoke qa-auditor for OWASP + Anti-Vibe-Code + Motion Contract audit.
- **Required Artifacts**: `.agent_execution/audit-report.md`

## Phase 6: Live Browser Checkpoint & Evolutionary Memory
- **Lead**: conductor
- **Actions**: `npm run dev`, browser checkpoint ask_question, memory_guardian process-events, git commit.
- **Required Artifacts**: `.agent_execution/delivery-signoff.md`

## Execution Config
```json
{
  "defaultModel": "inherit",
  "modelOverrides": {
    "conductor": "pro",
    "qa-auditor": "pro",
    "strike-worker-backend": "flash",
    "strike-worker-frontend": "flash",
    "strike-worker-infra": "flash"
  },
  "parallelismLimit": 4
}
```
