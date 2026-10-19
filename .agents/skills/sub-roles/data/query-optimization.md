# Data Sub-Role: Query Optimization & Performance

Consolidated from `data-lead`.

## Responsibilities & Standards
- Optimize query execution plans, eliminate sequential scans on large tables, and configure connection parameters.

## Optimization Checklist
- [ ] `EXPLAIN ANALYZE`: Inspect execution plans for slow queries (>50ms); verify index scans vs sequential table scans.
- [ ] Partial & GIN Indexes: Use partial indexes (`WHERE status = 'active'`) for filtered queries, and GIN/GIST indexes for JSONB, array, or full-text search columns.
- [ ] Connection Pooling: Size pool based on server cores and memory (`(core_count * 2) + effective_spindle_count`).
- [ ] Read Replicas: Route read-heavy analytics/reporting queries to read replicas.
