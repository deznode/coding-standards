# API Design Standards

Standardized REST API patterns for Spring Boot backends with consistent response envelopes, error handling, and controller conventions.

---

## Response Wrappers

**Why wrappers over raw ResponseEntity?** Consistent response envelopes give frontend clients a predictable structure to parse. Every response includes `data`, `status`, and `timestamp`, eliminating guesswork about response shapes and making error handling uniform across all endpoints.

All API responses use wrappers from `shared/api/ApiResult.kt`. Never use `ResponseEntity<T>` directly.

### ApiResult (Single Item)

```kotlin
data class ApiResult<T>(
    val data: T,
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val status: Int = 200,
)
```

### PagedApiResult (Paginated List)

```kotlin
data class PagedApiResult<T : Any>(
    val data: List<T>,
    val pageable: PageableInfo,
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val status: Int = 200,
) {
    companion object {
        fun <T : Any> from(page: Page<T>): PagedApiResult<T> = ...
    }
}
```

### Usage

```kotlin
// Single item
return ApiResult(data = productDto, status = 200)

// Created item
return ApiResult(data = productDto, status = HttpStatus.CREATED.value())

// Paginated list
return PagedApiResult.from(page)
```

---

## Error Response Format

All errors are wrapped in `ErrorResponse` or `ValidationErrorResponse`:

```kotlin
data class ErrorResponse(
    val error: String,
    val message: String,
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val path: String? = null,
    val status: Int,
)

data class ValidationErrorResponse(
    val error: String,
    val details: List<FieldError>,
    val timestamp: LocalDateTime = LocalDateTime.now(),
    val path: String? = null,
    val status: Int = 400,
) {
    data class FieldError(
        val field: String,
        val rejectedValue: Any?,
        val message: String,
    )
}
```

> **Alternative**: RFC 9457 `ProblemDetail` is supported by Spring Boot and can be used as an alternative error response format via `@ControllerAdvice` returning `ProblemDetail` instances.

---

## HTTP Methods and Status Codes

| Operation | Method | Success | Common Errors |
|-----------|--------|---------|---------------|
| Create | POST | 201 Created | 400, 409, 422 |
| Read (single) | GET | 200 OK | 404 |
| Read (list) | GET | 200 OK | 400 |
| Update | PUT | 200 OK | 400, 404, 422 |
| Partial Update | PATCH | 200 OK | 400, 404, 422 |
| Delete | DELETE | 204 No Content | 404 |

---

## Resource Naming Conventions

Use RESTful conventions with plural nouns:

```
# Correct
/api/v1/products
/api/v1/products/{id}
/api/v1/products/slug/{slug}
/api/v1/orders/{orderId}/items

# Incorrect
/api/v1/getProducts
/api/v1/products/getById/{id}
/api/v1/product                    # Use plural
```

---

## Controller Structure

```kotlin
@RestController
@RequestMapping("/api/v1/products")
class ProductController(
    private val service: ProductService,
) {
    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): ApiResult<ProductDto> {
        val product = service.getById(id)
        return ApiResult(data = product)
    }

    @GetMapping
    fun list(
        @RequestParam(name = "q", required = false) q: String?,
        @RequestParam(name = "category", required = false) category: String?,
        @RequestParam(name = "page", defaultValue = "0") page: Int,
        @RequestParam(name = "size", defaultValue = "20") size: Int,
    ): PagedApiResult<ProductDto> {
        val resultPage = service.listPage(PageRequest.of(page, size))
        return PagedApiResult.from(resultPage)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @Valid @RequestBody request: CreateProductRequest,
    ): ApiResult<ProductDto> {
        val product = service.create(request)
        return ApiResult(data = product, status = HttpStatus.CREATED.value())
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: UUID,
        @Valid @RequestBody request: UpdateProductRequest,
    ): ApiResult<ProductDto> {
        val product = service.update(id, request)
        return ApiResult(data = product)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id: UUID) {
        service.delete(id)
    }
}
```

Key patterns:
- **Constructor injection** (no `@Autowired`)
- `@ResponseStatus(HttpStatus.CREATED)` + `status = HttpStatus.CREATED.value()` on POST
- `@ResponseStatus(HttpStatus.NO_CONTENT)` with `Unit` return on DELETE
- `@RequestMapping("/api/v1/{module}")` base path

---

