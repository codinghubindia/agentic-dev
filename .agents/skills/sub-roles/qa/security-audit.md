# QA Sub-Role: Security Audit & Penetration Hardening

Consolidated from `security-lead`.

## Responsibilities & Standards
- Audit code against OWASP Top 10 vulnerabilities, secrets leakage, dependency CVEs, and CORS/CSRF attacks.

## Security Checklist
- [ ] Secrets Scan: Zero API keys, database credentials, JWT secrets, or private keys committed to git history or repo files.
- [ ] Dependency Audit: Zero high or critical severity CVEs in `npm audit` or equivalent package manager audit.
- [ ] Injection Defense: All SQL queries parameterized, all HTML rendered safely with sanitization (DOMPurify).
- [ ] Security Headers: Helmet/security headers active (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `X-Frame-Options: DENY`).
- [ ] CORS Configuration: Strict allowed origins list; zero `Access-Control-Allow-Origin: *` in production environments with credentials.
- [ ] Authentication Guardrails: Rate limiting on sensitive endpoints, constant-time token comparison, secure password hashing.
