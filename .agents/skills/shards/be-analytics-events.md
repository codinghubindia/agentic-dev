# Micro-Skill: Backend Analytics & Event Tracking

**Scope**: Server-side event tracking, analytics taxonomy, and PII sanitization.

## Rules & Checklists
1. **Taxonomy & Naming Standards**:
   - Use snake_case `[noun]_[action]` naming: `user_registered`, `order_placed`, `team_invited`.
   - Include standard envelope: `{ event, timestamp, anonymousId, userId, tenantId, properties }`.
2. **Strict PII Scrubbing**:
   - Never track raw passwords, credit cards, SSNs, phone numbers, or cleartext emails.
   - Hash or pseudonymize identifiers (e.g. SHA-256 with secret salt) before sending to analytics providers.
3. **Non-Blocking Async Dispatch**:
   - Track events asynchronously via background job queues (BullMQ, SQS, Kafka) or non-blocking event loops.
   - Analytics errors or network timeouts must never fail or slow down the primary HTTP request.
4. **Schema Enforcement**:
   - Validate analytics event payloads using strict Zod schemas to prevent schema drift across releases.
5. **Idempotency & Deduplication**:
   - Include unique `messageId` (UUIDv7) on every emitted event to facilitate consumer deduplication.
