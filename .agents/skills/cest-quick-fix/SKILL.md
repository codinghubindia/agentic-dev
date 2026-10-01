---
name: cest-quick-fix
description: CEST Zero-Worker Fast-Path for micro-edits (<=25 lines, single file). Conductor edits directly — no worker dispatch.
lastResearched: 2026-10-01
sources:
  - .agents/workflows/cest-quick-fix.json
---

# CEST Zero-Worker Fast-Path

> [!IMPORTANT]
> Use this workflow ONLY for single-file edits of <= 25 lines. Conductor acts directly without spawning any workers.

## Eligibility Criteria
- Single file target
- <= 25 lines changed
- No cross-module dependencies affected
- No new packages needed

## Fast-Path Steps
1. Conductor reads the target file via `view_file`
2. Conductor makes the edit via `replace_file_content`
3. Run targeted verification: `npx tsc --noEmit` or equivalent
4. Skip all worker dispatch, boundary collision checks, and liveness timers
5. Commit and report

## Fast-Path Config
```json
{
  "fastPath": {
    "maxTouchedFiles": 1,
    "maxLinesChanged": 25,
    "bypassWorkerSpawn": true
  }
}
```
