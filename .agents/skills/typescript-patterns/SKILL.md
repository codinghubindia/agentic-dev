---
name: typescript-patterns
description: TypeScript best practices — strict mode, utility types, discriminated unions, generics, type guards, Zod runtime validation, avoiding type assertions, and proper typing for async functions and error handling.
refreshMode: sections
lastResearched: 2026-09-28
refreshableSections:
  - "Utility types"
  - "New TypeScript features"
protectedSections:
  - "Strict mode"
  - "Type guards"
---

# TypeScript Patterns Skill

Best practices for writing type-safe, maintainable TypeScript across frontend and backend.

---

## 1. Always Enable Strict Mode

```json
{
  "compilerOptions": {
    "strict": true,                        // enables all strict checks
    "noUncheckedIndexedAccess": true,      // array[0] is T | undefined
    "exactOptionalPropertyTypes": true,    // distinguish missing vs undefined
    "noImplicitReturns": true,             // all code paths must return
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## 2. Prefer Unknown Over Any

```typescript
// NEVER — loses all type safety
function parse(data: any) { return data.user.name; }

// BETTER — forces you to narrow before use
function parse(data: unknown): string {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid data');
  if (!('user' in data)) throw new Error('Missing user');
  const { user } = data as { user: unknown };
  if (typeof user !== 'object' || user === null || !('name' in user)) throw new Error('Invalid user');
  return String((user as { name: unknown }).name);
}

// BEST — use Zod for runtime validation + type inference
import { z } from 'zod';
const UserSchema = z.object({ user: z.object({ name: z.string() }) });
function parse(data: unknown) {
  return UserSchema.parse(data).user.name;   // throws on invalid, returns typed result
}
```

---

## 3. Discriminated Unions for State Machines

```typescript
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// TypeScript narrows correctly in each branch:
function render<T>(state: RequestState<T>) {
  switch (state.status) {
    case 'idle':    return <EmptyState />;
    case 'loading': return <Spinner />;
    case 'success': return <DataView data={state.data} />;  // data is T here
    case 'error':   return <ErrorView error={state.error} />; // error is Error here
  }
}
```

---

## 4. Generic Functions

```typescript
// Typed async function with error handling
async function fetchResource<T>(url: string, schema: z.ZodSchema<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return schema.parse(data);  // validates and types the response
}

// Repository interface with generics
interface Repository<T, CreateDto, UpdateDto = Partial<CreateDto>> {
  findById(id: string): Promise<T | null>;
  findAll(options?: FindAllOptions): Promise<{ data: T[]; total: number }>;
  create(dto: CreateDto): Promise<T>;
  update(id: string, dto: UpdateDto): Promise<T>;
  delete(id: string): Promise<void>;
}
```

---

## 5. Utility Types

```typescript
// Use built-in utility types instead of manual duplication
type UserDto = Omit<User, 'password' | 'refreshToken'>;  // never expose secrets
type CreateUserInput = Pick<User, 'email' | 'name'>;
type UpdateUserInput = Partial<CreateUserInput>;
type UserWithOrders = User & { orders: Order[] };

// Readonly for immutable data
type Config = Readonly<{ apiUrl: string; timeout: number }>;

// Record for typed maps
type RolePermissions = Record<UserRole, Permission[]>;
```

---

## 6. Type Guards

```typescript
// User-defined type guard
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

// Usage:
try {
  await api.createUser(data);
} catch (error) {
  if (isApiError(error)) {
    console.error(error.code, error.message);  // typed access
  } else {
    throw error;
  }
}
```

---

## 7. Zod — Schema + Type Inference

```typescript
import { z } from 'zod';

// Define schema once, infer TypeScript type from it
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(['admin', 'user', 'moderator']).default('user'),
  birthDate: z.string().datetime().optional(),
});

// TypeScript type is derived from the schema — no duplication
type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Use for request validation:
const input = CreateUserSchema.parse(req.body);  // throws ZodError on invalid
// or:
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  const errors = result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
  return res.status(400).json({ error: 'Validation failed', details: errors });
}
```

---

## 8. Async Error Types

```typescript
// Typed custom errors
class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, `${resource} with id ${id} not found`);
  }
}

// Usage:
const user = await userRepo.findById(id);
if (!user) throw new NotFoundError('User', id);
```

---

## 9. Avoid Type Assertions

```typescript
// BAD — silences the type checker without actually verifying
const user = response as User;

// GOOD — narrow with runtime check
const user = UserSchema.parse(response);  // runtime validated + typed

// ACCEPTABLE — when you know better than TS and the cast is safe
const input = document.getElementById('email') as HTMLInputElement;
// (only when working with DOM APIs where TS can't infer the element type)
```
