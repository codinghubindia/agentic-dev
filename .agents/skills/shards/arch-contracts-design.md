# Micro-Skill: Executable Code Contracts & Schema Design

**Scope**: Contract-first development, shared Zod schemas, TypeScript types, and API contracts.

## Rules & Checklists
1. **Contract-First Scaffolding**:
   - Define executable contracts (`contracts.ts` / OpenAPI / Prisma) BEFORE implementing backend or frontend slices.
   - Infer TypeScript types directly from runtime validation schemas: `export type User = z.infer<typeof UserSchema>;`.
2. **Contract Immutability (Freezing)**:
   - Once a vertical slice is approved and active, contracts are frozen.
   - Any proposed contract change requires explicit approval before modifying downstream code.
3. **Discriminated Unions for Polymorphism**:
   - Use explicit discriminator fields (e.g. `type: 'success' | 'error'`) on variant types.
   - Avoid ambiguous optional property bags.
4. **Zero `any` Types**:
   - Use `unknown` with type guards or Zod parsers instead of `any`.
   - Ensure all API inputs and outputs have strict compile-time and runtime representations.
5. **Backwards Compatibility**:
   - Add new optional fields with defaults; never delete or rename existing contract fields without versioning.
