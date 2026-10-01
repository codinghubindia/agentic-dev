---
name: react
description: React 18+ hooks, concurrent features, performance patterns, and component architecture for production UIs.
category: frontend
packages: [react, react-dom]
workerRoles: [strike-worker-frontend]
microTasks: [F1, F2, F3]
currentVersion: 18.3.1
lastResearched: 2026-10-01
refreshIntervalDays: 90
status: stable
---

> [!NOTE]
> **Skill Freshness**: `lastResearched` is managed by the skill synthesizer. Do not manually bump it.

# ⚛️ React 18 — Production Patterns

## 0. Install
```bash
# Pre-install deprecation check
npm view react deprecated 2>/dev/null | grep -i deprecated
# Install
npm install react react-dom
npm install -D @types/react @types/react-dom
```

---

## 1. Hook Architecture — What Goes Where

| Hook | Use for | NEVER use for |
|---|---|---|
| `useState` | Local UI state (open/closed, input value) | Derived data — compute instead |
| `useReducer` | Multi-field form state, step machines | Simple toggles — useState is enough |
| `useEffect` | Sync with external system (DOM, WebSocket) | Fetching data — use react-query |
| `useMemo` | Expensive computation (>1ms) | Primitive values, cheap operations |
| `useCallback` | Stable refs passed to memoized children | Functions not passed as props |
| `useContext` | Infrequently-changing global state | High-frequency updates (use Zustand) |
| `useTransition` | Non-urgent state updates (search filter) | Urgent UI feedback |
| `useDeferredValue` | Defer re-rendering an expensive child | Anything requiring immediate feedback |

---

## 2. Custom Hook Pattern (Canonical)

```tsx
// Extract logic from components into reusable hooks
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    localStorage.setItem(key, JSON.stringify(valueToStore));
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}
```

---

## 3. Concurrent React — useTransition

```tsx
// Mark non-urgent updates so urgent ones (typing) aren't blocked
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value); // urgent — updates input immediately
    startTransition(() => {
      // non-urgent — React can defer this if needed
      setResults(expensiveFilter(e.target.value));
    });
  }

  return (
    <>
      <input value={query} onChange={handleSearch} />
      {isPending ? <Skeleton /> : <ResultsList items={results} />}
    </>
  );
}
```

---

## 4. Performance — Memoization Rules

```tsx
// ✅ DO: memoize expensive child that receives stable props
const HeavyChart = React.memo(({ data }: { data: ChartData[] }) => {
  return <canvas>{/* expensive render */}</canvas>;
});

// ✅ DO: stable callback reference for memoized child
function Parent() {
  const handleClick = useCallback((id: string) => {
    // ...
  }, []); // empty deps = stable forever
  return <HeavyChart onSelect={handleClick} />;
}

// ❌ DON'T: memoize everything — adds overhead, rarely helps
// ❌ DON'T: useMemo for primitive computations (string concat, simple filter)
// Rule: profile first (React DevTools Profiler), memoize second
```

---

## 5. Code Splitting with React.lazy

```tsx
import { lazy, Suspense } from 'react';

// Route-level code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

---

## 6. Error Boundaries

```tsx
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('Boundary caught:', error); }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// Usage:
<ErrorBoundary fallback={<ErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

---

## 7. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `useEffect` for data fetching | Use react-query / SWR |
| Storing derived state in useState | Compute during render |
| Index as list key (`key={i}`) | Use stable unique ID (`key={item.id}`) |
| `useEffect` with no cleanup on subscriptions | Return cleanup function |
| Mutating state directly (`state.push(x)`) | `setState([...state, x])` |
| Nested ternaries in JSX | Extract to named component |
