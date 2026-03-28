---
paths: apps/api/**
---

# Security Patterns

> Full reference: `docs/backend/05-security.md`

## Exception Hierarchy

| Exception | HTTP Status | Use Case |
|-----------|------------|----------|
| Jakarta validation | 400 | `@Valid` bean validation failures |
| `IllegalArgumentException` | 400 | Invalid parameter values |
| `ResourceNotFoundException` | 404 | Entity not found by ID/slug |
| `BusinessException` | 422 | Business rule violations |
| `RateLimitExceededException` | 429 | Rate limit exceeded |

Throw domain exceptions in service layer. `GlobalExceptionHandler` (`@ControllerAdvice`) converts to `ErrorResponse`/`ValidationErrorResponse`.

## JWT Authentication

- Stateless sessions (`SessionCreationPolicy.STATELESS`)
- JWK set URI and issuer URI from config properties
- `JwtAuthenticationConverter` for claim extraction

## Authorization Levels

| Pattern | Access |
|---------|--------|
| `GET /api/v1/public/**` | Public |
| `POST /api/v1/orders/**` | Authenticated |
| `/api/v1/admin/**` | ADMIN role only |

## Auth Extraction in Controllers

```kotlin
// Via Authentication parameter
fun create(
    @Valid @RequestBody request: CreateRequest,
    authentication: Authentication,
): ApiResult<Dto> {
    val userId = authentication.name
    ...
}

// Via request extension (reusable)
fun HttpServletRequest.requireUserId(): UUID {
    val principal = this.userPrincipal
        ?: throw UnauthorizedException("Authentication required")
    return UUID.fromString(principal.name)
}
```

## Rate Limiting

Bucket4j token bucket with Caffeine per-user cache:

```kotlin
rateLimitService.checkRateLimit("action:$userId")
```

Throws `RateLimitExceededException` (429) when exceeded.

## IP Extraction

```kotlin
fun extractClientIp(request: HttpServletRequest): String =
    request.getHeader("X-Forwarded-For")?.split(",")?.first()?.trim()
        ?: request.remoteAddr
```
