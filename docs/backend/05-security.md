# Security & Authentication

Security patterns for Spring Boot APIs with JWT authentication, exception handling, rate limiting, and authorization.

**Why a standardized exception hierarchy?** Mapping domain exceptions to specific HTTP status codes ensures frontend clients receive consistent, predictable error responses. A `@ControllerAdvice` handler centralizes this mapping, preventing ad-hoc error handling in individual controllers and making error responses uniform across all endpoints.

---

## Exception Hierarchy

| Exception | HTTP Status | Use Case |
|-----------|------------|----------|
| Validation errors (Jakarta) | 400 Bad Request | `@Valid` bean validation failures |
| `IllegalArgumentException` | 400 Bad Request | Invalid parameter values |
| `ResourceNotFoundException` | 404 Not Found | Entity not found by ID/slug |
| `BusinessException` | 422 Unprocessable Entity | Business rule violations |
| `RateLimitExceededException` | 429 Too Many Requests | Rate limit exceeded |

### Throwing Exceptions

```kotlin
// Service layer -- throw domain-specific exceptions
throw ResourceNotFoundException("Product with ID '$id' not found.")
throw BusinessException("Cannot ship order without a delivery address")
throw RateLimitExceededException("Rate limit exceeded. Please try again later.")
```

`GlobalExceptionHandler` (annotated with `@ControllerAdvice`) converts these to consistent error responses.

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

### Exception to Response Mapping

| Exception | HTTP Status | Response Type |
|-----------|-------------|---------------|
| `ResourceNotFoundException` | 404 | `ErrorResponse` |
| `BusinessException` | 422 | `ErrorResponse` |
| `RateLimitExceededException` | 429 | `ErrorResponse` |
| `MethodArgumentNotValidException` | 400 | `ValidationErrorResponse` |
| `IllegalArgumentException` | 400 | `ErrorResponse` |

> **Alternative**: RFC 9457 `ProblemDetail` can be used as an alternative error format. Spring Boot provides built-in support via `ProblemDetail` class.

---

## JWT Authentication

### Security Configuration

Configure JWT validation with a configurable JWK set URI, stateless sessions:

```kotlin
@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtAuthenticationConverter: JwtAuthenticationConverter,
) {
    @Value("\${security.jwt.jwk-set-uri}")
    private lateinit var jwkSetUri: String

    @Value("\${security.jwt.issuer-uri}")
    private lateinit var issuerUri: String

    @Bean
    fun jwtDecoder(): JwtDecoder {
        val jwtDecoder = NimbusJwtDecoder
            .withJwkSetUri(jwkSetUri)
            .jwsAlgorithm(SignatureAlgorithm.ES256)
            .build()
        jwtDecoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuerUri))
        return jwtDecoder
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .authorizeHttpRequests { requests ->
                requests
                    // Public endpoints
                    .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/v1/categories/**").permitAll()
                    .requestMatchers("/api/v1/public/**").permitAll()
                    // Admin endpoints
                    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                    // Everything else requires authentication
                    .anyRequest().authenticated()
            }
            .sessionManagement {
                it.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            }
            .oauth2ResourceServer { oauth2 ->
                oauth2.jwt { jwt ->
                    jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)
                }
            }
        return http.build()
    }
}
```

### Application Properties

```yaml
security:
  jwt:
    jwk-set-uri: ${JWT_JWK_SET_URI}   # e.g., https://auth.example.com/.well-known/jwks.json
    issuer-uri: ${JWT_ISSUER_URI}      # e.g., https://auth.example.com
```

---

## Authorization Levels

| Endpoint Pattern | Access Level |
|-----------------|--------------|
| `GET /api/v1/products/**` | Public |
| `GET /api/v1/categories/**` | Public |
| `/api/v1/public/**` | Public |
| `POST /api/v1/orders/**` | Authenticated (USER, ADMIN) |
| `PUT /api/v1/users/me/**` | Authenticated (USER, ADMIN) |
| `/api/v1/admin/**` | ADMIN only |

---

## Auth Extraction in Controllers

### Via Spring Security Authentication

```kotlin
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
fun createOrder(
    @Valid @RequestBody request: CreateOrderRequest,
    authentication: Authentication,
    httpRequest: HttpServletRequest,
): ApiResult<OrderDto> {
    val userId = authentication.name  // User ID from JWT
    val ipAddress = extractClientIp(httpRequest)
    return ApiResult(
        data = service.createOrder(userId, request),
        status = HttpStatus.CREATED.value(),
    )
}
```

### Via Request Extension Function

Define a reusable extension for extracting the authenticated user ID:

```kotlin
// shared/util/RequestExtensions.kt
fun HttpServletRequest.requireUserId(): UUID {
    val principal = this.userPrincipal
        ?: throw UnauthorizedException("Authentication required")
    return UUID.fromString(principal.name)
}
```

Usage in controllers:

```kotlin
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
fun createOrder(
    @Valid @RequestBody request: CreateOrderRequest,
    httpRequest: HttpServletRequest,
): ApiResult<OrderDto> {
    val userId = httpRequest.requireUserId()
    return ApiResult(
        data = service.createOrder(userId, request),
        status = HttpStatus.CREATED.value(),
    )
}
```

### IP Address Extraction

Centralize IP extraction for rate limiting and audit logging:

```kotlin
// shared/util/RequestUtils.kt
fun extractClientIp(request: HttpServletRequest): String {
    return request.getHeader("X-Forwarded-For")?.split(",")?.first()?.trim()
        ?: request.remoteAddr
}
```

---

## Rate Limiting

Uses Bucket4j token bucket with Caffeine per-user cache:

```kotlin
@Service
class RateLimitService {
    private val rateLimitBuckets: Cache<String, Bucket> = Caffeine
        .newBuilder()
        .maximumSize(10_000)
        .expireAfterAccess(1, TimeUnit.HOURS)
        .build()

    fun checkRateLimit(key: String) {
        val bucket = rateLimitBuckets.get(key) { createBucket() }
        if (!bucket.tryConsume(1)) {
            throw RateLimitExceededException("Rate limit exceeded")
        }
    }

    private fun createBucket(): Bucket {
        val limit = Bandwidth.builder()
            .capacity(10)
            .refillGreedy(10, Duration.ofMinutes(1))
            .build()
        return Bucket.builder()
            .addLimit(limit)
            .build()
    }
}
```

Usage in services:

```kotlin
@Service
class OrderService(
    private val rateLimitService: RateLimitService,
) {
    fun submitOrder(userId: String, request: CreateOrderRequest): OrderDto {
        rateLimitService.checkRateLimit("order:submit:$userId")
        // ... process order
    }
}
```
