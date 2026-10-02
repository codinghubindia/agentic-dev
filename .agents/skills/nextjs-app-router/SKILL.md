---
name: nextjs-app-router
description: "Comprehensive Next.js App Router patterns, covering React Server Components, Server Actions, route handlers, dynamic segments, caching strategies, and middleware."
category: development
tags: [nextjs, react, app-router, server-components, server-actions, fullstack]
license: "MIT"
---

# Next.js App Router Architecture

## Overview

Authoritative standards for Next.js 14 and 15 fullstack applications built on the App Router. Enforces separation between Server and Client Components, secure Server Actions with Zod validation, predictable data caching, and edge middleware.

## Project Scaffolding

Always scaffold using the official `create-next-app` CLI:

```bash
# Non-interactive Next.js App Router scaffold
npx create-next-app@latest my-app --typescript --tailwind --app --src-dir --no-git --import-alias "@/*"
```

## Directory Structure

```
src/
├── app/
│   ├── (auth)/                 # Route group (logical isolation, no URL impact)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Persistent dashboard layout
│   │   ├── page.tsx
│   │   └── analytics/page.tsx
│   ├── api/                    # Route Handlers
│   │   └── webhooks/route.ts
│   ├── layout.tsx              # Root layout (html, body, providers)
│   ├── page.tsx                # Landing page
│   ├── loading.tsx             # Instant loading UI with React Suspense
│   ├── error.tsx               # Client error boundary ('use client')
│   ├── not-found.tsx           # Custom 404 handler
│   └── global.css
├── components/                 # UI components
├── actions/                    # Server Actions ('use server')
├── lib/                        # Singletons, DB clients, utilities
└── middleware.ts               # Edge request interceptor
```

## Core Architectural Invariants

### 1. Server vs. Client Component Boundary

* **Default to Server Components (RSC)**: Do not add `'use client'` unless the component requires browser APIs, state (`useState`, `useReducer`), lifecycle effects (`useEffect`), or interactive DOM listeners (`onClick`, `onChange`).
* **Keep Client Leaves Small**: Push `'use client'` to the leaf components (e.g. `<FavoriteButton />` rather than making the entire `<ProductPage />` a client component).
* **Composition Pattern**: Pass Server Components as `children` into Client Component providers or layout wrappers to preserve server-side rendering for descendants.

### 2. Server Actions & Form Mutations

Always define Server Actions with strict input validation and authorization checks:

```typescript
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(100),
  priority: z.enum(['low', 'medium', 'high']),
});

export type ActionState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function createTaskAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Validate inputs
  const parsed = CreateTaskSchema.safeParse({
    title: formData.get('title'),
    priority: formData.get('priority'),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // 2. Perform database mutation
  // await db.task.create({ data: parsed.data });

  // 3. Revalidate path cache
  revalidatePath('/dashboard');

  return { success: true, message: 'Task created successfully' };
}
```

### 3. Route Handlers (`app/api/.../route.ts`)

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  return NextResponse.json({ data: [], query }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ status: 'created', body }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }
}
```

### 4. Dynamic Segments & Next.js 15 Promise Handling

In Next.js 15+, `params` and `searchParams` in `page.tsx` and `layout.tsx` are asynchronous:

```typescript
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  return <div>Project: {id}</div>;
}
```

### 5. Caching and Revalidation

* **`revalidatePath(path)`**: Busts the route cache on data updates.
* **`revalidateTag(tag)`**: Purges fine-grained cache tags across multiple endpoints.
* **`unstable_cache`**: Use for expensive database queries inside Server Components.
