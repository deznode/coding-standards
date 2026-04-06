---
paths: apps/api/**
standard_type: aspirational
---

# Error Handling Patterns

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/backend/07-error-handling.md`

## Sealed Exception Hierarchies

Each module defines a `sealed class {Module}Exception(message: String) : RuntimeException(message)` with nested subtypes:

```kotlin
sealed class TransactionException(message: String) : RuntimeException(message) {
    class NotFound(val transactionId: UUID) :
        TransactionException("Transaction not found: $transactionId")
    class InvalidStateTransition(val currentStatus: TransactionStatus, val attemptedAction: String) :
        TransactionException("Cannot $attemptedAction a $currentStatus transaction")
    class InvalidCommand(message: String) :
        TransactionException(message)
}
```

- Sealed classes live in `internal/domain/`
- Subtypes carry domain-specific context (IDs, states)
- Kotlin's exhaustive `when` ensures all subtypes are handled

## Module Exception Handlers

`@RestControllerAdvice` at `@Order(1)` per module with exhaustive `when`:

```kotlin
@RestControllerAdvice
@Order(1)
class TransactionExceptionHandler {
    @ExceptionHandler(TransactionException::class)
    fun handle(ex: TransactionException): ResponseEntity<ProblemDetail> {
        val (status, title) = when (ex) {
            is TransactionException.NotFound -> HttpStatus.NOT_FOUND to "Transaction Not Found"
            is TransactionException.InvalidStateTransition -> HttpStatus.CONFLICT to "Invalid State Transition"
            is TransactionException.InvalidCommand -> HttpStatus.BAD_REQUEST to "Invalid Transaction"
        }
        val problem = ProblemDetail.forStatusAndDetail(status, ex.message ?: title)
        problem.title = title
        problem.setProperty("timestamp", Instant.now())
        return ResponseEntity.status(status).body(problem)
    }
}
```

## Response Format

`ProblemDetail` (RFC 9457) with `timestamp` property. Spring Boot auto-serializes to `application/problem+json`.

## Handler Ordering

| Order | Handler | Catches |
|-------|---------|---------|
| 1-9 | Module-specific handlers | Module sealed exceptions |
| 100 | `GlobalExceptionHandler` | OptimisticLock, IllegalArgument, generic Exception |
