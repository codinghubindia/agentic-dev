# Backend Sub-Role: Domain Business Logic & Workflows

Consolidated from `business-logic-worker`.

## Responsibilities & Standards
- Implement core domain logic, service layers, calculations, multi-step workflows, and state transitions.
- Keep domain logic completely isolated from transport layers (Express/Fastify) and raw database drivers.

## Business Logic Checklist
- [ ] Service Layer Pattern: Pure TypeScript classes/functions implementing business workflows (`UserService`, `OrderProcessingService`).
- [ ] Transaction Boundaries: Multi-record mutations wrapped in explicit database transactions with rollback on failure.
- [ ] Domain Validations: Validate invariants (e.g. "inventory cannot drop below zero", "cannot refund an already refunded order").
- [ ] Event Dispatching: Asynchronous events (e.g. sending welcome emails, webhook triggers) published after transaction commit via event emitter or message queue.
- [ ] Deterministic & Testable: Business services accept dependencies (repositories, external clients) via dependency injection for frictionless unit testing.
