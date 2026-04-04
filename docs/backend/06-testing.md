# Backend Testing

Testing patterns for Spring Boot backends with integration tests, MockMvc, Testcontainers, and module boundary verification.

---

## Integration Test Setup

Every integration test uses this annotation trio:

```kotlin
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class ProductControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var jsonMapper: JsonMapper  // NOT ObjectMapper (Jackson 3.x)

    @Autowired
    private lateinit var productRepository: ProductRepository
}
```

**Important**: Use `JsonMapper` (Jackson 3.x) not `ObjectMapper` for serialization in tests.

---

## Test Class Structure

```kotlin
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class OrderControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var jsonMapper: JsonMapper
    @Autowired private lateinit var orderRepository: OrderRepository

    @BeforeEach
    fun setup() {
        orderRepository.deleteAll()
    }

    @Test
    @DisplayName("POST /api/v1/orders - Valid order should return 201 Created")
    fun `createOrder with valid data should return 201`() {
        val request = CreateOrderRequest(
            customerId = UUID.randomUUID(),
            items = listOf(OrderItemRequest(productId = UUID.randomUUID(), quantity = 2)),
        )

        mockMvc
            .perform(
                post("/api/v1/orders")
                    .with(authAs("user-123"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(jsonMapper.writeValueAsString(request)),
            ).andExpect(status().isCreated)
            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.status").value(201))
            .andExpect(jsonPath("$.data.id").isNotEmpty)
    }
}
```

---

## MockMvc Patterns

**Chain dots must be on the same line as the closing paren** (ktlint rule):

```kotlin
mockMvc
    .perform(
        post("/api/v1/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .content(jsonMapper.writeValueAsString(dto))
            .header("X-Forwarded-For", "192.168.1.100"),
    ).andExpect(status().isCreated)
    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
    .andExpect(jsonPath("$.status").value(201))
    .andExpect(jsonPath("$.data.id").isNotEmpty)
```

### Common Assertions

```kotlin
// Status codes
.andExpect(status().isOk)
.andExpect(status().isCreated)
.andExpect(status().isNoContent)
.andExpect(status().isBadRequest)
.andExpect(status().isNotFound)

// JSON path assertions
.andExpect(jsonPath("$.data.name").value("Product A"))
.andExpect(jsonPath("$.data.id").isNotEmpty)
.andExpect(jsonPath("$.data.items").isArray)
.andExpect(jsonPath("$.data.items.length()").value(3))
.andExpect(jsonPath("$.status").value(200))

// Content type
.andExpect(content().contentType(MediaType.APPLICATION_JSON))
```

---

## Auth Mocking

Use Spring Security's mock authentication for protected endpoints:

```kotlin
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken

private fun authAs(userId: String) =
    authentication(
        UsernamePasswordAuthenticationToken(userId, null, emptyList())
    )

// Usage in tests:
mockMvc
    .perform(
        post("/api/v1/orders")
            .with(authAs("user-123"))
            .contentType(MediaType.APPLICATION_JSON)
            .content(jsonMapper.writeValueAsString(dto)),
    ).andExpect(status().isCreated)
```

### Testing Admin Endpoints

```kotlin
private fun authAsAdmin(userId: String) =
    authentication(
        UsernamePasswordAuthenticationToken(
            userId,
            null,
            listOf(SimpleGrantedAuthority("ROLE_ADMIN")),
        )
    )

// Usage:
mockMvc
    .perform(
        delete("/api/v1/admin/products/${productId}")
            .with(authAsAdmin("admin-456")),
    ).andExpect(status().isNoContent)
```

---

## FK-Safe Cleanup

When tests touch multiple tables, delete in FK-safe order in `@BeforeEach`:

```kotlin
@Autowired private lateinit var jdbcTemplate: JdbcTemplate

@BeforeEach
fun cleanup() {
    // Child tables first (tables with foreign keys)
    jdbcTemplate.execute("DELETE FROM order_items")
    jdbcTemplate.execute("DELETE FROM notifications")
    // Event publication table
    jdbcTemplate.execute("DELETE FROM event_publication")
    // Parent tables last
    jdbcTemplate.execute("DELETE FROM orders")
    jdbcTemplate.execute("DELETE FROM products")
}
```

---

## Testcontainers

Connection string in `application-test.yml`:

```yaml
spring:
  datasource:
    url: jdbc:tc:postgresql:16.0:///?TC_DAEMON=true
```

No additional setup needed -- Spring Boot auto-configures Testcontainers from the `jdbc:tc:` prefix. The `TC_DAEMON=true` flag keeps the container alive across tests for faster execution.

---

## MockK (Preferred Mocking Library)

