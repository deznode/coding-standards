# Kotlin Coding Conventions

Kotlin-specific patterns and conventions for Spring Boot backends.

---

## Jackson 3.x Imports

**Why?** Spring Boot 4 ships with Jackson 3.x, which moved the Kotlin module to the `tools.jackson` namespace. Using the old `com.fasterxml.jackson.module` path will cause compilation errors or classpath conflicts.

Use the `tools.jackson` package for Kotlin module imports (NOT `com.fasterxml.jackson.module`):

```kotlin
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue

private val objectMapper = jacksonObjectMapper()

// Deserialize
val result: MyType = objectMapper.readValue<MyType>(jsonString)

// Serialize
val json = objectMapper.writeValueAsString(myObject)
```

**DON'T**: `import com.fasterxml.jackson.module.kotlin.*` -- this is the old Jackson 2.x path.

**Note**: Jackson annotations still use `com.fasterxml.jackson.annotation.*` (e.g., `@JsonFormat`, `@JsonTypeName`). Only the Kotlin module imports changed to `tools.jackson`.

**Note**: For test classes and Spring-injected serialization, use `JsonMapper` (not `ObjectMapper`):

```kotlin
@Autowired
private lateinit var jsonMapper: JsonMapper
```

---

## Logging

**Why kotlin-logging over SLF4J?** kotlin-logging wraps SLF4J with Kotlin idioms: lambda-based message construction avoids string concatenation when the log level is disabled, and file-level declaration avoids the boilerplate of companion object loggers.

Use kotlin-logging 8.x (`io.github.oshai.kotlinlogging`) at **file level**, not in a companion object:

```kotlin
import io.github.oshai.kotlinlogging.KotlinLogging

private val logger = KotlinLogging.logger {}

@Service
class OrderService {
    fun processOrder(orderId: UUID) {
        logger.info { "Processing order: $orderId" }
        logger.warn { "Slow query detected: ${duration}ms" }
        logger.error(ex) { "Failed to process order: $orderId" }
    }
}
```

**DON'T**:
- Use SLF4J directly (`LoggerFactory.getLogger(...)`)
- Place loggers in companion objects
- Use SLF4J `{}` placeholder syntax

### Spring Filter Logger Collision

`GenericFilterBean` (parent of `OncePerRequestFilter`) has a `protected final Log logger` field. In subclasses, `logger` inside methods resolves to Spring's `Log`, **not** the file-level kotlin-logging instance.

**Fix**: Name the file-level variable `log` in filter classes:

```kotlin
private val log = KotlinLogging.logger {}

@Component
class RateLimitFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        log.info { "works correctly" }        // kotlin-logging
        // logger.info { } would silently use Spring's Log -- WRONG
        filterChain.doFilter(request, response)
    }
}
```

Affected base classes: `OncePerRequestFilter`, `GenericFilterBean`, any Spring filter extending them.

### Log Level Guidelines

| Level | Use Case |
|-------|----------|
| `debug` | Query operations, detailed flow |
| `info` | Write operations, significant events |
| `warn` | Recoverable errors, rate limits |
| `error` | Unhandled exceptions, critical failures |

### Exception Logging

Always use the throwable-first, message-lambda-second pattern:

```kotlin
logger.debug { "Fetching product $productId" }           // No exception
logger.info { "Order placed: $orderId" }                  // Significant event
logger.warn { "Rate limit approaching for user $userId" } // Warning
logger.error(ex) { "Failed to process order: $orderId" }  // With exception
```

---

## Transaction Annotations

```kotlin
@Service
@Transactional                        // Class-level default for write services
class OrderWriteService { ... }

@Service
@Transactional(readOnly = true)       // Class-level default for read-only services
class OrderReadService {

    // Read operations inherit read-only
    fun findById(id: UUID): Order = repository.findById(id).orElseThrow()

    // Override at method level for writes
    @Transactional(readOnly = false)
    fun updateStatus(id: UUID, status: OrderStatus) { ... }
}
```

---

## DTO Mapping

### Extension Functions (Simple Entity-to-DTO)

For simple entity-to-DTO conversions, use extension functions in a `Mapper.kt` file within the module's `domain/` package:

```kotlin
// orders/domain/Mapper.kt
fun Order.toDto(): OrderDto {
    val entityId = this.id ?: throw IllegalStateException("Cannot map entity with null ID")
    return OrderDto(
        id = entityId,
        customerId = this.customerId,
        status = this.status,
        totalAmount = this.totalAmount,
        createdAt = this.createdAt,
    )
}
```

Usage in services and controllers:

```kotlin
service.listOrders(pageable).map { it.toDto() }
```

### Mapper Objects (Full Request/Command/Response Flows)

When the mapping involves Request-to-Command and Entity-to-Response transformations with Command intermediaries, use a dedicated `object {Module}Mapper` in the `api/` package. See [API Design - Mapper Objects](02-api-design.md#mapper-objects) for the full pattern.

---

## ktlint Rules

### 1. No blank first line in class body

```kotlin
// GOOD
class ProductService {
    val maxPageSize = 100
}

// BAD
class ProductService {

    val maxPageSize = 100
}
```

### 2. Newline before `=` when params span multiple lines

```kotlin
// GOOD
fun createProduct(
    request: CreateProductRequest,
): ApiResult<ProductDto> =
    ApiResult(data = service.create(request))

// BAD
fun createProduct(
    request: CreateProductRequest,
): ApiResult<ProductDto> = ApiResult(data = service.create(request))
```

### 3. MockMvc chain dots on same line as closing paren

```kotlin
// GOOD
mockMvc
    .perform(
        post("/api/v1/products")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json),
    ).andExpect(status().isCreated)
    .andExpect(jsonPath("$.status").value(201))

// BAD -- dot on new line after closing paren
mockMvc
    .perform(...)
    .andExpect(...)
```

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Controller | `{Resource}Controller` | `ProductController` |
| Service | `{Domain}Service` | `OrderService` |
| Repository | `{Entity}Repository` | `ProductRepository` |
| Entity | Singular noun | `Product`, `OrderItem` |
| DTO (response) | `{Name}Dto` or `{Name}Response` | `ProductDto`, `ProductResponse` |
| DTO (request) | `{Action}{Resource}Request` | `CreateProductRequest` |
| Command | `{Action}{Resource}Command` | `CreateProductCommand` |
| Exception | `sealed class {Module}Exception` | `TransactionException` |
| Mapper | `object {Module}Mapper` | `ProductMapper` |
| Test fixture | `object {Module}Fixtures` | `TransactionFixtures` |
| Event | `{Entity}{Action}Event` (past tense) | `OrderPlacedEvent` |
| DB table | `snake_case` plural | `order_items` |
| DB column | `snake_case` | `created_at` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |

### Method Naming

| Context | Pattern | Example |
|---------|---------|---------|
| Repository | `findBy*`, `existsBy*`, `countBy*` | `findBySlug()` |
| Service | Business verbs | `placeOrder()`, `cancelOrder()` |
| Controller | HTTP action verbs | `getProduct()`, `createProduct()` |

### Property Naming

| Context | Convention | Example |
|---------|------------|---------|
| Kotlin/Java | camelCase | `phoneNumber`, `unitPrice` |
| Database | snake_case | `phone_number`, `unit_price` |
