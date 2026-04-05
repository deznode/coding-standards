# Mobile Testing Standards

Testing pyramid, frameworks, and patterns for Android and Kotlin Multiplatform projects.

**Why?** Mobile apps ship to devices where you cannot hotfix. A broken release sits in user hands until the next app store update clears review. The testing strategy must catch regressions before they reach production. Without clear standards for test placement (commonTest vs androidTest), assertion libraries, and Flow/coroutine testing patterns, teams write slow, flaky, duplicated tests that provide false confidence.

---

## Testing Pyramid

Target 75% unit, 20% integration, 5% E2E. Business logic lives in `commonMain` and MUST be tested in `commonTest` -- never duplicated in platform tests.

| Tier | Ratio | Location | Tools | Speed |
|---|---|---|---|---|
| Unit | 75% | `commonTest`, `androidUnitTest` | kotlin.test, JUnit 5, Kotest, Turbine | < 100 ms |
| Integration | 20% | `androidUnitTest` (Robolectric), `androidInstrumentedTest` | Robolectric, Koin Test, in-memory SQLDelight | 100-500 ms |
| E2E / UI | 5% | `androidInstrumentedTest` | Compose UI Test, Espresso | 2-10 s |

### Source Set Mapping

| Source Set | Runs On | Best For |
|---|---|---|
| `commonTest` | All KMP targets (JVM, iOS, native) | Business logic, domain models, use cases |
| `androidUnitTest` | JVM (Robolectric optional) | Android-specific logic, ViewModel, Compose preview |
| `androidInstrumentedTest` | Device / Emulator | Compose UI, real hardware, E2E smoke |
| `iosTest` | iOS Simulator / device | iOS-specific actual implementations |

---

## Unit Testing Frameworks

### kotlin.test for KMP (commonTest)

MUST use `kotlin.test` as the baseline assertion library in `commonTest`. It has zero external dependencies and maps to JUnit on JVM and XCTest on iOS.

```kotlin
// commonTest -- runs on ALL targets
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class MoneyTest {
    @Test
    fun `adding two amounts returns correct sum`() {
        val result = Money(10.0, "EUR") + Money(5.0, "EUR")
        assertEquals(Money(15.0, "EUR"), result)
    }

    @Test
    fun `cannot add different currencies throws exception`() {
        val ex = assertFailsWith<CurrencyMismatchException> {
            Money(10.0, "EUR") + Money(5.0, "USD")
        }
        assertTrue(ex.message!!.contains("EUR"))
    }
}
```

### JUnit 5 for Android Unit Tests

Use JUnit 5 with the `android-junit5` plugin for Android-specific unit tests. JUnit 5 provides parameterized tests, nested test classes, and better lifecycle management.

```kotlin
// build.gradle.kts
plugins {
    id("de.mannodermaus.android-junit5") version "1.11.0"
}

dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.3")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.3")
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.11.3")
}
```

```kotlin
@ParameterizedTest
@CsvSource("100.0, 0.2, 80.0", "200.0, 0.1, 180.0", "50.0, 0.5, 25.0")
fun `apply discount returns correct net price`(
    base: Double, discount: Double, expected: Double
) {
    assertEquals(expected, calculator.applyDiscount(base, discount))
}
```

---

## Assertion Libraries

### Kotest Assertions (Recommended)

SHOULD use Kotest 5.9.1 assertions for fluent, expressive assertions with soft assertion support. Works in both `commonTest` and `androidUnitTest`.

```kotlin
// build.gradle.kts (commonTest)
implementation("io.kotest:kotest-assertions-core:5.9.1")
```

```kotlin
import io.kotest.matchers.shouldBe
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.assertions.assertSoftly

class CartTest {
    @Test
    fun `cart contains correct items after add`() {
        val cart = Cart()
        cart.add(Item("apple", 1.5))
        cart.add(Item("bread", 2.0))

        assertSoftly(cart) {
            items.size shouldBe 2
            total shouldBe 3.5
            items.map { it.name } shouldContainExactly listOf("apple", "bread")
        }
    }
}
```

Use `assertSoftly` when a test checks multiple properties -- it reports all failures at once instead of stopping at the first.

### AssertJ (JVM-only Alternative)

AssertJ provides a fluent API for JVM tests. Use it in `androidUnitTest` when Kotest is not available or when the team prefers a Java-style fluent chain.