**Why MockK over Mockito?** MockK is the idiomatic Kotlin mocking library with first-class support for coroutines, extension functions, and Kotlin-specific features like `object` singletons. The `springmockk` library provides `@MockkBean` as a drop-in replacement for `@MockitoBean`.

### Basic Setup (Unit Tests -- No Spring Context)

```kotlin
class OrderServiceTest {
    private val orderRepository = mockk<OrderRepository>()
    private val eventPublisher = mockk<ApplicationEventPublisher>(relaxed = true)
    private val service = OrderService(orderRepository, eventPublisher)

    @AfterEach
    fun tearDown() = clearAllMocks()
}
```

### @MockkBean (Integration / Slice Tests)

`@MockkBean` replaces all matching beans in the Spring context:

```kotlin
@MockkBean
private lateinit var paymentGateway: PaymentGateway

@MockkBean
private lateinit var emailService: EmailService
```

### Stubbing and Verification

```kotlin
// Stubbing
every { paymentGateway.charge(any()) } returns PaymentResult.success()
every { repository.findById(any()) } returns Optional.of(product)

// Verification
verify { emailService.sendOrderConfirmation(any()) }
verify(exactly = 1) { repository.save(any()) }
```

### Argument Capture with slot<T>()

```kotlin
val userSlot = slot<AppUser>()
every { userRepository.save(capture(userSlot)) } answers { userSlot.captured }

// After the call:
assertThat(userSlot.captured.email).isEqualTo("test@example.com")
assertThat(userSlot.captured.role).isEqualTo(Role.OWNER)
```

### Relaxed Mocks

Use `relaxed = true` for fire-and-forget dependencies like event publishers:

```kotlin
private val eventPublisher = mockk<ApplicationEventPublisher>(relaxed = true)
```

Relaxed mocks return sensible defaults for all calls without requiring `every { }` stubs.

### Full Integration Test Example

```kotlin
@Test
fun `createOrder should send confirmation email`() {
    every { paymentGateway.charge(any()) } returns PaymentResult.success()

    mockMvc
        .perform(
            post("/api/v1/orders")
                .with(authAs("user-123"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)),
        ).andExpect(status().isCreated)

    verify { emailService.sendOrderConfirmation(any()) }
}
```

### Mockito to MockK Migration Reference

| Concept | Mockito | MockK |
|---------|---------|-------|
| Mock creation | `mock<T>()` | `mockk<T>()` |
| Spring bean mock | `@MockitoBean` | `@MockkBean` |
| Stubbing | `whenever(x).thenReturn(y)` | `every { x } returns y` |
| Verification | `verify(x).method()` | `verify { x.method() }` |
| Argument capture | `ArgumentCaptor<T>` | `slot<T>()` + `capture()` |
| Cleanup | `@ExtendWith(MockitoExtension)` | `clearAllMocks()` in `@AfterEach` |
| Any argument | `any()` | `any()` |
| Fire-and-forget mock | N/A | `mockk<T>(relaxed = true)` |

---

## Test Fixtures

**Why fixtures?** Test fixture objects provide factory methods with sensible defaults, reducing boilerplate and making test setup declarative. Override only the parameters relevant to each test case.

### Naming Convention

`object {Module}Fixtures` as a Kotlin singleton in `src/test/kotlin/{module}/fixtures/`:

```kotlin
// test/kotlin/transaction/fixtures/TransactionFixtures.kt
object TransactionFixtures {

    fun itemCommand(
        productId: UUID = UUID.randomUUID(),
        quantity: Int = 1,
        unitPrice: Money = Money.cve("100.00"),
        taxRate: BigDecimal = BigDecimal("0.1500"),
        discount: Money = Money.ZERO_CVE,
    ) = CreateItemCommand(
        productId = productId,
        quantity = quantity,
        unitPrice = unitPrice,
        taxRate = taxRate,
        discount = discount,
    )

    fun createCommand(
        type: TransactionType = TransactionType.SALE,
        items: List<CreateItemCommand> = listOf(itemCommand()),
    ) = CreateTransactionCommand(
        type = type,
        items = items,
    )
}
```

### Usage in Tests

Override only what matters for each test case:

```kotlin
@Test
fun `should calculate total for multi-item transaction`() {
    val command = TransactionFixtures.createCommand(
        items = listOf(
            TransactionFixtures.itemCommand(quantity = 3, unitPrice = Money.cve("50.00")),
            TransactionFixtures.itemCommand(quantity = 1, unitPrice = Money.cve("200.00")),
        ),
    )
    val result = service.create(command)
    assertThat(result.subtotal).isEqualTo(Money.cve("350.00"))
}
```

---

## Event Testing

