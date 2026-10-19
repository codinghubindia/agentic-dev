# Micro-Skill: Mobile Offline Storage & Sync Queues

**Scope**: Local embedded persistence, offline mutations, and background sync engines.

## Rules & Checklists
1. **Embedded Storage Selection**:
   - Use SQLite / Drift for relational queries, or Hive / MMKV for fast key-value preferences and small models.
   - Encrypt sensitive local data at rest using platform keystores (iOS Keychain, Android KeyStore).
2. **Optimistic Local Mutations**:
   - Apply user mutations locally immediately; update the UI state without waiting for network responses.
   - Append failed or pending mutations to a persistent, durable FIFO sync queue.
3. **Background Sync Worker**:
   - Process the sync queue in order when network connectivity is re-established.
   - Use exponential backoff with jitter on transient HTTP 5xx network errors.
4. **Deterministic Conflict Resolution**:
   - Include version numbers or timestamp vectors on mutating entities.
   - Apply deterministic conflict resolution (e.g. server-reconciliation with user prompt on collision).
5. **Storage Budgets & Compaction**:
   - Enforce max storage limits on cached images and query responses; purge least-recently-used (LRU) files.