```kotlin
import org.assertj.core.api.Assertions.assertThat

assertThat(products).isNotEmpty()
assertThat(products.first().name).isEqualTo("Widget")
```

---

## Flow Testing with Turbine

MUST use Turbine 1.2.0 for testing `Flow` emissions. It provides a structured way to await emissions and verify order.

```kotlin
// build.gradle.kts (commonTest)
implementation("app.cash.turbine:turbine:1.2.0")
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
```

```kotlin
import app.cash.turbine.test

@Test
fun `search emits loading then results`() = runTest {
    val viewModel = SearchViewModel(searchUseCase = fakeUseCase)

    viewModel.uiState.test {
        awaitItem() shouldBe SearchState.Idle

        viewModel.search("kotlin")

        awaitItem() shouldBe SearchState.Loading
        val results = awaitItem()
        results.shouldBeInstanceOf<SearchState.Success>()
        (results as SearchState.Success).items.size shouldBe 3

        cancelAndIgnoreRemainingEvents()
    }
}
```

### Testing Multiple Flows

```kotlin
@Test
fun `cart updates propagate to checkout readiness`() = runTest {
    turbineScope {
        val cartFlow = cart.items.testIn(this)
        val checkoutFlow = checkout.isReady.testIn(this)

        cartFlow.awaitItem()  // initial empty state
        cart.add(TestFixtures.sampleProduct)
        cartFlow.awaitItem().size shouldBe 1
        checkoutFlow.awaitItem() shouldBe true
    }
}
```

---

## Coroutine Testing

### MainDispatcherRule

MUST use a `MainDispatcherRule` to replace `Dispatchers.Main` with a test dispatcher. Without this, ViewModel tests hang or miss emissions.

```kotlin
class MainDispatcherRule(
    val testDispatcher: TestDispatcher = UnconfinedTestDispatcher()
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(testDispatcher)
    }
    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
```

```kotlin
class ProductListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `initial load transitions from Loading to Success`() = runTest {
        val viewModel = ProductListViewModel(fakeProductRepository)

        viewModel.uiState.test {
            awaitItem() shouldBe ProductListState.Loading
            val loaded = awaitItem()
            loaded.shouldBeInstanceOf<ProductListState.Success>()
            cancelAndIgnoreRemainingEvents()
        }
    }
}
```

### Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Forgetting `Dispatchers.setMain` | Tests hang or miss emissions | Use `MainDispatcherRule` |
| `StandardTestDispatcher` without `advanceUntilIdle()` | Emissions never arrive | Call `testScheduler.advanceUntilIdle()` |
| Not cancelling Turbine | Test timeouts | Always `cancelAndIgnoreRemainingEvents()` |
| `runBlocking` in coroutine tests | Deadlocks with `Dispatchers.Main` | Use `runTest` instead |

---

## Robolectric

Use Robolectric 4.13 for fast unit tests that need Android framework classes (Context, SharedPreferences, Room) without a device or emulator. Robolectric tests run on the JVM in 100-500ms versus 2-10s for instrumented tests.

```kotlin
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = TestApplication::class)
class UserDaoRobolectricTest {

    private lateinit var db: AppDatabase
    private lateinit var userDao: UserDao

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        userDao = db.userDao()
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun `insert and retrieve user by id`() = runTest {
        val user = UserEntity(id = 1, name = "Test User", email = "test@example.com")
        userDao.insert(user)
        val found = userDao.findById(1)
        assertThat(found).isEqualTo(user)
    }
}
```

---

## Compose UI Testing

### Semantic Matching

MUST prefer `testTag` and `contentDescription` over text matching for Compose UI tests. Text changes break tests; semantic identifiers are stable.

```kotlin
// In Composable
Button(
    onClick = onSubmit,
    modifier = Modifier.semantics { testTag = "submit_button" }
) {
    Text("Submit Order")
}

// In test
composeTestRule.onNodeWithTag("submit_button")
    .assertIsEnabled()
    .performClick()

composeTestRule.onNodeWithTag("confirmation_dialog")
    .assertIsDisplayed()
```

### ComposeTestRule Example

