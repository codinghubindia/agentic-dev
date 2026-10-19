# Micro-Skill: Database Query Tuning & Performance

**Scope**: SQL query optimization, execution plan analysis, and connection pooling.

## Rules & Checklists
1. **Execution Plan Auditing**:
   - Run `EXPLAIN (ANALYZE, BUFFERS)` on slow queries (>50ms).
   - Eliminate `Seq Scan` on tables exceeding 5,000 rows by adding targeted index covers.
   - Look for `Index Only Scan` when queries only select indexed columns.
2. **Explicit Column Projections**:
   - Never use `SELECT *` in production services; explicitly select only required columns.
   - Drastically cuts memory consumption and enables covering index optimizations.
3. **Read Replica Routing**:
   - Route read-heavy analytical or reporting queries to read replicas.
   - Direct mutations and write-following-reads (read-your-own-writes) strictly to primary.
4. **Connection Pool Tuning**:
   - Size connection pools according to hardware guidelines: `pool_size = (cpu_cores * 2) + disk_spindles`.
   - Configure connection idle timeouts, max lifetime (e.g. 30m), and acquire timeouts.
5. **Slow Query Alerting**:
   - Log queries exceeding 100ms threshold with execution time and parameterized query text.
