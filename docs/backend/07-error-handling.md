# Error Handling & Exception Design

Exception handling patterns for Spring Boot backends using module-scoped sealed class hierarchies, ProblemDetail (RFC 9457) responses, and ordered `@RestControllerAdvice` handlers.

**Why sealed class hierarchies over flat shared exceptions?** Flat shared exceptions like `ResourceNotFoundException` and `BusinessException` provide a basic mapping to HTTP status codes, but they lack domain context and force generic error messages. Module-scoped sealed classes give each module its own exception vocabulary (e.g., `TransactionException.InvalidStateTransition`), enable exhaustive `when` handling at compile time, and carry domain-specific context (IDs, states, attempted actions) for richer error responses.

---

## Module-Scoped Sealed Exceptions

Each module defines a `sealed class {Module}Exception` with nested subtypes for specific error scenarios:

```kotlin
// transaction/internal/domain/TransactionException.kt
sealed class TransactionException(message: String) : RuntimeException(message) {

    class NotFound(val transactionId: UUID) :
        TransactionException("Transaction not found: $transactionId")

    class InvalidStateTransition(
        val currentStatus: TransactionStatus,
        val attemptedAction: String,
    ) : TransactionException("Cannot $attemptedAction a $currentStatus transaction")

    class InvalidCommand(message: String) :
        TransactionException(message)
}
```

```kotlin
// inventory/internal/domain/InventoryException.kt
sealed class InventoryException(message: String) : RuntimeException(message) {

    class ProductNotFound(val productId: UUID) :
        InventoryException("Product not found: $productId")

    class InsufficientStock(val productId: UUID, val requested: Int, val available: Int) :
        InventoryException("Insufficient stock for product $productId: requested $requested, available $available")

    class DuplicateSku(val sku: String) :
        InventoryException("SKU already exists: $sku")
}
```

### Benefits

- **Exhaustive `when`**: Kotlin's compiler forces all subtypes to be handled -- adding a new exception subtype produces a compile error in unmatched `when` blocks
- **Domain context**: Each subtype carries structured data (IDs, states) instead of just a message string
- **Module isolation**: Each module owns its error vocabulary without polluting a shared exception package
- **Self-documenting**: The sealed class hierarchy is the definitive list of everything that can go wrong in a module

### Naming Convention

- Sealed class: `{Module}Exception` (e.g., `TransactionException`, `InventoryException`)
- Subtypes: descriptive names (e.g., `NotFound`, `InvalidStateTransition`, `DuplicateSku`)

### Package Placement

Sealed exception classes live in the module's domain layer:

```
{module}/
└── internal/
    └── domain/
        └── {Module}Exception.kt
```

---

## ProblemDetail (RFC 9457)

Use Spring's `ProblemDetail` for all error responses. This replaces custom `ErrorResponse`/`ValidationErrorResponse` wrappers.

```kotlin
val problem = ProblemDetail.forStatusAndDetail(status, ex.message ?: title)
problem.title = title
problem.setProperty("timestamp", Instant.now())
```

### JSON Output

```json
{
  "type": "about:blank",
  "title": "Transaction Not Found",
  "status": 404,
  "detail": "Transaction not found: 3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "instance": "/api/v1/transactions/3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-04-04T10:30:00Z"
}
```

Spring Boot has built-in support for `ProblemDetail` -- it automatically serializes to the RFC 9457 JSON structure and sets the `application/problem+json` content type.

> **Legacy**: Custom `ErrorResponse`/`ValidationErrorResponse` wrappers are still supported but `ProblemDetail` is preferred for new modules.

---

## Module-Specific Exception Handlers

Each module provides a `@RestControllerAdvice` handler at a low `@Order` value to intercept its own sealed exceptions:

```kotlin
// transaction/internal/infrastructure/api/TransactionExceptionHandler.kt
@RestControllerAdvice
@Order(1)
class TransactionExceptionHandler {

    @ExceptionHandler(TransactionException::class)
    fun handle(ex: TransactionException): ResponseEntity<ProblemDetail> {
        val (status, title) = when (ex) {
            is TransactionException.NotFound ->
                HttpStatus.NOT_FOUND to "Transaction Not Found"
            is TransactionException.InvalidStateTransition ->
                HttpStatus.CONFLICT to "Invalid State Transition"
            is TransactionException.InvalidCommand ->
                HttpStatus.BAD_REQUEST to "Invalid Transaction"
        }
        val problem = ProblemDetail.forStatusAndDetail(status, ex.message ?: title)
        problem.title = title
        problem.setProperty("timestamp", Instant.now())
        return ResponseEntity.status(status).body(problem)
    }
}
```

