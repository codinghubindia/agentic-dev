---
name: react-patterns
description: Advanced React patterns including React Server Components, Suspense with the use API, Actions and Optimistic UI, custom hook design with useEffectEvent, compound components, and performance optimization.
lastResearched: 2026-09-28
refreshMode: sections
refreshableSections:
  - "Key Patterns"
  - "Common Pitfalls"
  - "Quick Reference"
protectedSections:
  - "Overview"
sources:
  - https://react.dev/reference/react
  - https://react.dev/reference/rsc/server-components
  - https://react.dev/reference/react/use
  - https://react.dev/reference/react/useActionState
  - https://react.dev/reference/react/useOptimistic
  - https://react.dev/learn/reusing-logic-with-custom-hooks
  - https://react.dev/learn/separating-events-from-effects
---

# React Patterns

## Overview
Comprehensive engineering guide covering modern React design patterns across the client-server boundary. Focuses on React Server Components (RSC), Suspense with the `use` API, form Actions (`useActionState`, `useFormStatus`, `useOptimistic`), decoupled custom hooks with `useEffectEvent`, compound components, and zero-waste context optimization.

## Key Patterns

### Pattern 1: React Server Components (RSC) & Server Functions Boundary
Server Components execute exclusively on the server (or at build time), keeping heavy dependencies out of the client bundle while directly querying data sources. Interactive logic is isolated behind `'use client'` boundaries placed at leaf components, while mutations use Server Functions (`'use server'`).

```typescript
// app/actions/updateProfile.ts
'use server';

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateProfile(
  previousState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = formData.get('name') as string;
  const bio = formData.get('bio') as string;

  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Name is required' };
  }

  // Direct backend/database mutation without exposing client API endpoints
  await db.user.update({
    where: { id: 'current-user-id' },
    data: { name, bio },
  });

  return { success: true };
}
```

```typescript
// components/EditProfileModal.tsx
'use client';

import React, { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProfile } from '../actions/updateProfile';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Saving...' : 'Save Profile'}
    </button>
  );
}

export function EditProfileModal({
  initialName,
  initialBio,
  children,
}: {
  initialName: string;
  initialBio: string;
  children?: React.ReactNode; // Server components can be passed via children
}) {
  const [state, formAction] = useActionState(updateProfile, null);

  return (
    <div className="modal-container">
      <form action={formAction} className="form-layout">
        {state?.error && <p className="form-error">{state.error}</p>}
        {state?.success && <p className="form-success">Saved successfully!</p>}
        <label>
          Name:
          <input type="text" name="name" defaultValue={initialName} required />
        </label>
        <label>
          Bio:
          <textarea name="bio" defaultValue={initialBio} />
        </label>
        <SubmitButton />
      </form>
      {/* Retains server-side execution for nested children */}
      {children}
    </div>
  );
}
```

```typescript
// app/profile/page.tsx (Server Component by default)
import { EditProfileModal } from '../../components/EditProfileModal';
import { UserActivityHistory } from '../../components/UserActivityHistory'; // Server Component

export default async function ProfilePage() {
  const user = await db.user.findUnique({ where: { id: 'current-user-id' } });

  return (
    <main>
      <h1>Profile Settings</h1>
      {/* Passing Server Component into Client Component preserves zero-bundle cost */}
      <EditProfileModal initialName={user.name} initialBio={user.bio}>
        <UserActivityHistory userId={user.id} />
      </EditProfileModal>
    </main>
  );
}
```

---

### Pattern 2: Modern Suspense & the `use` API for Async Resources
The `use` API reads the value of a Promise or Context synchronously during render. When passed a pending Promise, React suspends the component, rendering the nearest `<Suspense>` fallback until resolution. Unlike traditional hooks, `use` can be called conditionally inside `if` statements and loops.

