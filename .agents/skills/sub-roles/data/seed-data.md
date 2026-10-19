# Data Sub-Role: Representative Seed & Fixture Data

Consolidated from `seed-data-worker`.

## Responsibilities & Standards
- Build realistic, deterministic seed data scripts for development, testing, and staging environments.

## Seed Data Checklist
- [ ] Realistic Data: Use realistic names, addresses, emails, timestamps, and transactions (using `@faker-js/faker` with a deterministic seed).
- [ ] Edge Cases Included: Seed data must include boundary cases: long strings, zero values, special characters (UTF-8/emoji), empty relationships, and active/inactive/deleted states.
- [ ] Relational Consistency: Ensure foreign keys, parent-child hierarchies, and polymorphic links are completely valid.
- [ ] Idempotent Execution: Running the seed script twice (`npm run db:seed`) produces the same clean state without violating unique constraints.
