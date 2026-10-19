# Micro-Skill: Backend Business Logic & Domain Services

**Scope**: Service layer architecture, domain business rules, and transaction boundaries.

## Rules & Checklists
1. **Thin Controllers, Rich Services**:
   - Controllers handle HTTP routing, request parsing, and status code mapping only.
   - All domain rules, calculations, and multi-entity orchestrations belong in service modules.
2. **Atomic Transaction Boundaries**:
   - Wrap multi-table or multi-entity mutations in explicit transactions (`db.transaction(async (tx) => ...)`).
   - Never perform long-running external API calls (e.g. Stripe, email) inside an open database transaction lock.
   - Ensure complete rollback on any thrown exception.
3. **Domain Error Hierarchy**:
   - Throw typed domain errors (`EntityNotFoundError`, `ConflictError`, `InsufficientBalanceError`) from services.
   - Let central error middleware map domain errors to HTTP RFC 9457 responses.
4. **Dependency Injection & Decoupling**:
   - Pass repositories, logger, and external adapters into services via parameters or constructor.
   - Decouple non-critical side effects (welcome emails, audit logs) using async domain event emitters.
5. **Idempotent Operations**:
   - Design service methods to be safely re-runnable when processing retried webhooks or queue jobs.
