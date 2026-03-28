---
paths: apps/api/**
---

# API Design Patterns

> Full reference: `docs/backend/02-api-design.md`

## Response Wrappers

All responses use wrappers from `shared/api/`. Never use `ResponseEntity<T>` directly.

```kotlin
// Single item
return ApiResult(data = dto, status = 200)
return ApiResult(data = dto, status = HttpStatus.CREATED.value())

// Paginated list
return PagedApiResult.from(page)
```

## Error Responses

Errors use `ErrorResponse` or `ValidationErrorResponse` via `GlobalExceptionHandler`:

| Exception | HTTP Status | Response Type |
|-----------|-------------|---------------|
| `ResourceNotFoundException` | 404 | `ErrorResponse` |
| `BusinessException` | 422 | `ErrorResponse` |
| `RateLimitExceededException` | 429 | `ErrorResponse` |
| Jakarta validation failures | 400 | `ValidationErrorResponse` |
| `IllegalArgumentException` | 400 | `ErrorResponse` |

## HTTP Methods and Status Codes

| Operation | Method | Success |
|-----------|--------|---------|
| Create | POST | 201 Created |
| Read | GET | 200 OK |
| Update | PUT | 200 OK |
| Partial Update | PATCH | 200 OK |
| Delete | DELETE | 204 No Content |

## Controller Structure

```kotlin
@RestController
@RequestMapping("/api/v1/resources")
class ResourceController(
    private val service: ResourceService,
) {
    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): ApiResult<ResourceDto> =
        ApiResult(data = service.getById(id))

    @GetMapping
    fun list(
        @RequestParam(name = "page", defaultValue = "0") page: Int,
        @RequestParam(name = "size", defaultValue = "20") size: Int,
    ): PagedApiResult<ResourceDto> =
        PagedApiResult.from(service.listPage(PageRequest.of(page, size)))

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @Valid @RequestBody request: CreateResourceRequest,
    ): ApiResult<ResourceDto> =
        ApiResult(data = service.create(request), status = HttpStatus.CREATED.value())

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
- Base path: `/api/v1/{resource-plural}`

## Resource Naming

Plural nouns, RESTful paths:
- `/api/v1/resources` -- collection
- `/api/v1/resources/{id}` -- single item
- `/api/v1/resources/slug/{slug}` -- lookup by slug
- `/api/v1/resources/{resourceId}/items` -- nested sub-resources

## Request Validation

```kotlin
data class CreateResourceRequest(
    @field:NotBlank @field:Size(max = 255)
    val name: String,
    @field:Size(max = 2000)
    val description: String?,
    @field:DecimalMin("0.01")
    val price: BigDecimal,
)
```

## DTO Placement

- HTTP DTOs: `internal/infrastructure/api/dto/` (never in domain layer)
- Cross-module DTOs: module's base package (public access)
- Response DTOs: use `companion object { fun from(entity): Dto }` factory
