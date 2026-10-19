# Micro-Skill: Security Auditing & Vulnerability Review

**Scope**: Security posture verification, OWASP Top 10 defenses, and secret scanning.

## Rules & Checklists
1. **Zero Secret Leakage**:
   - Audit code diffs for hardcoded API keys, private keys, passwords, or JWT secrets.
   - Verify all credentials load strictly from environment variables (`process.env`).
2. **IDOR & Authorization Boundaries**:
   - Ensure every query/mutation validates that the requesting user has explicit permission on target resource ID.
   - Never trust client-supplied tenant or user IDs without session verification.
3. **Injection Defenses**:
   - SQLi: Verify 100% parameterization in all SQL queries and ORM calls.
   - XSS: Verify HTML escaping and forbid `dangerouslySetInnerHTML` without DOMPurify sanitization.
   - SSRF: Restrict outbound HTTP calls to a strict allowlist of validated domains and protocol schemes.
4. **Security Response Headers**:
   - Enforce security headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`.
   - Configure strict CORS origins; never use `Access-Control-Allow-Origin: *` with credentials.
5. **Dependency Audit**:
   - Ensure zero High or Critical CVEs in project dependencies (`npm audit --audit-level=high`).
