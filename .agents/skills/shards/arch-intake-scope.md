# Micro-Skill: Architecture Intake & Slice Scoping

**Scope**: Requirement decomposition, vertical slice scoping, and ownership mapping.

## Rules & Checklists
1. **Intake Classification**:
   - Classify incoming requests: `Feature`, `Refactor`, `Bug Fix`, `Security Patch`, or `Infra`.
   - Query `project-dna.json` to anchor scoping in the project's actual frameworks, libraries, and tools.
2. **End-to-End Vertical Slicing**:
   - Decompose work into thin, testable vertical slices delivering complete user value end-to-end.
   - Avoid horizontal layer-by-layer handoffs; each slice includes data schema, backend service, and UI component.
3. **Disjoint Ownership Boundaries**:
   - Map files to responsible Macro Role Templates via `file-responsibility-index.json`.
   - Ensure parallel slices operate on disjoint file paths to eliminate merge conflicts.
4. **Prerequisite & Dependency Ordering**:
   - Sequence tasks topologically: Database schema/migrations -> Service/API routes -> UI components -> QA verification.
5. **Clear Definition of Done (DoD)**:
   - Every slice must specify: code files modified, unit/integration tests written, and quality gate pass criteria.
