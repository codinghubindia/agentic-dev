---
name: react-patterns
description: Advanced React patterns — compound components, render props, custom hooks design, context optimization, performance memoization, portal usage, and avoiding common pitfalls like stale closures and infinite re-renders.
refreshMode: full
lastResearched: 2024-01-01
---

# React Patterns Skill

Advanced patterns for writing maintainable, performant React applications.

---

## 1. Custom Hook Design

Custom hooks must:
- Start with `use` prefix
- Have a single, clear purpose
- Return a stable object (memoize if needed)
- Handle cleanup in `useEffect` return

```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);   // cleanup on every change
  }, [value, delay]);

  return debouncedValue;
}
```

---

## 2. Compound Components Pattern

For complex components with shared state (Tabs, Accordion, Select):

```typescript
// Context for shared state
const TabsContext = React.createContext<{ active: string; setActive: (id: string) => void } | null>(null);

function Tabs({ children, defaultTab }: { children: React.ReactNode; defaultTab: string }) {
  const [active, setActive] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div role="tablist">{children}</div>
    </TabsContext.Provider>
  );
}

function TabTrigger({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  return (
    <button
      role="tab"
      aria-selected={ctx.active === id}
      onClick={() => ctx.setActive(id)}
    >
      {children}
    </button>
  );
}

Tabs.Trigger = TabTrigger;
Tabs.Panel = TabPanel;

// Usage:
<Tabs defaultTab="profile">
  <Tabs.Trigger id="profile">Profile</Tabs.Trigger>
  <Tabs.Trigger id="settings">Settings</Tabs.Trigger>
  <Tabs.Panel id="profile"><ProfileForm /></Tabs.Panel>
</Tabs>
```

---

## 3. Avoiding Stale Closures

```typescript
// Problem: stale closure captures old count
useEffect(() => {
  const timer = setInterval(() => {
    setCount(count + 1);  // always uses the initial count value!
  }, 1000);
  return () => clearInterval(timer);
}, []); // missing count dependency

// Solution 1: use functional updater
setCount(prev => prev + 1);  // always uses the latest value

// Solution 2: useRef for the latest callback
const callbackRef = useRef(callback);
useEffect(() => { callbackRef.current = callback; });
useEffect(() => {
  const timer = setInterval(() => callbackRef.current(), delay);
  return () => clearInterval(timer);
}, [delay]);
```

---

## 4. Performance — When to Memoize

```typescript
// React.memo: prevent re-render when props haven't changed
// Use when: component is expensive to render AND parent re-renders frequently
const ExpensiveList = React.memo(({ items }: { items: Item[] }) => (
  <ul>{items.map(i => <ListItem key={i.id} item={i} />)}</ul>
));

// useMemo: memoize expensive calculations
// Use when: computation is actually expensive (> 1ms)
const sortedItems = useMemo(
  () => [...items].sort((a, b) => b.score - a.score),
  [items]
);

// useCallback: memoize callback functions passed to memoized children
const handleDelete = useCallback((id: string) => {
  setItems(prev => prev.filter(i => i.id !== id));
}, []); // no dependencies → stable reference
```

**Rule**: Profile first with React DevTools — don't memoize prematurely.

---

## 5. Portals for Modals & Tooltips

```typescript
// Always render modals at document.body to avoid z-index/overflow issues
import { createPortal } from 'react-dom';

function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal}>
        {children}
      </div>
    </div>,
    document.body
  );
}
```

---

## 6. Infinite Re-render Prevention

Common causes:
1. **Object/array in dependency array**: `useEffect(() => {}, [{ key: 'value' }])` — creates a new object every render
   - Fix: use `useMemo` for the object, or `useDeepCompareEffect`
2. **setState called unconditionally in effect**: causes render → effect → setState → render loop
   - Fix: add a condition before setState
3. **Missing or wrong dependencies**: stale data or infinite loops
   - Fix: use the `eslint-plugin-react-hooks/exhaustive-deps` rule — always

---

## 7. Context Optimization

```typescript
// Split contexts to prevent unnecessary re-renders
// BAD: one large context — all consumers re-render when any value changes
const AppContext = createContext({ user, theme, cart, notifications });

// GOOD: separate contexts by update frequency
const UserContext = createContext<User | null>(null);   // rare updates
const CartContext = createContext<Cart>(emptyCart);      // frequent updates
const ThemeContext = createContext<Theme>('light');      // very rare
```
