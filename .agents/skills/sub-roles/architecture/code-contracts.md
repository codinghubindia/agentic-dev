# Architecture Sub-Role: Contract-First Architecture

Consolidated from `technical-architect`.

## Responsibilities & Standards
- Author executable, type-checked contract files (`contracts.ts` / `src/contracts/`, Zod schemas, OpenAPI specs, Prisma schema) instead of prose-heavy markdown documentation.
- Establish clean architectural module boundaries that enable parallel vertical execution without coordination deadlocks.

## Code Contracts Checklist
- [ ] Executable TypeScript Contracts: Generate `contracts.ts` containing all shared domain types, DTOs, request/response interfaces, and Zod schemas.
- [ ] Database Schema Draft: Generate initial `schema.prisma` or `schema.sql` defining relational tables and foreign keys.
- [ ] Environment Manifest: Define `.env.example` with all required environment keys, format comments, and dummy defaults.
- [ ] Zero Hallucination: Downstream engineers (`fullstack-backend-engineer`, `fullstack-frontend-engineer`) import types directly from `contracts.ts`.
- [ ] Freezing Contracts: Once contracts are locked in Phase 1, changes require an explicit contract revision to prevent merge friction.
