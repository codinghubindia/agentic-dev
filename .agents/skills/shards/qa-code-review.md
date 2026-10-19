# Micro-Skill: Rigorous Code Review & Contract Compliance

**Scope**: Git diff review, contract fidelity, error handling verification, and code quality.

## Rules & Checklists
1. **Contract Compliance**:
   - Verify every modified endpoint or service conforms strictly to `contracts.ts` / OpenAPI schemas.
   - Forbid undocumented request parameters or altered response shapes.
2. **Error Propagation & Completeness**:
   - Verify all asynchronous calls have proper error handling or propagate to global error handlers.
   - Forbid empty `catch {}` blocks or swallowed errors that silently hide bugs.
3. **No Dead or Debug Code**:
   - Ensure zero `console.log`, `debugger`, `TODO`, or `FIXME` comments remain in diffs ready for release.
   - Verify all unused variables, imports, or dead code branches are removed.
4. **Performance Anti-Pattern Scan**:
   - Flag synchronous blocking operations inside async request loops.
   - Flag unbounded arrays rendered in UI without list virtualization.
5. **Meaningful Test Verification**:
   - Ensure new features have both positive and negative error path tests.
   - Reject tests that only check for status 200 without validating returned payload fields.
