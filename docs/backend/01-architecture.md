# Spring Modulith Architecture

Kotlin + Spring Boot 4 + Spring Modulith 2.0 modular monolith architecture with enforced boundaries and event-driven communication.

**Why this architecture?** A modular monolith with enforced boundaries gives you the development speed of a monolith with the structural discipline of microservices. Module boundaries prevent the "big ball of mud" problem where any code can depend on anything else, making refactoring and eventual extraction to microservices straightforward.

---

## Module Package Layout

Each module follows the **facade + internal** package layout for strong encapsulation.

**Why facade + internal?** Spring Modulith enforces that only types in the base package are visible to other modules. The `internal/` sub-package hides implementation details (entities, repositories, controllers) from cross-module access. This prevents tight coupling and ensures modules communicate through well-defined facades and events.

```
{module}/
├── {Module}Service.kt          # Public facade (cross-module API, returns DTOs only)
├── {PublicDto}.kt               # Public DTOs for cross-module use
├── ModuleMetadata.kt            # @ApplicationModule + @PackageInfo (module boundary declaration)
├── events/                      # Domain events sub-package (if module publishes events)
│   ├── ModuleMetadata.kt        # @PackageInfo @NamedInterface("events")
│   └── {DomainEvent}.kt         # Domain events (public, consumed via "module :: events")
└── internal/
    ├── domain/
    │   ├── model/               # Entities, value objects
    │   ├── repository/          # Spring Data JPA repositories
    │   ├── {Module}Exception.kt # Sealed exception hierarchy (see 07-error-handling.md)
    │   └── {Action}{Resource}Command.kt  # Domain commands (see 02-api-design.md)
    ├── application/             # Internal services (entity-returning, used by controllers)
    └── infrastructure/
        ├── api/
        │   ├── {Controller}.kt  # REST controllers (use internal application services)
        │   ├── {Module}Mapper.kt        # Request/Command/Response mapper object
        │   ├── {Module}ExceptionHandler.kt  # @RestControllerAdvice @Order(1)
        │   └── dto/             # HTTP request/response DTOs
        └── event/               # Event handlers (@ApplicationModuleListener)
```

**Key rule**: Only types in the base package (`com.example.app.{module}`) are accessible to other modules. Everything under `internal/` is encapsulated.

---

## Module Boundaries

Spring Modulith enforces bounded context separation via `@ApplicationModule` + `@PackageInfo` in `ModuleMetadata.kt`:

| Module | Type | Allowed Dependencies | Responsibility |
|--------|------|---------------------|----------------|
| `shared` | OPEN | (none -- accessible by all) | Cross-cutting infrastructure, DIP interfaces |
| `users` | DEFAULT | shared | Authentication, profiles, preferences |
| `orders` | DEFAULT | shared, inventory :: events | Order management, checkout |
| `inventory` | DEFAULT | shared | Product catalog, stock management |
| `notifications` | DEFAULT | shared, orders :: events | Alerts, email, push notifications |

**Narrowed dependencies**: Use `"module :: events"` syntax to depend only on a module's event sub-package, not its full API. This keeps coupling minimal.

---

## Shared Kernel

The `shared/` module is the shared kernel -- all modules may depend on it freely:

```
shared/
├── api/             # ApiResult, PagedApiResult, shared DTOs
├── domain/          # CreatableEntity, AuditableEntity base classes
├── events/          # DomainEvent, ApplicationModuleEvent interfaces
├── exception/       # GlobalExceptionHandler (@Order(100) fallback)
├── config/          # Cross-cutting config (caching, JPA auditing)
├── service/         # Shared services
└── util/            # Utility functions
```

---

## DDD Tactical Patterns

### Aggregates and Aggregate Roots

- **Aggregates**: Entities with identity, accessed only through the aggregate root
- **Aggregate roots** extend `AggregateRoot<T>` and use `raise(event)` to publish domain events
- **Repositories**: One Spring Data JPA repository per aggregate root

### Bounded Contexts

Each module represents a bounded context with its own:
- Domain model (entities, value objects)
- Persistence (owns its own database tables)
- API surface (controllers, DTOs)

---

## Dependency Inversion for Cycle Avoidance

When modules would create circular dependencies, define interfaces in `shared/` and implement in specific modules:

