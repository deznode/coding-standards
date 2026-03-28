---
paths: apps/api/**
---

# Kotlin Conventions

> Full reference: `docs/backend/03-kotlin-conventions.md`

## Jackson 3.x Imports

```kotlin
// CORRECT -- Jackson 3.x Kotlin module
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue

// WRONG -- old Jackson 2.x path
// import com.fasterxml.jackson.module.kotlin.*
```

Jackson annotations still use `com.fasterxml.jackson.annotation.*` (e.g., `@JsonFormat`).

In test classes and Spring-injected contexts, use `JsonMapper` (not `ObjectMapper`):

```kotlin
@Autowired
private lateinit var jsonMapper: JsonMapper
```

## Logging

Use kotlin-logging 8.x at **file level** (never in companion objects):

```kotlin
import io.github.oshai.kotlinlogging.KotlinLogging

private val logger = KotlinLogging.logger {}

logger.info { "Processing order: $orderId" }
logger.error(ex) { "Failed to process order: $orderId" }
```

Exception pattern: throwable first, message lambda second.

| Level | Use Case |
|-------|----------|
| `debug` | Query operations, detailed flow |
| `info` | Write operations, significant events |
| `warn` | Recoverable errors, rate limits |
| `error` | Unhandled exceptions, critical failures |

## Transaction Annotations

```kotlin
@Service
@Transactional(readOnly = true)       // Class-level default for read services
class OrderReadService {
    fun findById(id: UUID): Order = ...

    @Transactional(readOnly = false)  // Override for writes
    fun updateStatus(id: UUID, status: OrderStatus) { ... }
}
```

## DTO Mapping

Extension functions in `Mapper.kt` within the domain package:

```kotlin
fun Order.toDto(): OrderDto {
    val entityId = this.id ?: throw IllegalStateException("Cannot map entity with null ID")
    return OrderDto(id = entityId, status = this.status, ...)
}
```

## ktlint Rules

1. **No blank first line** in class body
2. **Newline before `=`** when params span multiple lines
3. **MockMvc chain dots** on same line as closing paren: `).andExpect(...)`

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Controller | `{Resource}Controller` | `ProductController` |
| Service | `{Domain}Service` | `OrderService` |
| Repository | `{Entity}Repository` | `ProductRepository` |
| Entity | Singular noun | `Product`, `OrderItem` |
| DTO (response) | `{Name}Dto` | `ProductDto` |
| DTO (request) | `{Action}{Resource}Request` | `CreateProductRequest` |
| Event | `{Entity}{Action}Event` (past tense) | `OrderPlacedEvent` |
| DB table | `snake_case` plural | `order_items` |
| DB column | `snake_case` | `created_at` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |

### Method Naming

- Repository: `findBy*`, `existsBy*`, `countBy*`
- Service: Business verbs (`placeOrder()`, `cancelOrder()`)
- Controller: HTTP action verbs (`getProduct()`, `createProduct()`)
