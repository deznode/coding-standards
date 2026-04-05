# Mobile Architecture

Defines the module structure, domain modeling, and layering rules for Kotlin Multiplatform projects targeting Android and iOS.

**Why?** Without clear architectural boundaries, shared KMP code devolves into a monolithic `shared` module where platform concerns bleed into domain logic, feature modules reach across boundaries for data, and changes in one area cascade unpredictably. These rules enforce separation of concerns at the module level, map DDD bounded contexts to feature modules, and establish a dependency direction that keeps the domain layer pure and portable.

---

## Module Structure

Production KMP projects use a layered module structure that separates concerns by responsibility and shareability. The `shared/` directory contains horizontal layers (domain, data, network, platform), the `features/` directory contains vertical slices per bounded context, and platform apps live at the root level.

```
project-root/
├── build-logic/                         # Convention plugins (composite build)
├── shared/
│   ├── domain/                          # Pure business logic (highest shareability)
│   │   └── src/commonMain/kotlin/
│   │       ├── model/                   # Data classes, value objects
│   │       ├── repository/              # Repository interfaces (contracts only)
│   │       └── usecase/                 # Use case / interactor classes
│   ├── data/                            # Repository implementations, mappers
│   │   └── src/
│   │       ├── commonMain/kotlin/
│   │       │   ├── repository/          # Implementations using DB + network
│   │       │   ├── mapper/              # Domain <-> DTO mappers
│   │       │   └── cache/               # SQLDelight queries, DAOs
│   │       ├── androidMain/kotlin/
│   │       └── iosMain/kotlin/
│   ├── network/                         # Ktor client, API services, DTOs
│   │   └── src/commonMain/kotlin/
│   │       ├── api/                     # API interface + Ktor implementation
│   │       ├── dto/                     # @Serializable DTOs
│   │       └── interceptor/             # Auth, logging interceptors
│   └── platform/                        # expect/actual implementations
│       └── src/
│           ├── commonMain/kotlin/
│           ├── androidMain/kotlin/
│           └── iosMain/kotlin/
├── features/
│   ├── auth/                            # Authentication bounded context
│   │   ├── src/commonMain/kotlin/       # Shared auth logic
│   │   ├── androidMain/                 # Android UI (Compose)
│   │   └── iosMain/                     # iOS UI (SwiftUI via Kotlin interface)
│   └── dashboard/                       # Dashboard bounded context
├── androidApp/                          # Android application module
├── iosApp/                              # Xcode project
└── settings.gradle.kts
```

MUST use this module layout for all new KMP projects. Feature modules depend on `shared/domain` via `api()` and on `shared/data` or `shared/network` via `implementation()`. Platform app modules assemble the dependency graph.

---

## Source Set Hierarchy

KMP 1.9+ introduced the default hierarchy template which automatically creates intermediate source sets. Enable it explicitly in every KMP module:

```kotlin
kotlin {
    applyDefaultHierarchyTemplate()   // enabled by default in KGP 1.9.20+

    androidTarget()
    iosArm64()
    iosX64()
    iosSimulatorArm64()
    jvm()
}
```

The resulting source set tree:

```
commonMain
├── nativeMain          (all native targets)
│   ├── appleMain       (iOS, macOS, watchOS, tvOS)
│   │   ├── iosMain     (all iOS targets)
│   │   │   ├── iosArm64Main
│   │   │   ├── iosX64Main
│   │   │   └── iosSimulatorArm64Main
│   │   └── macosMain
│   └── linuxMain
├── jvmMain             (JVM and Android)
│   ├── androidMain
│   └── desktopMain     (if using Compose for Desktop)
└── jsMain
```

Custom intermediate source sets for code shared between Android and JVM (but not iOS):

```kotlin
kotlin {
    applyDefaultHierarchyTemplate()

    sourceSets {
        val jvmAndAndroid by creating {
            dependsOn(commonMain.get())
        }
        androidMain.get().dependsOn(jvmAndAndroid)
        jvmMain.get().dependsOn(jvmAndAndroid)
    }
}
```

MUST call `applyDefaultHierarchyTemplate()` in every KMP module. SHOULD use intermediate source sets only when platform-specific code is shared across a subset of targets (e.g., `appleMain` for iOS + macOS).

---

## Bounded Contexts as Feature Modules

