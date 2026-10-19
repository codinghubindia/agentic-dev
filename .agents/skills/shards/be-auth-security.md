# Micro-Skill: Backend Authentication & Security

**Scope**: Authentication, authorization, session lifecycle, and token security.

## Rules & Checklists
1. **Password & Secret Hashing**:
   - Use Argon2id (memory 64MB, iterations 3) or bcrypt (salt rounds >= 12).
   - Never log passwords, tokens, API keys, or raw hashes.
2. **Token Architecture**:
   - Issue short-lived access tokens (5–15 minutes expiry) signed with asymmetric keys (RS256/EdDSA) or secure secrets.
   - Issue rotating refresh tokens stored exclusively in `httpOnly`, `Secure`, `SameSite=Strict` cookies.
   - Detect refresh token reuse: invalidate all child tokens and revoke the session on collision.
3. **Role-Based Access Control (RBAC)**:
   - Enforce authorization checks in dedicated middleware before route handlers execute.
   - Verify ownership: Ensure authenticated user owns the resource (`user.id === resource.userId` or user has tenant admin role).
4. **Timing-Safe Operations**:
   - Use `crypto.timingSafeEqual()` when verifying tokens, hashes, HMAC webhooks, or API keys.
5. **Brute Force Protection**:
   - Enforce strict rate limits on `/auth/login`, `/auth/register`, and `/auth/reset-password` (e.g. 5 attempts / 15 min per IP).
   - Add account lockout or exponential delay on repeated consecutive failures.
