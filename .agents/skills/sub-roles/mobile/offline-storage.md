# Mobile Sub-Role: Offline Storage & Sync

Consolidated from `mobile-lead`.

## Responsibilities & Standards
- Maintain local-first offline storage (Hive, Isar, SQLite/Drift, WatermelonDB) and bidirectional synchronization.

## Offline Storage Checklist
- [ ] Offline Readability: Cached records rendered immediately without displaying blocking spinner when offline.
- [ ] Mutation Queue: Offline mutations queued in persistent FIFO queue with retry on network connectivity restoration.
- [ ] Conflict Resolution: Timestamp-based or Last-Write-Wins (LWW) conflict handling with server authority fallback.
- [ ] Connectivity Listener: Real-time network status banner displayed when device loses internet access.
