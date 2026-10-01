---
name: jose
description: jose v5 — JWT signing, verification, JWK support, and refresh token patterns. The secure replacement for jsonwebtoken.
category: backend
packages: [jose]
workerRoles: [strike-worker-backend]
microTasks: [B2, B3]
currentVersion: 5.9.6
lastResearched: 2026-10-01
refreshIntervalDays: 90
status: stable
---

> [!CAUTION]
> **NEVER use `jsonwebtoken`** — has known CVEs, uses synchronous API, not maintained actively. `jose` is the RFC-compliant replacement with async API and Web Crypto support.

# 🔐 jose v5 — JWT Authentication

## 0. Install
```bash
npm view jose deprecated 2>/dev/null | grep -i deprecated
npm install jose
```

---

## 1. Token Service Pattern

```typescript
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);
const ALG = 'HS256';

export interface TokenPayload extends JWTPayload {
  userId: string;
  role: string;
}

export async function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('15m') // short-lived
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d') // long-lived
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET);
  return payload as TokenPayload;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, REFRESH_SECRET);
  return payload;
}
```

---

## 2. Auth Middleware (Express)

```typescript
import { verifyAccessToken } from '../services/token.service.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ title: 'Unauthorized', status: 401 });
    }
    const token = authHeader.slice(7);
    req.user = await verifyAccessToken(token);
    next();
  } catch {
    // jose throws JWTExpired, JWTInvalid etc. — all caught here
    res.status(401).json({ title: 'Token invalid or expired', status: 401 });
  }
}
```

---

## 3. Refresh Token Pattern

```typescript
// POST /auth/refresh
async function refreshTokens(req: Request, res: Response) {
  const refreshToken = req.cookies['refresh_token']; // httpOnly cookie
  if (!refreshToken) return res.status(401).json({ title: 'No refresh token' });
  
  const payload = await verifyRefreshToken(refreshToken);
  const user = await userService.findById(payload.userId as string);
  if (!user) return res.status(401).json({ title: 'User not found' });
  
  const accessToken = await signAccessToken({ userId: user.id, role: user.role });
  const newRefreshToken = await signRefreshToken(user.id);
  
  // Rotate refresh token
  res.cookie('refresh_token', newRefreshToken, {
    httpOnly: true, secure: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ accessToken });
}
```

---

## 4. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `import jwt from 'jsonwebtoken'` | Use `jose` — jsonwebtoken has CVEs |
| Storing refresh tokens in localStorage | Use httpOnly Secure cookie |
| Not catching `JWTExpired` specifically | `jose` throws typed errors — catch and return 401 |
| Sharing same secret for access + refresh tokens | Use separate secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) |
| Sync JWT signing | `jose` is async by design — always await |