```typescript
import React, { Suspense, use } from 'react';

interface UserData {
  id: string;
  name: string;
  email: string;
}

// 1. Component reading a cached promise with use()
function UserProfile({ userPromise }: { userPromise: Promise<UserData> }) {
  // Suspends component until userPromise settles; rejections trigger Error Boundary
  const user = use(userPromise);

  return (
    <div className="profile-card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 2. Reading Context conditionally using use()
const ThemeContext = React.createContext<'light' | 'dark'>('light');

function ThemedBanner({ showTheme }: { showTheme: boolean }) {
  if (showTheme) {
    // Permissible with use() but illegal with useContext()
    const theme = use(ThemeContext);
    return <div className={`banner banner-${theme}`}>Theme: {theme}</div>;
  }
  return <div className="banner">Default Banner</div>;
}

// 3. Parent container managing the Suspense boundary
export function UserPage({ userPromise }: { userPromise: Promise<UserData> }) {
  return (
    <section>
      <ThemedBanner showTheme={true} />
      <Suspense fallback={<div className="skeleton-card">Loading profile...</div>}>
        <UserProfile userPromise={userPromise} />
      </Suspense>
    </section>
  );
}
```

> [!IMPORTANT]
> The Promise passed to `use(promise)` MUST be cached (e.g., via React `cache()`, TanStack Query, or initiated outside render). Creating a new promise inside a component during render causes an infinite suspension loop.

---

### Pattern 3: React 19 Actions: `useActionState` and `useOptimistic`
Manage asynchronous form submissions and instantaneous UI feedback without boilerplate state flags (`isLoading`, `isSubmitting`, `error`). `useActionState` manages server responses, while `useOptimistic` temporarily displays predicted mutations until the action completes.

```typescript
'use client';

import React, { useActionState, useOptimistic, useRef } from 'react';

interface Todo {
  id: string;
  title: string;
  isPending?: boolean;
}

interface ActionState {
  todos: Todo[];
  error: string | null;
}

async function addTodoAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const title = formData.get('title') as string;
  try {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Failed to create todo item.');
    const createdTodo: Todo = await res.json();
    return { todos: [...prevState.todos, createdTodo], error: null };
  } catch (err) {
    return { ...prevState, error: (err as Error).message };
  }
}

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [state, formAction] = useActionState(addTodoAction, {
    todos: initialTodos,
    error: null,
  });

  const formRef = useRef<HTMLFormElement>(null);

  // Optimistic state updates before network round-trip completes
  const [optimisticTodos, setOptimisticTodos] = useOptimistic(
    state.todos,
    (currentTodos, newTitle: string) => [
      ...currentTodos,
      { id: `temp-${Date.now()}`, title: newTitle, isPending: true },
    ]
  );

  async function handleFormSubmit(formData: FormData) {
    const title = formData.get('title') as string;
    formRef.current?.reset();
    setOptimisticTodos(title); // Instant visual feedback
    await formAction(formData); // Execute real server action
  }

  return (
    <div>
      <form ref={formRef} action={handleFormSubmit}>
        <input type="text" name="title" placeholder="Add task..." required />
        <button type="submit">Add</button>
      </form>

      {state.error && <p className="error-banner">{state.error}</p>}

      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} style={{ opacity: todo.isPending ? 0.6 : 1 }}>
            {todo.title} {todo.isPending && '(saving...)'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### Pattern 4: Custom Hook Design & Composition (`useEffectEvent`)
Custom hooks must encapsulate single concerns, return stable references, and clean up subscriptions properly. To prevent stale closures and unwanted effect re-synchronization, use `useEffectEvent` to read the latest state and callbacks inside an effect without declaring them in the dependency array.

```typescript
import { useState, useEffect, useEffectEvent } from 'react';

interface AutoSaveOptions<T> {
  data: T;
  intervalMs?: number;
  onSave: (data: T) => Promise<void> | void;
  onError?: (err: Error) => void;
}

