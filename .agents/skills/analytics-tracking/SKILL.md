---
name: analytics-tracking
description: Product analytics and event tracking guide covering event taxonomy design, SDK-agnostic wrapper patterns, PostHog/Mixpanel/Amplitude/Segment integration, PII scrubbing, consent management (GDPR/CCPA), server-side tracking, React hooks for tracking, automatic page view capture, funnel definitions, and tracking plan documentation.
refreshMode: sections
lastResearched: 2026-09-27
refreshableSections:
  - "SDK integrations"
protectedSections:
  - "Event taxonomy"
  - "PII scrubbing"
---

# Analytics & Event Tracking Skill

Standards for implementing reliable, privacy-respecting product analytics across frontend and backend.

---

## 1. Core Principles

```
Track behavior, not identity.
Events answer: WHAT did the user do?
Properties answer: HOW did they do it?
Never answer: WHO are they? (no PII)
```

**The four rules:**
1. **No PII in events** — no email, name, phone, address, payment info, IP addresses
2. **No tracking in dev** — dev events pollute analytics; always guard `if (production)`
3. **Fail silently** — analytics must NEVER crash the app or block the main thread
4. **Consent before tracking** — check user consent in GDPR/CCPA regions before firing

---

## 2. Event Taxonomy Design

Design the full event schema BEFORE writing any tracking code.

### Naming Convention
```
[object]_[action]

Examples:
  sign_up_completed     ← object: sign_up, action: completed
  item_created          ← object: item, action: created
  page_viewed           ← object: page, action: viewed
  cta_clicked           ← object: cta, action: clicked
  filter_applied        ← object: filter, action: applied
  payment_failed        ← object: payment, action: failed

❌ Avoid:
  buttonClick           (camelCase — use snake_case)
  clicked_button        (action before object)
  btn1                  (non-descriptive)
  user_did_thing        (vague)
```

### Standard Event Categories
```typescript
export const ANALYTICS_EVENTS = {
  // Auth lifecycle
  SIGN_UP_STARTED:           'sign_up_started',
  SIGN_UP_COMPLETED:         'sign_up_completed',
  SIGN_UP_FAILED:            'sign_up_failed',
  LOGIN:                     'login',
  LOGOUT:                    'logout',
  PASSWORD_RESET_REQUESTED:  'password_reset_requested',
  PASSWORD_RESET_COMPLETED:  'password_reset_completed',

  // Onboarding
  ONBOARDING_STEP_VIEWED:    'onboarding_step_viewed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED:      'onboarding_completed',
  ONBOARDING_SKIPPED:        'onboarding_skipped',

  // Core product actions (customize per product)
  ITEM_CREATED:              'item_created',
  ITEM_UPDATED:              'item_updated',
  ITEM_DELETED:              'item_deleted',
  ITEM_VIEWED:               'item_viewed',
  ITEM_SHARED:               'item_shared',

  // Search & discovery
  SEARCH_PERFORMED:          'search_performed',
  SEARCH_RESULT_CLICKED:     'search_result_clicked',
  FILTER_APPLIED:            'filter_applied',
  SORT_CHANGED:              'sort_changed',

  // Navigation
  PAGE_VIEWED:               'page_viewed',
  CTA_CLICKED:               'cta_clicked',
  LINK_CLICKED:              'link_clicked',
  MODAL_OPENED:              'modal_opened',
  MODAL_CLOSED:              'modal_closed',

  // Errors & failures
  ERROR_SHOWN:               'error_shown',
  API_ERROR:                 'api_error',
  FORM_VALIDATION_FAILED:    'form_validation_failed',

  // Engagement
  FEEDBACK_SUBMITTED:        'feedback_submitted',
  UPGRADE_CLICKED:           'upgrade_clicked',
  NOTIFICATION_CLICKED:      'notification_clicked',
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
```

### Property Guidelines
For each event, define allowed properties upfront:

```typescript
// Properties are always flat objects — no nested objects, no arrays
type EventProperties = Record<string, string | number | boolean | null>;

// Examples of good properties
track('item_created', {
  item_type: 'task',          // string — what kind
  template_used: true,        // boolean — how they did it
  item_count: 5,              // number — context
});

track('search_performed', {
  query_length: 12,           // number — DO NOT track the query string itself (PII risk)
  result_count: 42,           // number
  search_type: 'global',      // string
  has_filters: true,          // boolean
});

// ❌ NEVER include these in any event
{ email: '...' }              // PII
{ name: '...' }               // PII
{ phone: '...' }              // PII
{ password: '...' }           // Credential
{ ip_address: '...' }         // PII (GDPR)
{ full_query: 'john doe' }    // May contain PII
```

