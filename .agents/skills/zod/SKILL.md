---
name: zod
description: Zod v3 schema validation — composition, transforms, refinements, discriminated unions, and React Hook Form integration.
category: shared
packages: [zod]
workerRoles: [strike-worker-backend, strike-worker-frontend]
microTasks: [B2, B3, F2]
currentVersion: 3.23.8
lastResearched: 2026-10-01
refreshIntervalDays: 90
status: stable
---

> [!NOTE]
> **Skill Freshness**: Managed by skill synthesizer. Do not manually bump lastResearched.

# 🛡️ Zod v3 — Schema Validation

## 0. Install
```bash
npm view zod deprecated 2>/dev/null | grep -i deprecated
npm install zod
```

---

## 1. Core Schema Patterns

```typescript
import { z } from 'zod';

// Primitive schemas
const emailSchema = z.string().email('Invalid email format');
const passwordSchema = z.string().min(8).max(64);
const ageSchema = z.number().int().min(0).max(120);
const roleSchema = z.enum(['user', 'admin', 'moderator']).default('user');

// Object schema with TypeScript inference
export const CreateUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2).max(100).trim(),
  role: roleSchema,
  birthYear: z.number().int().min(1900).max(2010).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
// TypeScript type is automatically derived — no duplication
```

---

## 2. Schema Composition

```typescript
// Base schema — extend for variations
const BaseProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
});

// Extend for create vs update
export const CreateProductSchema = BaseProductSchema;
export const UpdateProductSchema = BaseProductSchema.partial(); // all fields optional
export const ProductResponseSchema = BaseProductSchema.extend({
  id: z.string().uuid(),
  createdAt: z.coerce.date(), // coerce: converts string to Date automatically
});

// Pick / Omit
const PublicUserSchema = CreateUserSchema.omit({ password: true });
const LoginSchema = CreateUserSchema.pick({ email: true, password: true });
```

---

## 3. Transform Pipeline

```typescript
// Transform input values during validation
const SlugSchema = z
  .string()
  .min(1)
  .transform(s => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));

const DateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
}).refine(d => d.end > d.start, {
  message: 'End date must be after start date',
  path: ['end'], // which field to attach the error to
});
```

---

## 4. Discriminated Unions

```typescript
// For payloads with different shapes based on a type field
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), to: z.string().email(), subject: z.string() }),
  z.object({ type: z.literal('sms'), phone: z.string(), message: z.string() }),
  z.object({ type: z.literal('push'), deviceId: z.string(), title: z.string() }),
]);
```

---

## 5. Safe Parse Pattern (for all request validation)

```typescript
// safeParse never throws — returns success/error discriminated union
app.post('/users', async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      type: 'https://api.example.com/errors/validation',
      title: 'Validation Error',
      status: 400,
      errors: result.error.flatten().fieldErrors, // clean field-level errors
    });
  }
  // result.data is fully typed and validated
  const user = await userService.create(result.data);
  return res.status(201).json(user);
});

// Middleware factory for reuse
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.flatten().fieldErrors });
    req.body = result.data;
    next();
  };
}
```

---

## 6. Anti-Patterns Blacklist

| Anti-Pattern | Fix |
|---|---|
| `schema.parse()` in request handlers | Use `safeParse()` — parse throws, breaks middleware flow |
| Re-defining TypeScript types manually | Use `z.infer<typeof Schema>` |
| Defining schemas inside components/handlers | Define at module level — stable reference |
| Using `z.any()` | Define the actual shape — `any` defeats the purpose |