Each bounded context from the domain maps to a feature module under `features/`. A bounded context is a boundary within which a particular domain model and ubiquitous language remains consistent. The term "Order" can mean different things in Sales, Shipping, and Accounting contexts -- each feature module owns its own model.

```
features/
├── auth/           # Authentication context: login, registration, token management
├── catalog/        # Product catalog context: browsing, search, categories
├── orders/         # Order context: cart, checkout, order tracking
└── payments/       # Payment context: payment methods, transactions, refunds
```

MUST map each bounded context to exactly one feature module. Feature modules MUST NOT import from other feature modules directly. Cross-module communication uses events (see Events for Cross-Module Communication below).

The `shared/domain` module serves as the **shared kernel** -- a small, explicit subset of the domain model that multiple bounded contexts agree to share. Keep it deliberately minimal:

```kotlin
// shared/domain/src/commonMain/kotlin/com/example/shared/domain/model/

// Shared kernel: types used across multiple bounded contexts
data class UserId(val value: String)
data class Money(val amount: Long, val currency: Currency)
enum class Currency { USD, EUR, CVE }
```

---

## Rich Domain Models and Value Objects

Domain models in `shared/domain` MUST be rich -- they encapsulate behavior and enforce invariants, not just carry data. Avoid anemic domain models where entities are pure data containers and all business logic lives in service classes.

### Value Objects with Inline Classes

Use `@JvmInline value class` for value objects that wrap a single value. Value objects are defined entirely by their attributes, have no identity, and are immutable:

```kotlin
// shared/domain/src/commonMain/kotlin/com/example/shared/domain/model/

@JvmInline
value class Email(val value: String) {
    init {
        require(value.matches(EMAIL_REGEX)) { "Invalid email: $value" }
    }

    companion object {
        private val EMAIL_REGEX = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")
    }
}

@JvmInline
value class OrderId(val value: String) {
    init {
        require(value.isNotBlank()) { "OrderId must not be blank" }
    }
}

@JvmInline
value class ProductId(val value: String)
```

### Multi-Field Value Objects

For value objects with multiple fields, use `data class`:

```kotlin
data class Money(
    val amount: Long,          // Store in minor units (cents) to avoid floating point
    val currency: Currency,
) {
    init {
        require(amount >= 0) { "Money amount must be non-negative" }
    }

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "Cannot add different currencies" }
        return copy(amount = amount + other.amount)
    }

    operator fun times(quantity: Int): Money =
        copy(amount = amount * quantity)
}

data class Address(
    val street: String,
    val city: String,
    val postalCode: String,
    val country: String,
) {
    init {
        require(street.isNotBlank()) { "Street must not be blank" }
        require(city.isNotBlank()) { "City must not be blank" }
    }
}
```

### Rich Entities with Behavior

Entities carry identity and encapsulate business rules. Replace setters with behavior methods:

```kotlin
data class Order private constructor(
    val id: OrderId,
    val customerId: UserId,          // Reference other aggregates by ID only
    val items: List<OrderItem>,
    val status: OrderStatus,
    val createdAt: Long,
) {
    val total: Money
        get() = items.fold(Money(0, Currency.USD)) { acc, item ->
            acc + item.lineTotal
        }

    // Behavior method -- NOT a setter
    fun addItem(productId: ProductId, unitPrice: Money, quantity: Int): Order {
        require(status == OrderStatus.DRAFT) { "Cannot add items to a ${status.name} order" }
        require(quantity > 0) { "Quantity must be positive" }
        val newItem = OrderItem(productId, unitPrice, quantity)
        return copy(items = items + newItem)
    }

    fun submit(): Order {
        require(status == OrderStatus.DRAFT) { "Can only submit DRAFT orders" }
        require(items.isNotEmpty()) { "Cannot submit an empty order" }
        return copy(status = OrderStatus.SUBMITTED)
    }

    companion object {
        fun create(id: OrderId, customerId: UserId): Order = Order(
            id = id,
            customerId = customerId,
            items = emptyList(),
            status = OrderStatus.DRAFT,
            createdAt = currentTimeMillis(),
        )
    }
}
```

---

## Aggregate Design Rules

Follow Vaughn Vernon's four canonical rules for aggregate design:

