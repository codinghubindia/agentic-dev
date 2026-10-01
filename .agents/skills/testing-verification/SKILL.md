---
name: testing-verification
description: 4-stage shift-left testing strategy, zero-token compiler gating, Vitest/Jest unit & integration test standards, and contract compliance verification.
lastResearched: 2026-10-01
---

# 🧪 Testing & Verification Standards

> [!IMPORTANT]
> Deterministic compiler gates (`tsc`, `pytest`, `cargo check`) catch 85% of syntax and type errors at **0 LLM tokens**. Always prioritize automated machine verification over human or LLM manual code inspection.

---

## 1. The 4-Stage Shift-Left Testing Pyramid

```
[ Stage 3: Live User Browser Checkpoint ] ──► Final visual sign-off
                  ▲
[ Stage 2: Adversarial Diff-Only QA ]     ──► Security, OWASP, Anti-Vibe-Code
                  ▲
[ Stage 1: Deterministic 0-Token Gate ]   ──► tsc --noEmit / pytest (Machine only)
                  ▲
[ Stage 0: Worker Local In-Flight Check ] ──► Unit tests for modified functions
```

---

## 2. Unit Testing Requirements (Vitest / Jest)

* Test business logic, utility transforms, and API client adapters.
* Mock external network boundaries with `msw` or in-memory fixtures.
* Coverage target: >= 80% on critical domain services.

---

## 3. Machine Gate Command Standards

* **TypeScript / Node:** `npx tsc --noEmit`
* **Python:** `pytest -q` or `python -m py_compile <file>`
* **Rust:** `cargo check --quiet`
* **Go:** `go vet ./...`