Kotlin's exhaustive `when` on the sealed class ensures every subtype is handled. Adding a new subtype to `TransactionException` will produce a compile error here until the new case is added.

### Handler Placement

```
{module}/
└── internal/
    └── infrastructure/
        └── api/
            └── {Module}ExceptionHandler.kt
```

---

## Global Fallback Handler

A global handler at `@Order(100)` in the shared module catches cross-cutting exceptions that no module-specific handler handles:

```kotlin
// shared/exception/GlobalExceptionHandler.kt
@ControllerAdvice
@Order(100)
class GlobalExceptionHandler : ResponseEntityExceptionHandler() {

    @ExceptionHandler(ObjectOptimisticLockingFailureException::class)
    fun handleOptimisticLock(
        ex: ObjectOptimisticLockingFailureException,
    ): ResponseEntity<ProblemDetail> {
        val problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "Resource was modified by another request. Please retry.",
        )
        problem.title = "Conflict"
        problem.setProperty("timestamp", Instant.now())
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem)
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(
        ex: IllegalArgumentException,
    ): ResponseEntity<ProblemDetail> {
        val problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            ex.message ?: "Invalid request",
        )
        problem.title = "Bad Request"
        problem.setProperty("timestamp", Instant.now())
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem)
    }

    @ExceptionHandler(Exception::class)
    fun handleGeneric(ex: Exception): ResponseEntity<ProblemDetail> {
        val problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "An unexpected error occurred",
        )
        problem.title = "Internal Server Error"
        problem.setProperty("timestamp", Instant.now())
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem)
    }
}
```

Spring's `ResponseEntityExceptionHandler` base class already handles `MethodArgumentNotValidException` (Jakarta validation failures) and returns `ProblemDetail` automatically.

### Handler Ordering

| Order | Handler | Catches |
|-------|---------|---------|
| 1 | `TransactionExceptionHandler` | `TransactionException.*` |
| 2 | `InventoryExceptionHandler` | `InventoryException.*` |
| 3 | `AuthExceptionHandler` | `AuthException.*` |
| 100 | `GlobalExceptionHandler` | `OptimisticLock`, `IllegalArgument`, generic `Exception` |

Lower `@Order` values take precedence. Module handlers always run before the global fallback.

---

## Exception-to-Status Mapping

| Exception | HTTP Status | Source |
|-----------|-------------|--------|
| `{Module}Exception.NotFound` | 404 Not Found | Module handler |
| `{Module}Exception.InvalidStateTransition` | 409 Conflict | Module handler |
| `{Module}Exception.InvalidCommand` | 400 Bad Request | Module handler |
| `{Module}Exception.DuplicateSku` | 409 Conflict | Module handler |
| `{Module}Exception.InsufficientStock` | 422 Unprocessable Entity | Module handler |
| Jakarta validation errors | 400 Bad Request | `ResponseEntityExceptionHandler` |
| `IllegalArgumentException` | 400 Bad Request | Global handler |
| `ObjectOptimisticLockingFailureException` | 409 Conflict | Global handler |
| Unhandled `Exception` | 500 Internal Server Error | Global handler |

---

## Throwing Exceptions

Throw domain exceptions in the service layer -- never in controllers:

```kotlin
@Service
class TransactionService(
    private val repository: TransactionRepository,
) {
    fun getTransaction(id: UUID): Transaction =
        repository.findById(id).orElseThrow {
            TransactionException.NotFound(id)
        }

    fun voidTransaction(id: UUID) {
        val transaction = getTransaction(id)
        transaction.void()  // Throws InvalidStateTransition if not COMPLETED
        repository.save(transaction)
    }
}
```

### Rich Domain Entities with Guarded State Transitions

Entities can enforce invariants and throw domain exceptions directly:

```kotlin
@Entity
class Transaction(/* ... */) : AuditableEntity() {

    fun complete() {
        if (status != TransactionStatus.PENDING) {
            throw TransactionException.InvalidStateTransition(status, "complete")
        }
        status = TransactionStatus.COMPLETED
        completedAt = Instant.now()
    }

    fun void() {
        if (status != TransactionStatus.COMPLETED) {
            throw TransactionException.InvalidStateTransition(status, "void")
        }
        status = TransactionStatus.VOIDED
    }
}
```

---

## Migration from Flat Exceptions

To migrate from the flat `ResourceNotFoundException`/`BusinessException` pattern:

1. **Create sealed class** in each module replacing generic exceptions
2. **Create module handler** at `@Order(1-9)` with exhaustive `when`
3. **Update services** to throw module-specific subtypes instead of generic exceptions
4. **Keep `GlobalExceptionHandler`** at `@Order(100)` as a safety net for unhandled cases
5. **Remove** shared `ResourceNotFoundException`/`BusinessException` once all modules have migrated
