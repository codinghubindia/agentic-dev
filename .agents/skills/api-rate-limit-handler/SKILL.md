---
name: api-rate-limit-handler
description: "Implement bounded, idempotency-aware API throttling, backoff, and retry handling for 429 and transient 5xx responses."
category: development
tags: [rate-limiting, retry, backoff, api, resilience, throttle, 429]
license: "MIT"
---

# API Rate Limit Handler & Outbound Resilience

## Overview

A skill for implementing production-grade rate limiting, exponential backoff, and retry strategies when integrating with external and upstream APIs. Prevents cascading failures, respects upstream quotas, and keeps your application resilient under load.

## When to Use This Skill

- Use when calling external APIs that enforce rate limits (OpenAI, Stripe, GitHub, AWS, etc.)
- Use when you receive `429 Too Many Requests` or transient `5xx` errors and need graceful recovery
- Use when building a client that must respect `Retry-After` headers
- Use when designing a system that fans out to multiple API providers
- Use when implementing outbound HTTP clients with circuit breaking and jitter

## How It Works

### Step 1: Classify the Response

Determine whether a failed request is retryable or terminal:

| Status Code | Classification | Action |
|-------------|---------------|--------|
| **200–299** | Success | Return response payload |
| **400, 401, 403, 404, 422** | Terminal client error | Do not retry — fix request parameters |
| **408, 429** | Retryable (rate limit / client timeout) | Retry with backoff |
| **500, 502, 503, 504** | Retryable (upstream server error) | Retry with backoff |

### Step 2: Parse Rate Limit Headers

Always inspect upstream hints before computing fallback delays:

```typescript
export function getRetryDelay(
  response: Response,
  attempt: number,
  maxDelayMs = 60_000
): number {
  // 1. Prefer Retry-After header (seconds or HTTP-date)
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, maxDelayMs);
    }
    const date = new Date(retryAfter).getTime();
    if (Number.isFinite(date)) {
      return Math.min(Math.max(0, date - Date.now()), maxDelayMs);
    }
  }

  // 2. Check provider-specific reset headers (e.g. GitHub x-ratelimit-reset epoch seconds)
  const githubReset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(githubReset)) {
    return Math.min(
      Math.max(0, githubReset * 1000 - Date.now()),
      maxDelayMs
    );
  }

  // 3. Fallback: Full Jitter Exponential Backoff (prevents thundering herd)
  const baseDelay = 1000;
  const cap = Math.min(baseDelay * Math.pow(2, attempt), maxDelayMs);
  return Math.floor(Math.random() * cap);
}
```

### Step 3: Implement the Idempotency-Aware Retry Loop

```typescript
export interface FetchRetryOptions extends RequestInit {
  maxRetries?: number;
  maxElapsedMs?: number;
  retryNonIdempotent?: boolean;
}

export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    maxElapsedMs = 120_000,
    retryNonIdempotent = false,
    ...fetchOptions
  } = options;

  const startedAt = Date.now();
  const method = (fetchOptions.method ?? "GET").toUpperCase();
  const isIdempotent = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"].includes(method);
  const replaySafe = isIdempotent || retryNonIdempotent;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.ok) return response;

      // Terminal errors — do not retry
      if ([400, 401, 403, 404, 422].includes(response.status)) {
        throw new Error(`Terminal error ${response.status}: ${response.statusText}`);
      }

      // Non-idempotent mutation protection (POST without Idempotency-Key)
      if (!replaySafe) {
        throw new Error(
          `${method} was not retried because replay safety was not explicitly established. Add an Idempotency-Key header to enable safe retries.`
        );
      }

      // Retryable but attempts exhausted
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} retries: ${response.status}`);
      }

      const elapsed = Date.now() - startedAt;
      const remainingTime = maxElapsedMs - elapsed;
      if (remainingTime <= 0) {
        throw new Error(`Exceeded maxElapsedMs (${maxElapsedMs}ms) during retries`);
      }

      const delay = Math.min(getRetryDelay(response, attempt), remainingTime);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (err: unknown) {
      if (attempt === maxRetries || !replaySafe) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Unreachable");
}
```

### Step 4: Outbound Traffic Invariants

1. **Always Use Full Jitter**: Never use deterministic backoff (`1s`, `2s`, `4s`). When thousands of clients retry simultaneously, uniform intervals cause cyclic traffic spikes (thundering herd). Always multiply by `Math.random()`.
2. **Respect Idempotency**: Never blindly retry `POST` requests unless an `Idempotency-Key` or `X-Request-ID` is passed, otherwise customers may be double-billed or duplicate records created.
3. **Hard Elapsed Timeout**: Always enforce a global `maxElapsedMs` boundary so retrying requests do not tie up backend worker threads indefinitely.