export function useAutoSave<T>({
  data,
  intervalMs = 3000,
  onSave,
  onError,
}: AutoSaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // useEffectEvent captures the latest 'data', 'onSave', and 'onError' without
  // forcing the setInterval effect to reset whenever data changes
  const saveEvent = useEffectEvent(async () => {
    try {
      setIsSaving(true);
      await onSave(data);
      setLastSavedAt(new Date());
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSaving(false);
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      saveEvent();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]); // Stable interval: only restarts if intervalMs changes

  return { isSaving, lastSavedAt };
}
```

---

### Pattern 5: Compound Components Pattern with Type-Safe Context
Compound components share implicit state while granting complete layout and styling flexibility to the consumer. Always guard custom context hooks against being rendered outside their root provider.

```typescript
import React, { createContext, useContext, useState, useId } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error('Tabs sub-components must be wrapped within a <Tabs> container.');
  }
  return ctx;
}

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Tabs({ defaultValue, value, onValueChange, children }: TabsProps) {
  const [uncontrolledTab, setUncontrolledTab] = useState(defaultValue);
  const baseId = useId();

  const activeTab = value !== undefined ? value : uncontrolledTab;
  const setActiveTab = (newTab: string) => {
    if (value === undefined) setUncontrolledTab(newTab);
    onValueChange?.(newTab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className="tabs-root">{children}</div>
    </TabsContext.Provider>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div role="tablist" className="tabs-list">
      {children}
    </div>
  );
}

function Trigger({ value, children }: { value: string; children: React.ReactNode }) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const isSelected = activeTab === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <button
      role="tab"
      id={tabId}
      aria-controls={panelId}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => setActiveTab(value)}
      className={`tab-trigger ${isSelected ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

function Panel({ value, children }: { value: string; children: React.ReactNode }) {
  const { activeTab, baseId } = useTabsContext();
  const isSelected = activeTab === value;
  const tabId = `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      className="tab-panel"
    >
      {children}
    </div>
  );
}

Tabs.List = List;
Tabs.Trigger = Trigger;
Tabs.Panel = Panel;
```

---

### Pattern 6: Context Optimization & Concurrent Transitions
Broad context trees cause mass re-renders across all consumer components whenever any single property updates. Split contexts by update frequency and separate data from dispatchers. For non-blocking UI rendering, use `useTransition` and `useDeferredValue`.

```typescript
import React, { createContext, useContext, useState, useTransition, useDeferredValue } from 'react';

// 1. Context Splitting: Isolate rapid state updates from static dispatchers
interface CartItem {
  id: string;
  name: string;
  price: number;
}

const CartStateContext = createContext<CartItem[] | null>(null);
const CartDispatchContext = createContext<React.Dispatch<React.SetStateAction<CartItem[]>> | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  return (
    <CartStateContext.Provider value={cart}>
      <CartDispatchContext.Provider value={setCart}>
        {children}
      </CartDispatchContext.Provider>
    </CartStateContext.Provider>
  );
}

