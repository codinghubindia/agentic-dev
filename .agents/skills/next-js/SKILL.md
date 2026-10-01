---
name: next-js
description: Next.js 14 App Router — Server Components, data fetching, route handlers, metadata, and deployment patterns.
category: frontend
packages: [next]
workerRoles: [strike-worker-frontend]
microTasks: [F1, F2]
currentVersion: 14.2.14
lastResearched: 2026-10-01
refreshIntervalDays: 60
status: stable
---

> [!NOTE]
> **Skill Freshness**: Next.js ships frequently. refreshIntervalDays=60 for this skill.

# ▲ Next.js 14 — App Router Production Patterns

## 0. Install & Scaffold
```bash
# Pre-install deprecation check
npm view next deprecated 2>/dev/null | grep -i deprecated
# Scaffold (non-interactive — all flags suppress prompts)
npx create-next-app@latest my-app --typescript --tailwind --app --src-dir --no-git --import-alias "@/*"
```

---

## 1. Server vs Client Components — The Decision Rule

```
Default = Server Component (no directive needed)
Add 'use client' ONLY when you need:
  - useState / useReducer / useEffect
  - onClick, onChange, or other event handlers  
  - Browser APIs (localStorage, window, document)
  - Third-party libraries that use client hooks

NEVER add 'use client' to:
  - Layout files that just pass children (keep as Server)
  - Pages that only fetch data and render
  - Components that only receive props and render markup
```

---

## 2. Data Fetching — Server Component Pattern

```tsx
// app/products/page.tsx — Server Component, no 'use client'
async function ProductsPage() {
  // fetch() is extended by Next.js — cache options built in
  const products = await fetch('https://api.example.com/products', {
    next: { revalidate: 60 } // ISR: revalidate every 60 seconds
  }).then(r => r.json());

  return <ProductGrid products={products} />;
}

// Force-dynamic (no caching — for user-specific pages)
export const dynamic = 'force-dynamic';

// Force-static (always cached — for landing pages)
export const dynamic = 'force-static';
```

---

## 3. Route Handlers (API Routes in App Router)

```tsx
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2)
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = CreateUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }
  // ... create user
  return NextResponse.json({ id: newUser.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') ?? '1';
  // ...
  return NextResponse.json({ users, page });
}
```

---

## 4. Metadata API

```tsx
// app/products/[id]/page.tsx
import { Metadata } from 'next';

// Static metadata
export const metadata: Metadata = {
  title: 'Products | MyApp',
  description: 'Browse our product catalog'
};

// Dynamic metadata (per-page)
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await fetchProduct(params.id);
  return {
    title: `${product.name} | MyApp`,
    openGraph: { images: [product.imageUrl] }
  };
}
```

---

## 5. Parallel Routes & Loading States

```
app/
  layout.tsx          ← root layout
  loading.tsx         ← automatic Suspense boundary for this segment
  error.tsx           ← automatic Error Boundary for this segment
  @modal/             ← parallel route slot (renders alongside main)
    page.tsx
  dashboard/
    page.tsx
```

```tsx
// app/loading.tsx — shown while page.tsx is streaming
export default function Loading() {
  return <PageSkeleton />; // ← NEVER use a spinner here
}
```

---

## 6. Image & Font Optimization

```tsx
import Image from 'next/image';
import { Inter } from 'next/font/google';

// Font — loads from Google, self-hosted automatically
const inter = Inter({ subsets: ['latin'], display: 'swap' });

// Image — automatic WebP, lazy loading, size optimization
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // add for above-the-fold images only
  className="object-cover"
/>
```

---

## 7. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `'use client'` on layout.tsx | Keep layouts as Server Components |
| `fetch` in Client Components | Move to Server Component or use react-query |
| `useRouter` from `next/navigation` in Server Component | Server Components cannot use hooks |
| Not using `loading.tsx` | Add loading.tsx for every data-fetching segment |
| Raw `<img>` tags | Always use `next/image` |
| Raw `<a>` tags for internal links | Always use `next/link` |
| `getServerSideProps` in App Router | App Router uses async Server Components instead |
