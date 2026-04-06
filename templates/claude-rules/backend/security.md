---
paths: apps/api/**
standard_type: aspirational
---

# Security Patterns

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/backend/05-security.md`

## Error Handling

> Full reference: `docs/backend/07-error-handling.md`

Each module defines a `sealed class {Module}Exception` with nested subtypes. Module-specific `@RestControllerAdvice` at `@Order(1)` handles them with exhaustive `when`. Global handler at `@Order(100)` catches generic exceptions. Response format: `ProblemDetail` (RFC 9457).

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
