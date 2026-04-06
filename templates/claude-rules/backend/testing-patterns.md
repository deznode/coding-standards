---
paths: apps/api/**
standard_type: aspirational
---

# Testing Patterns

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/backend/06-testing.md`

## Integration Test Setup

```kotlin
@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class ResourceControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var jsonMapper: JsonMapper  // NOT ObjectMapper
    @Autowired private lateinit var repository: ResourceRepository

    @BeforeEach
    fun setup() { repository.deleteAll() }
}
```

## MockMvc Pattern

Chain dots on same line as closing paren (ktlint rule):

```kotlin
mockMvc
    .perform(
        post("/api/v1/resources")
            .with(authAs("user-123"))
            .contentType(MediaType.APPLICATION_JSON)
            .content(jsonMapper.writeValueAsString(request)),
    ).andExpect(status().isCreated)
    .andExpect(jsonPath("$.status").value(201))
    .andExpect(jsonPath("$.data.id").isNotEmpty)
```

## Auth Mocking

```kotlin
private fun authAs(userId: String) =
    authentication(
        UsernamePasswordAuthenticationToken(userId, null, emptyList())
    )

private fun authAsAdmin(userId: String) =
    authentication(
        UsernamePasswordAuthenticationToken(
            userId, null, listOf(SimpleGrantedAuthority("ROLE_ADMIN")),
        )
    )
```

## FK-Safe Cleanup

When tests touch multiple tables, delete in FK-safe order:

```kotlin
@Autowired private lateinit var jdbcTemplate: JdbcTemplate

@BeforeEach
fun cleanup() {
    jdbcTemplate.execute("DELETE FROM child_table")      // Children first
    jdbcTemplate.execute("DELETE FROM event_publication") // Event table
    jdbcTemplate.execute("DELETE FROM parent_table")      // Parents last
}
```

## Testcontainers

In `application-test.yml`:

```yaml
spring:
  datasource:
    url: jdbc:tc:postgresql:16.0:///?TC_DAEMON=true
```

No setup code needed -- Spring Boot auto-configures from `jdbc:tc:` prefix. `TC_DAEMON=true` keeps the container alive across tests.

## MockK + @MockkBean

MockK is the preferred mocking library. Use `springmockk` for `@MockkBean`:

```kotlin
// Unit tests (no Spring context)
private val repository = mockk<ProductRepository>()
private val service = ProductService(repository)

@AfterEach
fun tearDown() = clearAllMocks()

// Integration/slice tests
@MockkBean
private lateinit var externalService: ExternalService

@Test
fun `should call external service`() {
    every { externalService.process(any()) } returns Result.success()
    // ... perform request ...
    verify { externalService.process(any()) }
}
```

Argument capture: `val slot = slot<T>()` + `every { repo.save(capture(slot)) } answers { slot.captured }`

Relaxed mocks: `mockk<EventPublisher>(relaxed = true)` for fire-and-forget deps.

## Test Fixtures

Factory objects with sensible defaults:

```kotlin
object ProductFixtures {
    fun createCommand(
        name: String = "Test Product",
        price: Money = Money.cve("100.00"),
    ) = CreateProductCommand(name = name, price = price)
}
```

Override only what matters for each test case.

## Event Testing

Events run AFTER_COMMIT. Poll for async results:

```kotlin
private fun awaitResult(id: UUID, timeout: Duration = Duration.ofSeconds(10)): Result {
    val deadline = Instant.now().plus(timeout)
    while (Instant.now().isBefore(deadline)) {
        val result = resultRepository.findBySourceId(id)
        if (result != null) return result
        Thread.sleep(100)
    }
    throw AssertionError("Result not found within $timeout")
}
```

## Test Type Summary

| Type | Annotation | Speed |
|------|-----------|-------|
| Integration | `@SpringBootTest` + `@AutoConfigureMockMvc` | Slow |
| Controller slice | `@WebMvcTest` + `@MockkBean` | Fast |
| Repository slice | `@DataJpaTest` + `@ActiveProfiles("test")` | Medium |
| Modularity | Plain JUnit (`ApplicationModules.of(...).verify()`) | Fast |
| Domain unit | Plain JUnit + MockK | Fastest |
