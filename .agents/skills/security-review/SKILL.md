---
name: security-review
description: Comprehensive security auditing guide covering OWASP Top 10, JWT/auth security, secret scanning, dependency CVE auditing, input sanitization, SQL injection prevention, XSS defense, CSRF protection, rate limiting, and security headers.
refreshMode: full
lastResearched: 2026-09-28
---

# Security Review Skill

Security procedures and standards for auditing software before production release.

---

## 1. OWASP Top 10 — Audit Checklist

| # | Vulnerability | Check |
|---|---|---|
| A01 | Broken Access Control | RBAC enforced at every route? Auth checked before data access? |
| A02 | Cryptographic Failures | Passwords hashed (bcrypt/Argon2)? Tokens signed (not encoded)? HTTPS enforced? |
| A03 | Injection | All inputs parameterized? No string interpolation in SQL/shell? |
| A04 | Insecure Design | Business logic abuse paths considered? Rate limits on sensitive actions? |
| A05 | Security Misconfiguration | Debug mode off? Default credentials changed? Error details hidden? |
| A06 | Vulnerable Components | All dependencies audited for CVEs? No abandoned packages? |
| A07 | Auth & Session Failures | Token expiry set? Refresh token rotation? Session invalidation on logout? |
| A08 | Software & Data Integrity | Dependencies from verified sources? Checksums verified? |
| A09 | Logging & Monitoring | Auth failures logged? No sensitive data in logs? Alerting configured? |
| A10 | Server-Side Request Forgery | External URL inputs validated/allowlisted? |

---

## 2. Authentication Security

### JWT Requirements
```typescript
// REQUIRED configuration
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },  // minimal claims only
  process.env.JWT_SECRET!,               // must be ≥ 32 chars, stored in env
  {
    algorithm: 'HS256',
    expiresIn: '15m',                   // SHORT — 15 minutes maximum
    issuer: 'your-app-name',
  }
);

// Refresh token: long-lived, single-use, stored in DB
const refreshToken = crypto.randomBytes(64).toString('hex');
// Store hashed in DB: await db.refreshTokens.create({ hash: hashToken(refreshToken), userId })
```

### Checklist
- [ ] Access token expiry ≤ 15 minutes
- [ ] Refresh token is single-use (rotate on every refresh request)
- [ ] Refresh tokens stored **hashed** in database (never plaintext)
- [ ] Logout invalidates the refresh token in the database
- [ ] JWT secret is ≥ 32 random characters stored in environment variable
- [ ] JWT verification rejects `alg: none` (use explicit algorithm list)

---

## 3. Password Security

```typescript
import bcrypt from 'bcrypt';

// Hashing: min 12 rounds
export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);

// Verification: always use bcrypt.compare — constant time comparison
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
```

**Rules:**
- NEVER store plaintext passwords — only bcrypt/Argon2 hashes
- NEVER compare passwords with `===` — use constant-time comparison
- Password reset tokens must be short-lived (15 min), single-use, cryptographically random
- Do NOT expose whether email exists via login error messages (same error for "not found" and "wrong password")

---

## 4. SQL Injection Prevention

```typescript
// ALWAYS: use parameterized queries
const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

// NEVER: string interpolation in SQL
const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`); // VULNERABLE

// With ORMs: use the ORM's query builder (never raw() with user input)
const user = await User.findOne({ where: { email } }); // Safe
```

---

## 5. XSS Prevention

- **React/Vue**: template engines escape by default — safe unless using `dangerouslySetInnerHTML` / `v-html`
- Never insert user-provided HTML directly into the DOM
- Content Security Policy (CSP) header via `helmet`:
  ```typescript
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  }));
  ```
- Sanitize rich text input with `DOMPurify` if user HTML is required

---

## 6. Secret Scanning — Checklist

Scan the entire codebase and git history:
- [ ] No API keys, tokens, or passwords in source code
- [ ] No secrets in `.env` files committed to git (only `.env.example` with placeholders)
- [ ] No secrets in Dockerfiles (`ENV SECRET=...`)
- [ ] No secrets in CI workflow files (must use `${{ secrets.NAME }}`)
- [ ] Git history clean (use `git log -S "secret-value"` to check)
- [ ] `.gitignore` includes `.env`, `.env.local`, `.env.*.local`

---

## 7. Dependency Vulnerability Scan

```bash
# Node.js
npm audit --audit-level=high    # fail on high/critical

# Python
pip-audit                        # or: safety check

# Check for abandoned/deprecated packages
npx depcheck                     # finds unused deps
```

- **Critical/High CVEs**: must be resolved before release
- **Medium CVEs**: must have a documented mitigation or remediation plan
- **No packages** with last publish > 2 years (evaluate for replacement)

---

## 8. Security Headers (helmet.js)

```typescript
app.use(helmet());
// Automatically sets:
// X-Content-Type-Options: nosniff
// X-Frame-Options: SAMEORIGIN
// Strict-Transport-Security: max-age=15552000
// X-XSS-Protection: 0 (modern browsers use CSP instead)
// Referrer-Policy: no-referrer
// Content-Security-Policy (configure explicitly)
```

---

## 9. Rate Limiting on Sensitive Routes

```typescript
// Stricter limits for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                      // 10 attempts per 15 min
  skipSuccessfulRequests: true,  // only count failures
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
```

---

## 10. Audit Sign-Off Severity Classification

| Severity | Definition | Release Decision |
|---|---|---|
| **Critical** | Data breach, auth bypass, remote code execution | Block release immediately |
| **High** | Privilege escalation, major data exposure | Must fix before release |
| **Medium** | Limited exposure, security misconfiguration | Fix before next release or document mitigation |
| **Low** | Defence-in-depth improvement, best practice gap | Backlog |
