# Testing Strategy

Testing philosophy and approach for solo/small-team full-stack projects. The strategy emphasizes comprehensive local testing with lean CI/CD, favoring integration tests over unit test coverage metrics.

---

## Philosophy

- **Integration tests as primary strategy**: Real database queries catch more bugs than mocked unit tests.
- **Lean CI/CD**: Automate what catches real problems (lint, typecheck, build). Save expensive tests for local pre-release validation.
- **Solo/small-team pragmatism**: Invest testing effort where it has the highest ROI. Do not chase 100% coverage -- chase confidence.
- **Pre-commit hooks as first gate**: Catch formatting, style, and secret issues before they enter the repository.

---

## Backend Testing

### Integration Tests (`@SpringBootTest`)

The primary backend testing strategy. Full application context with real database via Testcontainers:

```kotlin
@SpringBootTest
@Transactional
class OrderServiceTest {

    @Autowired
    lateinit var orderService: OrderService

    @Test
    fun `should create order and publish event`() {
        val request = CreateOrderRequest(/* ... */)
        val result = orderService.createOrder(request)
        assertThat(result.status).isEqualTo(OrderStatus.PLACED)
    }
}
```

**Testcontainers** provides disposable PostgreSQL containers for each test run. No shared test database, no flaky tests from leftover state:

```kotlin
@TestConfiguration
class TestcontainersConfig {

    @Bean
    @ServiceConnection
    fun postgres() = PostgreSQLContainer("postgres:17-alpine")
}
```

### Slice Tests

Focused tests that load only a slice of the Spring context:

| Annotation | Purpose | When to Use |
|-----------|---------|-------------|
| `@WebMvcTest` | Controller layer only | Testing HTTP request/response mapping, validation |
| `@DataJpaTest` | JPA repositories only | Testing custom queries, specifications |

```kotlin
@WebMvcTest(OrderController::class)
class OrderControllerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockBean
    lateinit var orderService: OrderService

    @Test
    fun `should return 400 for invalid request`() {
        mockMvc.post("/api/v1/orders") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"quantity": -1}"""
        }.andExpect {
            status { isBadRequest() }
        }
    }
}
```

### Modularity Tests

Verify Spring Modulith module boundaries are not violated:

```kotlin
class ModularityTests {

    @Test
    fun `verify module boundaries`() {
        ApplicationModules.of(Application::class.java).verify()
    }

    @Test
    fun `generate module documentation`() {
        ApplicationModules.of(Application::class.java)
            .generateDocumentation()
    }
}
```

`verify()` catches:
- Circular dependencies between modules
- Access to `internal/` packages from outside the module
- Invalid declared dependencies

---

## Frontend Testing

### CI/CD Quality Gates (Automated)

These run in CI on every push and as pre-commit hooks locally:

```bash
# TypeScript type checking -- catches type errors across the codebase
npx tsc --noEmit

# ESLint -- enforces code quality and import ordering
pnpm run lint

# Production build -- catches build-time errors (broken imports, missing env vars)
pnpm run build
```

This is the **lean approach**: TypeScript + ESLint + build verification catches the majority of frontend bugs without dedicated test infrastructure.

### Unit Tests (Vitest)

For testing business logic, stores, and hooks in isolation:

```bash
pnpm run test:unit
```

Focus unit tests on:
- **State stores** (Zustand): State transitions, computed values
- **Custom hooks**: Complex logic, edge cases
- **Utility functions**: Data transformations, formatting
- **Validation logic**: Form validators, schema checks

Do not unit-test:
- Simple components that are just layout/markup
- Direct wrappers around library components
- Anything where the test would just re-implement the component

### E2E Tests (Playwright)

For local pre-release validation of critical user flows:

```bash
pnpm run test:e2e
```

Focus E2E tests on:
- Authentication flows (login, logout, session)
- Primary user journeys (create, edit, delete resources)
- Payment/checkout flows (if applicable)
- Cross-page navigation and data persistence

E2E tests run locally before releases, not in CI (to keep CI fast and avoid flaky browser tests in containers).

---

## Verification Tiers

Structured approach to verification with escalating confidence levels:

| Tier | What it Checks | Commands | When to Use |
|------|---------------|----------|-------------|
| `build` | Lint, typecheck, tests, compilation | `task test` | Every commit (default) |
| `visual` | UI renders correctly | Start dev server, take screenshots | After visual changes |
| `api` | Endpoints return expected responses | Start server, `curl` endpoints | After API changes |
| `e2e` | Full user flows work end-to-end | Start dev server, run Playwright | Before releases |

### Tier Commands

**Build tier** (default, runs in CI):

```bash
# Backend
cd apps/api && ./gradlew test

# Frontend
cd apps/web && pnpm run lint
cd apps/web && npx tsc --noEmit
cd apps/web && pnpm run test:unit
```

**Visual tier** (local, after UI changes):

```bash
cd apps/web && pnpm run dev
# Open pages in browser, verify rendering
# Take screenshots of key pages
```

**API tier** (local, after endpoint changes):

```bash
cd apps/api && ./gradlew bootRun --args='--spring.profiles.active=local'
# Verify endpoints
curl -s http://localhost:8080/api/v1/health | jq .
curl -s http://localhost:8080/api/v1/resources | jq .
```

**E2E tier** (local, before release):

```bash
cd apps/web && pnpm run dev
cd apps/web && pnpm run test:e2e
```

---

## Testing Commands Summary

| Command | Scope | What Runs |
|---------|-------|-----------|
| `task test` | All | Backend tests + frontend lint/typecheck/unit |
| `task test:api` | Backend | `./gradlew test` (Testcontainers) |
| `task test:web` | Frontend | ESLint + tsc + Vitest |
| `task lint` | All | ktlint + ESLint |
| `task lint:api` | Backend | `./gradlew ktlintCheck` |
| `task lint:web` | Frontend | `pnpm run lint` |

---

## Pre-Release Checklist

Before deploying a new release:

- [ ] All CI checks pass (lint, typecheck, build)
- [ ] `task test` passes locally
- [ ] E2E tests pass on key user flows
- [ ] Manual visual review on mobile viewport (iOS Safari, Android Chrome)
- [ ] No new secrets or credentials in committed files
- [ ] Database migrations are backward-compatible (if applicable)

---

## Anti-Patterns to Avoid

| Anti-Pattern | Better Approach |
|-------------|----------------|
| Mocking everything in backend tests | Use `@SpringBootTest` with Testcontainers for real database |
| Unit testing every React component | Test interactive behavior, not markup |
| Running E2E tests in CI | Run locally before release; keep CI fast |
| Chasing 100% code coverage | Focus on integration tests for critical paths |
| Shared test databases | Testcontainers provides isolated, disposable instances |
| Skipping type checking | `npx tsc --noEmit` in CI catches an entire class of bugs for free |
