---
name: cest-codebase-update
description: CEST Adaptive Codebase Update Pipeline workflow. Phases for modifying an existing codebase — brownfield slicing, targeted strike, compiler gate, and audit.
lastResearched: 2026-10-01
sources:
  - .agents/workflows/cest-codebase-update.json
---

# CEST Adaptive Codebase Update Pipeline

> [!IMPORTANT]
> Use this workflow when modifying an existing codebase — NOT for new projects. Start with brownfield archaeology before any code changes.

## Workflow Overview

| Phase | Name | Lead | Hard Gate |
|---|---|---|---|
| 1 | Brownfield Archaeology & Reachability Slicing | conductor | ✅ |
| 2 | Targeted Strike Execution | conductor + strike workers | ✅ |
| 3 | Compiler Gate & Adversarial Audit | conductor + qa-auditor | ✅ |
| 4 | Live Checkpoint & Memory | conductor | ✅ |

## Phase 1: Brownfield Archaeology & Reachability Slicing
- **Lead**: conductor
- **Actions**: Runtime probe (bun→node→python), run `ghost_skeleton --topology` + `ghost_skeleton --reachability <target>`, inspect existing architecture, run preflight validator.
- **Required Artifacts**: `.agent_execution/cir.json`, `.agent_execution/workflow-state.json`

## Phase 2: Targeted Strike Execution
- **Lead**: conductor
- **Agents**: strike-worker-backend and/or strike-worker-frontend (only needed workers)
- **Actions**: Dispatch only the workers needed for the targeted change. Zero-Worker Fast-Path if single-file edit <= 25 lines.
- **Required Artifacts**: `.agent_execution/receipts/`

## Phase 3: Compiler Gate & Adversarial Audit
- **Lead**: conductor, qa-auditor
- **Actions**: Compiler gate → qa-auditor audit.
- **Required Artifacts**: `.agent_execution/audit-report.md`

## Phase 4: Live Checkpoint & Memory
- **Lead**: conductor
- **Actions**: Browser checkpoint, memory_guardian, git commit.
- **Required Artifacts**: `.agent_execution/delivery-signoff.md`