`@ApplicationModuleListener` events run **AFTER** the publishing transaction commits (AFTER_COMMIT phase). In `@SpringBootTest`, events process asynchronously -- poll for results:

```kotlin
private fun awaitResult(
    id: UUID,
    timeout: Duration = Duration.ofSeconds(10),
): ProcessingResult {
    val deadline = Instant.now().plus(timeout)
    while (Instant.now().isBefore(deadline)) {
        val result = resultRepository.findBySourceId(id)
        if (result != null) return result
        Thread.sleep(100)
    }
    throw AssertionError("Result not found within $timeout for ID $id")
}

@Test
fun `placing order should trigger notification event`() {
    // Create order (triggers OrderPlacedEvent)
    val orderId = service.placeOrder(request).id

    // Poll for async event processing result
    val notification = awaitResult(orderId)
    assertThat(notification.type).isEqualTo("ORDER_CONFIRMATION")
}
```

---

## Modularity Tests

Verify module boundaries and generate architecture documentation:

```kotlin
class ModularityTests {

    @Test
    fun `verify module boundaries`() {
        ApplicationModules.of(Application::class.java).verify()
    }

    @Test
    fun `generate module documentation`() {
        ApplicationModules.of(Application::class.java)
            .generateDocumentation()  // Produces PlantUML diagrams
    }
}
```

`verify()` enforces:
- No circular dependencies between modules
- No access to `internal/` packages from outside the module
- All declared `allowedDependencies` are valid

---

## Slice Tests

Use slice test annotations for focused, faster tests:

### @WebMvcTest (Controller Layer)

```kotlin
@WebMvcTest(ProductController::class)
class ProductControllerSliceTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockkBean
    private lateinit var productService: ProductService

    @AfterEach
    fun tearDown() = clearAllMocks()

    @Test
    fun `getById should return product`() {
        val product = ProductDto(id = UUID.randomUUID(), name = "Test Product")
        every { productService.getById(product.id) } returns product

        mockMvc
            .perform(
                get("/api/v1/products/${product.id}"),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.name").value("Test Product"))
    }
}
```

### @DataJpaTest (Repository Layer)

```kotlin
@DataJpaTest
@ActiveProfiles("test")
class ProductRepositoryTest {
    @Autowired
    private lateinit var repository: ProductRepository

    @Autowired
    private lateinit var entityManager: TestEntityManager

    @Test
    fun `findBySlug should return matching product`() {
        val product = Product().apply {
            name = "Test Product"
            slug = "test-product"
        }
        entityManager.persistAndFlush(product)

        val found = repository.findBySlug("test-product")
        assertThat(found).isNotNull
        assertThat(found!!.name).isEqualTo("Test Product")
    }
}
```

---

## Domain Unit Tests

Pure Kotlin tests with no Spring context. Use MockK for dependencies and direct constructor injection:

```kotlin
class ProductServiceTest {
    private val repository = mockk<ProductRepository>()
    private val eventPublisher = mockk<ApplicationEventPublisher>(relaxed = true)
    private val service = ProductService(repository, eventPublisher)

    @AfterEach
    fun tearDown() = clearAllMocks()

    @Test
    fun `should create product from command`() {
        val command = ProductFixtures.createCommand(name = "Test Product")
        val productSlot = slot<Product>()
        every { repository.save(capture(productSlot)) } answers { productSlot.captured }

        val result = service.create(command)

        assertThat(result.name).isEqualTo("Test Product")
        verify { repository.save(any()) }
    }

    @Test
    fun `should throw NotFound for missing product`() {
        every { repository.findById(any()) } returns Optional.empty()

        assertThatThrownBy { service.getProduct(UUID.randomUUID()) }
            .isInstanceOf(ProductException.NotFound::class.java)
    }
}
```

Domain entity tests need no mocking at all:

```kotlin
class TransactionTest {

    @Test
    fun `void should reject PENDING transactions`() {
        val transaction = TransactionFixtures.pendingTransaction()

        assertThatThrownBy { transaction.void() }
            .isInstanceOf(TransactionException.InvalidStateTransition::class.java)
            .hasMessageContaining("void")
    }
}
```

---

## Test Organization Summary

| Test Type | Annotation | Scope | Speed |
|-----------|-----------|-------|-------|
| Integration | `@SpringBootTest` + `@AutoConfigureMockMvc` | Full application context | Slow |
| Controller slice | `@WebMvcTest` + `@MockkBean` | Controller + MockMvc only | Fast |
| Repository slice | `@DataJpaTest` | JPA + Testcontainers only | Medium |
| Modularity | Plain JUnit | Module boundary verification | Fast |
| Domain unit | Plain JUnit + MockK | Single service + mocked deps | Fastest |
| Entity unit | Plain JUnit | Domain entity logic | Fastest |
