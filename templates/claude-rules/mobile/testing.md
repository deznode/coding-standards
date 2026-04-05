---
paths:
  - shared/**/test/**
  - apps/mobile/**/test/**
---

# Testing

> Full reference: `docs/mobile/06-testing.md`

## Testing Pyramid

Target distribution: **75% unit**, **20% integration**, **5% E2E**.

Unit tests run in `commonTest` and platform test source sets. Integration tests verify module boundaries and database queries. E2E tests cover critical user journeys only.

## Test Frameworks

```kotlin
// commonTest -- kotlin.test for cross-platform
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class MoneyTest {
    @Test
    fun `should reject negative amount`() {
        assertFailsWith<IllegalArgumentException> {
            Money(amount = (-1).toBigDecimal(), currency = Currency.CVE)
        }
    }
}

// androidTest -- JUnit 5 for Android-specific tests
@ExtendWith(MainDispatcherExtension::class)
class DashboardViewModelTest {
    // ...
}
```

Use `kotlin.test` in `commonTest` for maximum portability. Use JUnit 5 only in Android-specific test source sets.

## Flow Testing with Turbine

```kotlin
@Test
fun `should emit loading then content`() = runTest {
    val viewModel = DashboardViewModel(fakeRepository)

    viewModel.uiState.test {
        assertEquals(DashboardUiState(isLoading = true), awaitItem())
        assertEquals(DashboardUiState(items = testItems, isLoading = false), awaitItem())
        cancelAndConsumeRemainingEvents()
    }
}
```

Always use Turbine for `Flow` assertions. Never use `first()` or `toList()` with timeouts.

## Main Dispatcher Rule

Replace `Dispatchers.Main` in tests with `UnconfinedTestDispatcher`. Create a `MainDispatcherExtension` (JUnit 5 `BeforeEachCallback`/`AfterEachCallback`) that calls `Dispatchers.setMain()` and `resetMain()`. Apply with `@ExtendWith(MainDispatcherExtension::class)` on ViewModel tests.

## Robolectric for Fast Android Tests

Use Robolectric for tests needing Android framework classes without an emulator. Annotate with `@RunWith(RobolectricTestRunner::class)` and `@Config(sdk = [35])`. Runs on JVM -- prefer over instrumented tests for speed.

## Compose UI Testing

Use semantic matchers and `testTag` over text matching:

```kotlin
@Test
fun `should show error state`() {
    composeTestRule.setContent {
        DashboardScreen(
            uiState = DashboardUiState(error = "Network error"),
            onAction = {},
        )
    }

    composeTestRule
        .onNodeWithTag("error_message")
        .assertIsDisplayed()
        .assertTextEquals("Network error")

    composeTestRule
        .onNodeWithTag("retry_button")
        .assertIsDisplayed()
        .performClick()
}
```

Apply `testTag` in production code with `Modifier.testTag("error_message")`. Prefer `testTag` over `onNodeWithText` for stability across localization changes.

## Fakes Over Mocks

Write fakes for repository interfaces -- explicit, debuggable, reusable. Implement the interface with in-memory collections and add test helpers (`givenUsers(...)`, `clear()`). Use mocks only when fakes would be impractically complex (e.g., third-party SDK wrappers).

## Test Data with Instancio

Use Instancio to generate realistic test data. Override only the fields relevant to each test:

```kotlin
val testUser = Instancio.of(User::class.java)
    .set(field(User::id), "test-123")
    .create()
```

## Coverage with Kover

Use Kover plugin (`org.jetbrains.kotlinx.kover`) for Kotlin-native coverage. Exclude generated classes (`*_Factory`, `*.BuildConfig`). Run `./gradlew koverHtmlReport` for reports. Set minimum thresholds per module.

## Key Rules

| Rule | Detail |
|------|--------|
| Test distribution | 75% unit / 20% integration / 5% E2E |
| Common tests | `kotlin.test` in `commonTest` for portability |
| Flow assertions | Turbine library, never `first()` with timeouts |
| Dispatcher in tests | `MainDispatcherExtension` with `UnconfinedTestDispatcher` |
| Android unit tests | Robolectric on JVM, not emulator |
| Compose testing | `testTag` over `onNodeWithText` for stability |
| Test doubles | Fakes over mocks; mocks only for complex third-party deps |
| Coverage tool | Kover with per-module thresholds |