---

## 3. SDK-Agnostic Service Pattern

**Always wrap the SDK.** Direct SDK calls everywhere = impossible to switch providers.

```typescript
// analytics/analytics.service.ts
type EventProperties = Record<string, string | number | boolean | null | undefined>;

interface AnalyticsUser {
  id: string;        // Internal user ID only — never email
  plan?: string;     // 'free' | 'pro' | 'enterprise'
  createdAt?: string;
  // ❌ NO: email, name, phone, address
}

class AnalyticsService {
  private initialized = false;
  private consentGiven = false;
  private queue: Array<{ event: string; properties?: EventProperties }> = [];

  /** Call once at app startup */
  init(config: { writeKey?: string; host?: string }) {
    if (this.initialized) return;
    if (typeof window === 'undefined') return; // SSR guard

    // Example: PostHog
    import('posthog-js').then(({ default: posthog }) => {
      posthog.init(config.writeKey!, {
        api_host: config.host ?? 'https://app.posthog.com',
        autocapture: false,        // manual only
        capture_pageview: false,   // manual page views
        persistence: 'localStorage',
      });
      this.initialized = true;
      this.flushQueue();
    });
  }

  /** Call after user confirms consent (cookie banner) */
  grantConsent() {
    this.consentGiven = true;
    this.flushQueue();
  }

  /** Call when user withdraws consent */
  revokeConsent() {
    this.consentGiven = false;
    import('posthog-js').then(({ default: posthog }) => posthog.opt_out_capturing());
  }

  /** Identify user after login (non-PII properties only) */
  identify(user: AnalyticsUser) {
    if (!this.canTrack()) return;
    import('posthog-js').then(({ default: posthog }) => {
      posthog.identify(user.id, {
        plan: user.plan,
        created_at: user.createdAt,
      });
    });
  }

  /** Track an event */
  track(event: AnalyticsEvent, properties?: EventProperties) {
    const safe = this.sanitize(properties);
    if (!this.canTrack()) {
      this.queue.push({ event, properties: safe }); // queue for when consent given
      return;
    }
    import('posthog-js').then(({ default: posthog }) => posthog.capture(event, safe));
  }

  /** Track a page view */
  page(name: string, properties?: EventProperties) {
    this.track('page_viewed' as AnalyticsEvent, {
      page: name,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      ...properties,
    });
  }

  /** Call on logout — clears user identity */
  reset() {
    import('posthog-js').then(({ default: posthog }) => posthog.reset());
  }

  private canTrack(): boolean {
    if (!this.initialized) return false;
    if (process.env.NODE_ENV !== 'production') return false; // no dev noise
    return true; // skip consent check for non-GDPR regions; add if needed
  }

  private flushQueue() {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.track(item.event as AnalyticsEvent, item.properties);
    }
  }

  /** Strip any accidentally included PII */
  private sanitize(props?: EventProperties): EventProperties {
    if (!props) return {};
    const PII = ['email', 'name', 'phone', 'address', 'password', 'token', 'secret', 'card', 'ssn', 'ip'];
    return Object.fromEntries(
      Object.entries(props).filter(([k]) => !PII.some(p => k.toLowerCase().includes(p)))
    );
  }
}

export const analytics = new AnalyticsService();
```

---

## 4. React Integration Patterns

### Custom Hook
```tsx
// hooks/useAnalytics.ts
import { useCallback } from 'react';
import { analytics } from '../analytics/analytics.service';
import type { AnalyticsEvent } from '../analytics/events';

type Props = Record<string, string | number | boolean | null | undefined>;

export function useAnalytics() {
  const track = useCallback((event: AnalyticsEvent, properties?: Props) => {
    analytics.track(event, properties);
  }, []);
  return { track };
}
```

