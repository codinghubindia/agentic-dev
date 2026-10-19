# Data Sub-Role: Database Migrations & Evolution

Consolidated from `migration-worker`.

## Responsibilities & Standards
- Author idempotent, reversible database migrations (Prisma migrate, Drizzle-kit, Knex, Flyway, or raw SQL).

## Migrations Checklist
- [ ] Versioning: Timestamped or sequentially numbered migration files (`YYYYMMDDHHMMSS_create_users_table.sql`).
- [ ] Forward & Rollback: Every migration has an idempotent `UP` script and a tested `DOWN` rollback script.
- [ ] Zero-Downtime Safe: Adding non-null columns must provide a default value; dropping columns performed in multi-step deprecation phases.
- [ ] Lock Contention: Large table index creation uses `CONCURRENTLY` (PostgreSQL) to avoid locking read/write traffic.
- [ ] Pre/Post Validation: Automated tests run migrations from zero to latest on a clean database and roll back to zero without syntax or foreign key errors.