1. **Model true invariants in consistency boundaries** -- only include objects that MUST be immediately consistent with each other inside the same aggregate.
2. **Design small aggregates** -- approximately 70% of aggregates should be just a root entity with value objects. Only 30% should contain two or three total entities.
3. **Reference other aggregates by ID only** -- never hold direct object references between aggregates. Use `UserId`, `OrderId`, `ProductId` instead of `User`, `Order`, `Product`.
4. **Use eventual consistency outside the boundary** -- one transaction modifies one aggregate only. Cross-aggregate consistency happens through domain events.

```kotlin
// CORRECT: reference by ID
data class Order(
    val id: OrderId,
    val customerId: UserId,      // ID reference, not User object
    val items: List<OrderItem>,
)

// WRONG: direct object reference creates tight coupling
data class Order(
    val id: OrderId,
    val customer: User,          // Do NOT hold the full User aggregate
    val items: List<OrderItem>,
)
```

MUST reference other aggregates by ID only. MUST NOT span transactions across multiple aggregates.

---

## Repository Pattern

Repository interfaces belong in the domain layer (`shared/domain`), using ubiquitous language. Repository implementations belong in the infrastructure layer (`shared/data`).

```kotlin
// shared/domain/src/commonMain/kotlin/com/example/shared/domain/repository/
interface OrderRepository {
    fun getById(id: OrderId): Flow<Order?>
    fun getActiveOrders(customerId: UserId): Flow<List<Order>>
    suspend fun save(order: Order)
    suspend fun delete(id: OrderId)
}
```

```kotlin
// shared/data/src/commonMain/kotlin/com/example/shared/data/repository/
class OrderRepositoryImpl(
    private val db: AppDatabase,
    private val api: OrderApi,
    private val dispatchers: CoroutineDispatchers,
) : OrderRepository {

    override fun getById(id: OrderId): Flow<Order?> =
        db.orderQueries.getById(id.value)
            .asFlow()
            .mapToOneOrNull(dispatchers.io)
            .map { it?.toDomain() }

    override fun getActiveOrders(customerId: UserId): Flow<List<Order>> =
        db.orderQueries.getActiveByCustomer(customerId.value)
            .asFlow()
            .mapToList(dispatchers.io)
            .map { entities -> entities.map { it.toDomain() } }

    override suspend fun save(order: Order) = withContext(dispatchers.io) {
        db.transaction {
            db.orderQueries.upsert(order.toEntity())
            order.items.forEach { item ->
                db.orderItemQueries.upsert(item.toEntity(order.id))
            }
        }
    }
}
```

MUST define repository interfaces in `shared/domain` using domain language (`getActiveOrders`, not `selectByStatusNotIn`). MUST place implementations in `shared/data`. SHOULD name implementations with an `Impl` suffix.

---

## Clean Architecture Layers

The project enforces strict dependency direction: inner layers MUST NOT reference outer layers.

```
                    +-----------------------+
                    |    Platform Apps      |   androidApp/, iosApp/
                    |  (Android, iOS)       |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |    Features           |   features/{auth, orders, ...}
                    |  (UI + ViewModel)     |
                    +-----------+-----------+
                                |
              +-----------------+------------------+
              |                                    |
  +-----------v-----------+          +-------------v-----------+
  |    Application        |          |    Infrastructure       |
  |  (Use Cases)          |          |  (Repos, Network, DB)   |
  |  shared/domain/usecase|          |  shared/{data, network} |
  +-----------+-----------+          +-------------+-----------+
              |                                    |
              +-----------------+------------------+
                                |
                    +-----------v-----------+
                    |    Domain             |   shared/domain/model
                    |  (Entities, VOs,      |   shared/domain/repository (interfaces)
                    |   Repository IFs)     |
                    +-----------------------+
```

MUST NOT import from `shared/data` or `shared/network` inside `shared/domain`. The domain layer contains only pure Kotlin types with no platform imports, no framework annotations, and no infrastructure dependencies.

---

## Package Convention

All shared code follows this package structure:

