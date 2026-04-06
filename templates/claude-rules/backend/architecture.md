---
paths: apps/api/**
standard_type: aspirational
---

# Spring Modulith + DDD Architecture

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/backend/01-architecture.md`

## Module Package Layout

Every module uses **facade + internal** encapsulation:

```
{module}/
  {Module}Service.kt          # Public facade (returns DTOs only)
  {PublicDto}.kt               # Public DTOs for cross-module use
  ModuleMetadata.kt            # @ApplicationModule + @PackageInfo
  events/
    ModuleMetadata.kt          # @PackageInfo @NamedInterface("events")
    {DomainEvent}.kt           # Domain events (past-tense naming)
  internal/
    domain/
      model/                   # Entities, value objects
      repository/              # Spring Data JPA repositories
    application/               # Internal services (entity-returning)
    infrastructure/
      api/
        {Controller}.kt        # REST controllers
        dto/                   # HTTP request/response DTOs
      event/                   # @ApplicationModuleListener handlers
```

**Only types in the base package** (not `internal/`) are accessible cross-module.

## Module Boundaries

- Declare via `@ApplicationModule` + `@PackageInfo` in `ModuleMetadata.kt`
- `shared/` module is OPEN -- accessible by all modules freely
- DEFAULT modules list explicit `allowedDependencies`
- Use `"module :: events"` narrowed dependency to depend only on events sub-package

## Shared Kernel (`shared/`)

Cross-cutting infrastructure available to all modules:

```
shared/
  api/             # ApiResult, PagedApiResult, ErrorResponse
  domain/          # CreatableEntity, AuditableEntity base classes
  events/          # DomainEvent, ApplicationModuleEvent interfaces
  exception/       # ResourceNotFoundException, GlobalExceptionHandler
  config/          # Cross-cutting config (caching, JPA auditing)
  util/            # Utility functions
```

## DDD Tactical Patterns

- **Aggregate roots** extend `AggregateRoot<T>`, use `raise(event)` for domain events
- **One repository per aggregate root** (Spring Data JPA)
- Each module owns its own database tables (bounded context)

## Dependency Inversion for Cycle Avoidance

Define interfaces in `shared/`, implement in specific modules:

```kotlin
// shared/
interface TimezoneProvider {
    fun getTimezone(userId: UUID): ZoneId
}

// users/internal/ -- implements without creating a dependency from orders -> users
@Service
class UserTimezoneProvider(
    private val userRepository: UserRepository,
) : TimezoneProvider { ... }
```

## Event-Driven Communication

Prefer events over direct cross-module service calls.

```kotlin
// Events are immutable data classes, past tense
data class OrderPlacedEvent(
    val orderId: UUID,
    val customerId: UUID,
    override val occurredAt: Instant = Instant.now(),
) : ApplicationModuleEvent

// Publishing (via ApplicationEventPublisher or AggregateRoot.raise())
eventPublisher.publishEvent(OrderPlacedEvent(saved.id!!, saved.customerId))

// Consuming (runs AFTER publishing transaction commits)
@ApplicationModuleListener
fun onOrderPlaced(event: OrderPlacedEvent) { ... }
```

Event rules:
- Handlers run AFTER_COMMIT -- make them **idempotent**
- Events live in `events/` sub-package with `@NamedInterface("events")`
- Include `eventId: UUID` and `occurredAt: Instant` in payloads

## Modularity Tests

```kotlin
@Test
fun `verify module boundaries`() {
    ApplicationModules.of(Application::class.java).verify()
}
```

Enforces: no circular deps, no `internal/` access from outside, valid `allowedDependencies`.

## Key Rules

| Rule | Detail |
|------|--------|
| Cross-module communication | Events over direct imports |
| Cross-module reads | Public facade services returning DTOs only |
| Table ownership | Each module owns its own tables |
| API versioning | All endpoints prefixed `/api/v1/` |
| Never inject | Repositories from other modules |
