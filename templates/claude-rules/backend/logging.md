---
paths: apps/api/**
---

# Logging Patterns

> Full reference: `docs/backend/03-kotlin-conventions.md` (Logging section)

## kotlin-logging Setup

Use kotlin-logging 8.x at **file level**:

```kotlin
import io.github.oshai.kotlinlogging.KotlinLogging

private val logger = KotlinLogging.logger {}
```

Never use SLF4J directly, never place loggers in companion objects.

## Exception Logging

Throwable-first, message-lambda-second:

```kotlin
logger.debug { "Fetching product $productId" }
logger.info { "Order placed: $orderId" }
logger.warn { "Rate limit approaching for user $userId" }
logger.error(ex) { "Failed to process order: $orderId" }
```

## GenericFilterBean Logger Collision

`GenericFilterBean` (parent of `OncePerRequestFilter`) has a `protected final Log logger` field. Inside filter methods, `logger` resolves to Spring's `Log`, **not** the file-level kotlin-logging instance.

**Fix**: Name the variable `log` in filter classes:

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
        // logger.info { } -- WRONG, silently uses Spring's Log
        filterChain.doFilter(request, response)
    }
}
```

Affected: `OncePerRequestFilter`, `GenericFilterBean`, and any Spring filter extending them.

## Log Level Guidelines

| Level | Use Case |
|-------|----------|
| `debug` | Query operations, detailed flow |
| `info` | Write operations, significant events |
| `warn` | Recoverable errors, rate limits |
| `error` | Unhandled exceptions, critical failures |
