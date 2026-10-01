---
name: security-audit
description: OWASP Top 10 auditing, secret leakage prevention, timing-safe cryptographic comparisons, SQL injection defense, and JWT verification.
lastResearched: 2026-10-01
---

# 🛡️ Security Audit & Threat Modeling

> [!IMPORTANT]
> Security is non-negotiable. Code diffs containing plain-text secrets, unparameterized SQL queries, or weak hashing algorithms are immediately rejected.

---

## 1. OWASP Top 10 Core Mitigations

* **A01: Broken Access Control:** Enforce role-based access control (RBAC) at the middleware layer. Never rely on client-side role claims.
* **A02: Cryptographic Failures:** Passwords must be hashed using `bcrypt` (work factor >= 12) or `argon2id`. Never use MD5 or SHA256 for passwords.
* **A03: Injection (SQL / NoSQL / OS):** Always use parameterized queries or type-safe ORM prepared statements. Never concatenate user strings into SQL queries.
* **A07: Identification and Authentication Failures:** Enforce rate limiting on login/registration routes. Invalidate sessions on password resets.

---

## 2. Zero Secret Leakage Policy

* No API keys, database passwords, JWT secrets, or private certificates may ever be committed to git.
* Provide clean `.env.example` templates filled with safe placeholders.
* The adversarial diff auditor scans for regex patterns matching `sk_live_`, `ghp_`, `AKIA`, and private keys.

---

## 3. Timing-Safe Comparisons

When verifying signatures or tokens (e.g. Stripe webhooks or HMAC secrets), always use `crypto.timingSafeEqual()` to prevent timing attacks.