// 2. Non-blocking UI filtering using useDeferredValue and useTransition
export function FilterableCatalog({ items }: { items: string[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const deferredFilter = useDeferredValue(searchTerm);

  const filteredItems = items.filter((item) =>
    item.toLowerCase().includes(deferredFilter.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Immediate, high-priority update for input responsiveness
    setSearchTerm(e.target.value);
  };

  return (
    <div>
      <input
        type="search"
        value={searchTerm}
        onChange={handleSearchChange}
        placeholder="Filter items..."
      />
      {isPending && <span className="loading-badge">Updating list...</span>}
      <ul>
        {filteredItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Common Pitfalls

- **Recreating Promises inside component body with `use(promise)`**:
  - *Pitfall*: Calling `const data = use(fetchData())` creates a new promise every render, causing an infinite loop of component suspension.
  - *Fix*: Cache the promise with React `cache()`, TanStack Query, or initialize the promise in a parent Server Component and pass it as a prop.

- **Placing `'use client'` too high in the component tree**:
  - *Pitfall*: Marking layouts or root pages with `'use client'` pulls all descendant components and their external libraries into the client bundle.
  - *Fix*: Keep Server Components as the default. Push `'use client'` down to the smallest interactive leaf nodes, and pass Server Components through Client Components via `children`.

- **Stale Closures in async callbacks and timers**:
  - *Pitfall*: Accessing state directly inside `setInterval`, `setTimeout`, or asynchronous callbacks with empty dependency arrays freezes initial values.
  - *Fix*: Use functional updater syntax (`setCount(prev => prev + 1)`) or extract non-reactive callback logic with `useEffectEvent`.

- **Invoking `useFormStatus` inside the same component rendering `<form>`**:
  - *Pitfall*: Calling `const { pending } = useFormStatus()` inside the component that declares `<form>` returns `pending: false` because `useFormStatus` only inspects parent ancestor forms.
  - *Fix*: Extract the submit button or pending indicator into a dedicated child component nested inside the `<form>`.

- **Monolithic Context Trees causing full-app re-renders**:
  - *Pitfall*: Storing user auth, UI theme, notification counters, and shopping cart in a single `AppContext` triggers re-renders across the entire app whenever the notification counter increments.
  - *Fix*: Split contexts by rate of change and domain (e.g., `UserContext`, `ThemeContext`, `CartContext`), and separate read-only state from update dispatchers.

- **Inline object/array references in dependency arrays**:
  - *Pitfall*: Passing inline objects `useEffect(() => {}, [{ id }])` causes the effect to run on every render due to referential inequality.
  - *Fix*: Hoist static objects outside component scope, memoize with `useMemo`, or pass primitive dependencies (`id` instead of `{ id }`).

---

## Quick Reference

| Pattern / API | Purpose | Execution Context | Key Guidance |
|---|---|---|---|
| **Server Components (RSC)** | Data fetching, zero bundle size | Server / Build-time only | Default in modern frameworks; no hooks or browser APIs allowed. |
| **`'use client'`** | Interactivity, client state, effects | Client & Server (SSR) | Place at interactive leaf nodes only; compose with Server Components via `children`. |
| **`'use server'`** | Server mutations & actions | Server only | Exported from dedicated action files or declared inside Server Components. |
| **`use(promise)`** | Async resource unwrapping | Component render | Suspends on pending; must receive a cached or hoisted promise. |
| **`use(context)`** | Conditional context consumption | Component render | Can be called conditionally inside `if` blocks and loops. |
| **`useActionState`** | Form action & pending state | Client Components | Returns `[state, formAction, isPending]`; replaces manual submission flags. |
| **`useOptimistic`** | Instant UI feedback | Client Components | Shows temporary predicted state during action execution; auto-rolls back on error. |
| **`useFormStatus`** | Ancestor form submission status | Child of `<form>` | Returns `{ pending, data, method, action }` for submit buttons and loaders. |
| **`useEffectEvent`** | Non-reactive logic in effects | Inside `useEffect` | Reads latest state/props without adding dependencies or re-triggering effects. |
| **Compound Components** | Flexible, composable UI widgets | Client Components | Share state via Context; throw error if child is rendered without parent provider. |
| **`useTransition`** | Non-blocking state updates | Client Components | Keeps UI responsive during heavy renders without freezing input fields. |
| **`useDeferredValue`** | Deferred low-priority values | Client Components | Postpones re-rendering heavy derived lists until immediate inputs finish rendering. |

---

## Resources

- [React Documentation - React Reference](https://react.dev/reference/react) — Official reference for core React APIs, Hooks, and components.
- [React Documentation - Server Components](https://react.dev/reference/rsc/server-components) — Architecture, boundary rules, and streaming patterns for React Server Components.
- [React Documentation - use API](https://react.dev/reference/react/use) — Official guide on consuming promises and contexts with the `use` API.
- [React Documentation - useActionState](https://react.dev/reference/react/useActionState) — Managing form mutation results and pending state.
- [React Documentation - useOptimistic](https://react.dev/reference/react/useOptimistic) — Implementation guidelines for optimistic UI patterns.
- [React Documentation - Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) — Best practices for designing and composing custom hooks.
- [React Documentation - Separating Events from Effects](https://react.dev/learn/separating-events-from-effects) — Deep dive on reactive vs non-reactive logic and `useEffectEvent`.