```kotlin
// shared/
interface TimezoneProvider {
    fun getTimezone(userId: UUID): ZoneId
}

// users/internal/
@Service
class UserTimezoneProvider(
    private val userRepository: UserRepository,
) : TimezoneProvider {
    override fun getTimezone(userId: UUID): ZoneId =
        userRepository.findById(userId)
            .map { it.timezone }
            .orElse(ZoneId.of("UTC"))
}

// orders/ can inject TimezoneProvider without depending on users/
@Service
class OrderService(
    private val timezoneProvider: TimezoneProvider,
) { ... }
```

---

## Event-Driven Communication

Modules communicate via events, not direct service calls across boundaries.

### DomainEvent Interface

```kotlin
// shared/events/DomainEvent.kt
interface DomainEvent {
    val occurredAt: Instant
        get() = Instant.now()
}

// shared/events/ApplicationModuleEvent.kt
interface ApplicationModuleEvent : DomainEvent
```

### Event Data Classes

Events are immutable data classes named in **past tense**:

```kotlin
// orders/events/OrderPlacedEvent.kt
data class OrderPlacedEvent(
    val orderId: UUID,
    val customerId: UUID,
    val totalAmount: BigDecimal,
    override val occurredAt: Instant = Instant.now(),
) : ApplicationModuleEvent
```

Event classes live in the module's `events/` sub-package with `@PackageInfo @NamedInterface("events")`.

### Publishing Events

**Option A -- Via ApplicationEventPublisher** (services):

```kotlin
@Service
class OrderService(
    private val eventPublisher: ApplicationEventPublisher,
) {
    fun placeOrder(request: CreateOrderRequest): OrderDto {
        val saved = repository.save(entity)
        eventPublisher.publishEvent(
            OrderPlacedEvent(saved.id!!, saved.customerId, saved.totalAmount)
        )
        return saved.toDto()
    }
}
```

**Option B -- Via AggregateRoot.raise()** (domain-driven):

```kotlin
@Entity
class Order : AggregateRoot<Order>() {
    fun place() {
        this.status = OrderStatus.PLACED
        raise(OrderPlacedEvent(this.id!!, this.customerId, this.totalAmount))
    }
}
```

### Consuming Events

```kotlin
@Service
class NotificationEventHandler {
    @ApplicationModuleListener
    fun onOrderPlaced(event: OrderPlacedEvent) {
        // Cross-module reaction -- runs AFTER publishing transaction commits
        logger.info { "Order placed: ${event.orderId}" }
        notificationService.sendOrderConfirmation(event.customerId, event.orderId)
    }
}
```

### Event Guidelines

- Events run **AFTER** the publishing transaction commits (AFTER_COMMIT phase)
- Make handlers **idempotent** (check for duplicate processing)
- Include `eventId: UUID` and `occurredAt: Instant` in event payloads
- Events from one module consumed by another via narrowed dependency: `"orders :: events"`

---

## Modularity Tests

Verify module boundaries and generate architecture documentation:

```kotlin
class ModularityTests {

    @Test
    fun `verify module boundaries`() {
        ApplicationModules.of(Application::class.java).verify()
    }

    @Test
    fun `generate module documentation`() {
        ApplicationModules.of(Application::class.java)
            .generateDocumentation()  // Produces PlantUML diagrams
    }
}
```

`verify()` enforces:
- No circular dependencies between modules
- No access to `internal/` packages from outside the module
- All declared `allowedDependencies` are valid

---

## Architecture Rules

| Rule | Detail |
|------|--------|
| Module communication | Prefer `ApplicationModuleEvent` events over direct cross-module imports |
| Shared kernel | All modules may depend on `shared/` freely |
| Cross-module reads | Acceptable for aggregation use cases via public facade services |
| Table ownership | Each module owns its own database tables |
| API versioning | All endpoints prefixed with `/api/v1/` |
| Cross-context data | Always use facade service calls returning public DTOs (never inject repositories from other modules) |

---

## Request Flow

```
Request DTO -> Mapper.toCommand() -> Command -> Service -> Repository
                                                    |
Response DTO <- Mapper.toResponse() <----------  Entity
```

- Controllers handle HTTP, validation, and delegate to Mapper + Service
- Mappers convert between HTTP DTOs and domain objects (Commands, Entities)
- Services accept Commands, contain business logic, and orchestrate repositories
- Repositories abstract persistence concerns
