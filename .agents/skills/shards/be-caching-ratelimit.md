# Micro-Skill: Backend Caching & Rate Limiting

**Scope**: Redis caching patterns, distributed rate limiting, and stampede prevention.

## Rules & Checklists
1. **Cache Key Namespaces & TTL**:
   - Structure cache keys hierarchically: `{environment}:{service}:{resource}:{id}`.
   - Every single cache key must have an explicit TTL; never leave unbounded keys in memory.
   - Invalidate cache entries immediately upon resource update or deletion.
2. **Cache Stampede Prevention**:
   - Prevent thundering herd on cache expiration using mutex locks or probabilistic early refresh (XFetch).
   - Use stale-while-revalidate where slight eventual consistency is acceptable.
3. **Sliding Window Rate Limiting**:
   - Implement sliding window log or token bucket rate limiters in Redis via Lua scripts.
   - Return standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
   - Return `429 Too Many Requests` with `Retry-After` header when limit exceeded.
4. **Serialization & Size Safeguards**:
   - Store compact, sanitized JSON representations in cache, not entire raw ORM object graphs.
   - Never cache sensitive authentication credentials, passwords, or PII.
5. **Fail-Open Resilience**:
   - If Redis connection drops, fail gracefully to database with warning logs rather than crashing the HTTP worker.
