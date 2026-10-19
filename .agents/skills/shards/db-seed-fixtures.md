# Micro-Skill: Database Seed Data & Test Fixtures

**Scope**: Deterministic database seeding, test fixtures, and referential setup.

## Rules & Checklists
1. **Deterministic & Idempotent Seeding**:
   - Use deterministic pseudo-random seeds or static UUIDs/fixtures for reproducible test runs.
   - Use `UPSERT` (`INSERT ... ON CONFLICT (id) DO UPDATE / DO NOTHING`) so seeds can re-run without errors.
2. **Referential Insertion Order**:
   - Insert entities in strict dependency order: tenants -> users -> roles -> domain entities -> child relations.
   - Teardown/cleanup scripts must delete in reverse topological order to respect foreign key constraints.
3. **Boundary & Edge-Case Coverage**:
   - Include realistic edge cases: names with Unicode/accents (`Zoë`, `O'Connor`), max-length strings (255 chars), zero values, boundary dates.
   - Provide multi-tenant seed data ensuring tenant A cannot access tenant B records.
4. **Environment Isolation**:
   - Never run development seed scripts against production databases. Guard with `NODE_ENV !== 'production'`.
5. **Fixture Factories**:
   - Use factory patterns (`createTestUser(overrides)`) with sensible defaults for unit and integration testing.