```
com.example.shared.domain.model.*          # Entities, value objects, enums
com.example.shared.domain.repository.*     # Repository interfaces
com.example.shared.domain.usecase.*        # Use cases / interactors
com.example.shared.data.repository.*       # Repository implementations
com.example.shared.data.mapper.*           # Domain <-> Entity/DTO mappers
com.example.shared.data.cache.*            # SQLDelight queries, local DAOs
com.example.shared.network.api.*           # API interfaces + Ktor implementations
com.example.shared.network.dto.*           # @Serializable DTOs
com.example.shared.network.interceptor.*   # Auth, logging interceptors
com.example.shared.platform.*             # expect/actual platform utilities
```

Feature modules use their own package namespace:

```
com.example.features.auth.*               # Auth bounded context
com.example.features.orders.*             # Orders bounded context
com.example.features.catalog.*            # Catalog bounded context
```

MUST follow this package convention for all shared and feature code. MUST NOT place domain types in data or network packages.

---

## Events for Cross-Module Communication

Feature modules MUST NOT import from each other. Use events for cross-module communication via `SharedFlow` or `Channel` in a shared event bus:

```kotlin
// shared/domain/src/commonMain/kotlin/com/example/shared/domain/event/

sealed interface DomainEvent {
    val occurredAt: Long
}

data class OrderSubmitted(
    val orderId: OrderId,
    val customerId: UserId,
    val total: Money,
    override val occurredAt: Long = currentTimeMillis(),
) : DomainEvent

data class PaymentCompleted(
    val orderId: OrderId,
    val transactionId: String,
    override val occurredAt: Long = currentTimeMillis(),
) : DomainEvent
```

```kotlin
// shared/domain/src/commonMain/kotlin/com/example/shared/domain/event/

interface EventBus {
    val events: SharedFlow<DomainEvent>
    suspend fun publish(event: DomainEvent)
}

class InMemoryEventBus : EventBus {
    private val _events = MutableSharedFlow<DomainEvent>(
        replay = 0,
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    override val events: SharedFlow<DomainEvent> = _events.asSharedFlow()

    override suspend fun publish(event: DomainEvent) {
        _events.emit(event)
    }
}
```

Feature modules subscribe to events they care about and publish events when significant domain actions occur:

```kotlin
// features/orders -- publishes OrderSubmitted
class SubmitOrderUseCase(
    private val orderRepo: OrderRepository,
    private val eventBus: EventBus,
) {
    suspend operator fun invoke(orderId: OrderId) {
        val order = orderRepo.getById(orderId).first()
            ?: throw IllegalArgumentException("Order not found")
        val submitted = order.submit()
        orderRepo.save(submitted)
        eventBus.publish(OrderSubmitted(submitted.id, submitted.customerId, submitted.total))
    }
}

// features/payments -- listens for OrderSubmitted
class PaymentFeatureInitializer(
    private val eventBus: EventBus,
    private val scope: CoroutineScope,
) {
    fun start() {
        scope.launch {
            eventBus.events
                .filterIsInstance<OrderSubmitted>()
                .collect { event -> initiatePayment(event.orderId, event.total) }
        }
    }
}
```

MUST use the event bus for all cross-feature communication. MUST NOT add direct imports between feature modules.

---

## Summary

| Rule | Severity | Description |
|------|----------|-------------|
| Module layout | MUST | Use `shared/{domain,data,network,platform}` + `features/` + platform apps |
| Default hierarchy | MUST | Call `applyDefaultHierarchyTemplate()` in every KMP module |
| Bounded contexts | MUST | Map each bounded context to one feature module |
| No cross-feature imports | MUST | Feature modules communicate via events only |
| Rich domain models | MUST | Entities encapsulate behavior; avoid anemic models |
| Value objects | SHOULD | Use `@JvmInline value class` for single-value types, `data class` for multi-field |
| Aggregate by ID | MUST | Reference other aggregates by ID, never by direct object reference |
| Single-aggregate transactions | MUST | One transaction modifies one aggregate only |
| Repository interfaces in domain | MUST | Interfaces in `shared/domain`, implementations in `shared/data` |
| Dependency direction | MUST | Inner layers never reference outer layers; domain has zero infrastructure imports |
| Package convention | MUST | Follow `com.example.shared.{domain,data,network,platform}` structure |
| Shared kernel | SHOULD | Keep `shared/domain` minimal -- only types genuinely shared across contexts |
| Event bus | MUST | Use `SharedFlow`-based event bus for cross-module communication |
| Intermediate source sets | MAY | Create custom intermediate sets when sharing code across a target subset |
