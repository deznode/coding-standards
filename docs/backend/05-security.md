# Security & Authentication

Security patterns for Spring Boot APIs with JWT authentication, rate limiting, and authorization.

---

## Error Handling

See [Error Handling & Exception Design](07-error-handling.md) for sealed exception hierarchies, ProblemDetail (RFC 9457) responses, and ordered `@ControllerAdvice` handlers.

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