```kotlin
@RunWith(AndroidJUnit4::class)
class LoginScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `login button is disabled when fields are empty`() {
        composeTestRule.setContent {
            LoginScreen(onLogin = {})
        }

        composeTestRule.onNodeWithText("Sign In")
            .assertIsDisplayed()
            .assertIsNotEnabled()
    }

    @Test
    fun `entering credentials enables login button`() {
        composeTestRule.setContent {
            LoginScreen(onLogin = {})
        }

        composeTestRule.onNodeWithContentDescription("Email field")
            .performTextInput("user@example.com")
        composeTestRule.onNodeWithContentDescription("Password field")
            .performTextInput("secret123")

        composeTestRule.onNodeWithText("Sign In")
            .assertIsEnabled()
    }
}
```

---

## Screenshot Testing

Use Roborazzi for JVM-based, CI-friendly screenshot regression tests. It runs on Robolectric (no emulator needed) and integrates with Compose.

```kotlin
// build.gradle.kts
testImplementation("io.github.takahirom.roborazzi:roborazzi:1.13.0")
testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.13.0")
testImplementation("org.robolectric:robolectric:4.13")
```

```kotlin
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ProductCardScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `product card matches snapshot`() {
        composeTestRule.setContent {
            MaterialTheme {
                ProductCard(product = Product("Widget", 9.99, inStock = true))
            }
        }

        composeTestRule.onRoot()
            .captureRoboImage("snapshots/product_card.png")
    }
}
```

| Tool | Renderer | Speed | CI Friendly |
|---|---|---|---|
| Roborazzi | Robolectric | Fast (JVM) | Yes |
| Paparazzi | LayoutLib | Fast (JVM) | Yes |
| Compose Preview Screenshot | AGP plugin | Medium | Yes |

---

## KMP Shared Test Utilities

### expect/actual for Test Helpers

```kotlin
// commonTest/TestDispatcherProvider.kt
expect fun createTestDispatcher(): TestCoroutineDispatcher

// androidUnitTest/TestDispatcherProvider.android.kt
actual fun createTestDispatcher(): TestCoroutineDispatcher =
    StandardTestDispatcher()

// iosTest/TestDispatcherProvider.ios.kt
actual fun createTestDispatcher(): TestCoroutineDispatcher =
    StandardTestDispatcher()
```

### Shared Test Fixtures

SHOULD define shared fixtures in `commonTest/fixtures/` for reuse across all target tests.

```kotlin
// commonTest/fixtures/TestFixtures.kt
object TestFixtures {
    val sampleUser = User(
        id = UserId("usr-001"),
        name = "Ada Lovelace",
        email = Email("ada@example.com")
    )

    val sampleProduct = Product(
        id = ProductId("prod-001"),
        name = "Widget Pro",
        price = Money(29.99, Currency.EUR),
        stock = 50
    )
}
```

---

## DI Testing with Koin

```kotlin
val testNetworkModule = module {
    single<HttpClient> { createMockHttpClient() }
}

val testDatabaseModule = module {
    single<SqlDriver> {
        JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also { driver ->
            AppDatabase.Schema.create(driver)
        }
    }
}

class CartIntegrationTest : KoinTest {

    @get:Rule
    val koinTestRule = KoinTestRule.create {
        modules(testDatabaseModule, testNetworkModule, cartModule)
    }

    private val cartRepository: CartRepository by inject()

    @Test
    fun `add item persists correctly`() = runTest {
        cartRepository.addItem(TestFixtures.sampleProduct, quantity = 2)
        val items = cartRepository.getItems()
        items.size shouldBe 1
        items.first().quantity shouldBe 2
    }
}
```

---

## Database Testing

Use the JVM JDBC driver for fast in-memory SQLDelight tests without Android dependencies:

```kotlin
// build.gradle.kts (jvmTest / androidUnitTest)
testImplementation("app.cash.sqldelight:sqlite-driver:2.0.2")

fun createInMemoryDriver(): SqlDriver =
    JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).also { driver ->
        AppDatabase.Schema.create(driver)
    }
```

```kotlin
class ProductDatabaseTest {

    private val driver = createInMemoryDriver()
    private val db = AppDatabase(driver)
    private val queries = db.productQueries

    @AfterTest
    fun tearDown() = driver.close()

    @Test
    fun `insert and select product by id`() {
        queries.insertProduct(id = "p1", name = "Widget", price = 9.99, stock = 100)
        val product = queries.selectById("p1").executeAsOne()

        product.name shouldBe "Widget"
        product.price shouldBe 9.99
    }

    @Test
    fun `transaction rolls back on failure`() {
        assertFailsWith<Exception> {
            db.transaction {
                queries.insertProduct("p2", "Gadget", 19.99, 10)
                throw RuntimeException("Simulated failure")
            }
        }
        queries.selectById("p2").executeAsOneOrNull() shouldBe null
    }
}
```