## Controller Documentation

Use HTML JavaDoc tags and OpenAPI annotations:

```kotlin
/**
 * Creates a new product in the catalog.
 *
 * <p>Requires authentication. Validates the request data,
 * checks rate limits, and persists the product.</p>
 *
 * @param request Product creation data
 * @param authentication Spring Security authentication (contains user ID)
 * @return ApiResult with the created product DTO (201 Created)
 */
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
@Operation(summary = "Create product", description = "...")
@ApiResponses(value = [
    ApiResponse(responseCode = "201", description = "Created successfully"),
    ApiResponse(responseCode = "400", description = "Invalid request data"),
    ApiResponse(responseCode = "401", description = "Unauthorized"),
    ApiResponse(responseCode = "429", description = "Rate limit exceeded"),
])
fun create(
    @Valid @RequestBody request: CreateProductRequest,
    authentication: Authentication,
): ApiResult<ProductDto> { ... }
```

---

## Request Parameter Patterns

```kotlin
// Path variable
@GetMapping("/{id}")
fun getById(@PathVariable id: UUID): ApiResult<ProductDto>

// Request params with defaults
@GetMapping
fun list(
    @RequestParam(name = "page", defaultValue = "0") page: Int,
    @RequestParam(name = "size", defaultValue = "20") size: Int,
    @RequestParam(name = "sort", defaultValue = "created_at_desc") sort: String,
): PagedApiResult<ProductDto>

// Validated request body
@PostMapping
fun create(
    @Valid @RequestBody request: CreateProductRequest,
): ApiResult<ProductDto>

// Authentication parameter
fun create(
    @Valid @RequestBody request: CreateProductRequest,
    authentication: Authentication,
    httpRequest: HttpServletRequest,
)

// Language header for i18n
fun list(
    @RequestHeader("Accept-Language", defaultValue = "en") language: String,
)
```

---

## Query Parameter Conventions

| Purpose | Example |
|---------|---------|
| Filtering | `?category=electronics&status=active` |
| Pagination | `?page=0&size=20&sort=name,asc` |
| Search | `?q=wireless+keyboard` or `?search=wireless+keyboard` |
| Sorting | `?sort=createdAt,desc` |

---

## Input Validation

### Bean Validation Annotations

| Annotation | Purpose |
|------------|---------|
| `@NotBlank` | Non-null, non-empty string |
| `@Size(min, max)` | String/collection length bounds |
| `@DecimalMin` / `@DecimalMax` | Numeric bounds |
| `@Pattern` | Regex validation |
| `@URL` | Valid URL format |
| `@Valid` | Cascade validation to nested objects |

### Request DTO Example

```kotlin
data class CreateProductRequest(
    @field:NotBlank
    @field:Size(max = 255)
    val name: String,

    @field:Size(max = 2000)
    val description: String?,

    @field:DecimalMin("0.01")
    val price: BigDecimal,

    @field:Pattern(regexp = "^[a-z0-9-]+$")
    val slug: String?,
)
```

---

## Module Sub-Package Layout

Every module follows this structure:

```
{module}/
├── api/              # Controllers, request/response DTOs
│   ├── ProductController.kt
│   ├── AdminProductController.kt
│   ├── CreateProductRequest.kt
│   └── ProductDto.kt
├── domain/           # Entities, services, mapper extensions
│   ├── Product.kt
│   ├── ProductVariant.kt
│   ├── ProductService.kt
│   └── Mapper.kt
├── repository/       # JPA repositories
│   └── ProductRepository.kt
└── services/         # Secondary/cross-cutting services
    └── SearchService.kt
```

- **api/**: HTTP layer -- controllers, request DTOs, response DTOs
- **domain/**: Business logic -- entities, services, extension function mappers
- **repository/**: Data access -- Spring Data JPA interfaces
- **services/**: Additional services (search, caching, etc.)

---

## DTO Patterns

- **HTTP DTOs** belong in the API layer (`api/` or `internal/infrastructure/api/dto/`), never in the domain layer
- **Cross-module DTOs** go in the module's base package for public access
- Response DTOs: use `companion object { fun from(entity): ResponseDto }` factory
- Request DTOs: nullable fields + Jakarta Validation
- Partial updates: merge nullable request fields with current entity values
- Cross-context data: always use facade service calls returning public DTOs (never inject repositories from other modules)