### Automatic Page View Tracking (React Router v6)
```tsx
// components/AnalyticsListener.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from '../analytics/analytics.service';

// Route → readable page name mapping
const PAGE_NAMES: Record<string, string> = {
  '/':             'Home',
  '/dashboard':    'Dashboard',
  '/settings':     'Settings',
  '/login':        'Login',
  '/register':     'Register',
  '/onboarding':   'Onboarding',
};

function getPageName(path: string): string {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  // Dynamic routes
  if (/^\/items\/[^/]+$/.test(path)) return 'Item Detail';
  if (/^\/users\/[^/]+$/.test(path)) return 'User Profile';
  return 'Unknown';
}

export function AnalyticsListener() {
  const { pathname } = useLocation();
  useEffect(() => {
    analytics.page(getPageName(pathname));
  }, [pathname]);
  return null;
}

// Add to your router root:
// <RouterProvider router={router}>
//   <AnalyticsListener />
//   <App />
// </RouterProvider>
```

---

## 5. Server-Side Tracking (Node.js)

For backend events that happen without user interaction (payment processed, email sent):

```typescript
// backend/src/services/analytics.server.ts
import { PostHog } from 'posthog-node';

const client = process.env.NODE_ENV === 'production'
  ? new PostHog(process.env.POSTHOG_KEY!, {
      host: process.env.POSTHOG_HOST,
      flushAt: 20,
      flushInterval: 10_000,
    })
  : null; // no dev tracking

export function trackServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, string | number | boolean>
) {
  client?.capture({ distinctId: userId, event, properties });
}

// Flush on graceful shutdown (important — don't lose queued events)
process.on('SIGTERM', async () => { await client?.shutdown(); });
process.on('SIGINT', async () => { await client?.shutdown(); });
```

Usage in services:
```typescript
// After a successful payment
trackServerEvent(userId, 'subscription_started', {
  plan: 'pro',
  billing_period: 'monthly',
  // ❌ No: amount, card_last4 — use Stripe webhooks for financial data
});
```

---

## 6. Consent Management (GDPR/CCPA)

```tsx
// If targeting EU/California users, gate all analytics behind consent
function CookieConsentBanner() {
  return (
    <div role="dialog" aria-label="Cookie consent">
      <p>We use analytics to improve your experience. No personal data is stored.</p>
      <button onClick={() => {
        localStorage.setItem('analytics-consent', 'granted');
        analytics.grantConsent();
      }}>
        Accept
      </button>
      <button onClick={() => {
        localStorage.setItem('analytics-consent', 'denied');
        analytics.revokeConsent();
      }}>
        Decline
      </button>
    </div>
  );
}

// On app init — restore saved consent
const savedConsent = localStorage.getItem('analytics-consent');
if (savedConsent === 'granted') analytics.grantConsent();
```

---

## 7. Tracking Plan Documentation

Document every event in `analytics/tracking-plan.md`:

```markdown
## Tracking Plan

| Event | Trigger | Properties | PII Risk | Platform |
|---|---|---|---|---|
| `sign_up_completed` | User submits registration successfully | `method: string` (email/google/github), `plan: string` | None | Client + Server |
| `page_viewed` | Route change | `page: string`, `path: string` | Path may contain IDs | Client |
| `item_created` | User submits create form | `item_type: string`, `template_used: boolean` | None | Client |
| `error_shown` | Error boundary or API error | `error_code: string`, `page: string` | None | Client |
| `search_performed` | User submits search | `query_length: number`, `result_count: number` | Never log query string | Client |
```

---

## 8. Funnel Definitions

```markdown
## Signup Funnel
Step 1: `page_viewed` (page: "Register")
Step 2: `sign_up_started` (method: email|google)
Step 3: `sign_up_completed`  ← CONVERSION
Step 4: `onboarding_step_viewed` (step: 1)
Step 5: `onboarding_completed` ← ACTIVATION

## Core Feature Adoption
Step 1: `login`
Step 2: `page_viewed` (page: "Dashboard")
Step 3: `item_created` ← ADOPTION
```

---

## 9. Analytics Quality Checklist

- [ ] All events typed against `ANALYTICS_EVENTS` constants (no raw strings)
- [ ] No PII in any event properties — `sanitize()` in service is last line of defense
- [ ] Tracking disabled in development (`NODE_ENV !== 'production'`)
- [ ] `analytics.reset()` called on logout
- [ ] Consent check implemented for GDPR/CCPA regions
- [ ] Tracking plan documented for every implemented event
- [ ] Server-side events flush on process shutdown
- [ ] Page view tracking fires on every route change (not just initial load)
- [ ] Analytics failure never crashes the app (all calls wrapped, errors caught silently)