---

## Test Data Generation

SHOULD use Instancio for generating complex object graphs where you only care about a few specific fields. Avoids brittle manual fixture maintenance.

```kotlin
val transaction: Transaction = Instancio.create(Transaction::class.java)
val transactions: List<Transaction> = Instancio.ofList(Transaction::class.java).size(5).create()

// With field overrides
val completed = Instancio.of(Transaction::class.java)
    .set(field(Transaction::status), TransactionStatus.COMPLETED)
    .create()
```

For property-based testing of formatters and validators, SHOULD use jqwik:

```kotlin
@Property
fun `transaction number always matches format`(
    @ForAll @LongRange(min = 1, max = 99999) seqNum: Long
) {
    val number = TransactionNumberFormatter.format(seqNum)
    assertThat(number).matches("TXN-\\d{8}-\\d{5}")
}
```

---

## Fakes Over Mocks

SHOULD prefer fakes (interface + fake implementation) over mocking libraries. Fakes are portable across all KMP targets (mocking libraries are JVM-only), explicit about behaviour, and easier to maintain.

```kotlin
// Interface in commonMain
interface UserRepository {
    suspend fun findById(id: UserId): User?
    suspend fun save(user: User)
}

// Fake in commonTest
class FakeUserRepository : UserRepository {
    private val store = mutableMapOf<UserId, User>()

    override suspend fun findById(id: UserId): User? = store[id]
    override suspend fun save(user: User) { store[user.id] = user }

    fun clear() = store.clear()
}
```

---

## Code Coverage

MUST use Kover 0.9.7 for code coverage in Kotlin projects. Kover correctly handles `inline` functions, `data class` generated methods, and coroutine continuations -- areas where JaCoCo produces false negatives.

```kotlin
// build.gradle.kts
plugins {
    id("org.jetbrains.kotlinx.kover") version "0.9.7"
}

kover {
    reports {
        verify {
            rule {
                minBound(80)
            }
        }
    }
}
```

---

## Test Naming and Structure

| Convention | Rule |
|---|---|
| Test class name | `{ClassName}Test` |
| Test method name | Backtick descriptive name: `` `action produces expected result` `` |
| Test structure | AAA: Arrange, Act, Assert |
| Assertions per test | One logical assertion (or `assertSoftly` for related checks) |
| Test file location | Mirror source structure in test source set |

```kotlin
class LoginUseCaseTest {

    @Test
    fun `valid credentials returns success with token`() {
        // Arrange
        val useCase = LoginUseCase(fakeAuthRepo, fakeTokenStorage)

        // Act
        val result = runBlocking { useCase.execute("user@test.com", "password") }

        // Assert
        result shouldBe LoginResult.Success(token = "abc123")
    }
}
```

---

## Summary

| Rule | Severity | Description |
|---|---|---|
| Business logic in commonTest | MUST | Test shared logic in `commonTest`, never duplicate in platform tests |
| kotlin.test for commonTest | MUST | Zero-dependency baseline for multiplatform assertions |
| Turbine for Flow testing | MUST | Structured emission verification with `awaitItem()` |
| MainDispatcherRule | MUST | Replace `Dispatchers.Main` in all ViewModel tests |
| Semantic matching in Compose tests | MUST | `testTag` / `contentDescription` over text matching |
| Kover for coverage | MUST | JetBrains Kotlin-native coverage (not JaCoCo for pure Kotlin) |
| Backtick test method names | MUST | Descriptive names with AAA structure |
| Kotest assertSoftly | SHOULD | Report all failures at once for multi-property checks |
| Robolectric for integration | SHOULD | 100-500ms vs 2-10s for instrumented tests |
| Roborazzi for screenshots | SHOULD | JVM-based, CI-friendly screenshot regression |
| Fakes over mocks | SHOULD | Portable across KMP targets, explicit behaviour |
| Instancio for test data | SHOULD | Avoid brittle manual fixtures for complex object graphs |
| jqwik for property testing | MAY | Formatters, validators, and boundary conditions |
| JUnit 5 for Android unit tests | MAY | Parameterized tests, nested classes, better lifecycle |
