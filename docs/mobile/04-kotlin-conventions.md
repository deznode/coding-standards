# Kotlin Multiplatform Conventions

Conventions and patterns for writing shared Kotlin code in a KMP project targeting Android and iOS.

**Why?** Kotlin Multiplatform enables sharing business logic, networking, and data layers across Android and iOS while preserving native UI. Without clear conventions for expect/actual boundaries, DI wiring, and naming, shared modules drift into platform-specific tangles that defeat the purpose of KMP. These rules keep the shared layer clean, testable, and portable.

---

## expect/actual Boundaries

Reserve `expect/actual` for small platform utilities where no common interface exists. For anything with real dependencies or that needs to be mocked in tests, prefer an interface in `commonMain` with platform implementations wired through DI.

### Decision Matrix

| Scenario | Approach |
|---|---|
| Small utility functions (UUID, timestamp) | `expect/actual` |
| Database driver creation | `expect/actual` factory function |
| HTTP engine selection | `expect/actual` or platform DI module |
| Platform APIs with no common interface | `expect/actual` |
| Swappable services (testing, mocking) | Interface + DI |
| Complex services with multiple dependencies | Interface + DI |

### Platform Utilities

```kotlin
// commonMain
expect fun randomUUID(): String
expect fun currentTimeMillis(): Long
```

```kotlin
// androidMain
actual fun randomUUID(): String = java.util.UUID.randomUUID().toString()
actual fun currentTimeMillis(): Long = System.currentTimeMillis()
```

```kotlin
// iosMain
actual fun randomUUID(): String = NSUUID().UUIDString()
actual fun currentTimeMillis(): Long =
    (NSDate().timeIntervalSince1970 * 1000).toLong()
```

### Factory Pattern for Drivers

Use `expect/actual` factory functions when the creation mechanism differs per platform but the resulting type is shared:

```kotlin
// commonMain
expect fun createSqlDriver(
    schema: SqlSchema<QueryResult.AsyncValue<Unit>>,
    name: String
): SqlDriver

// commonMain -- DI module consumes the factory
val databaseModule = module {
    single { createSqlDriver(AppDatabase.Schema, "app.db") }
    single { AppDatabase(get()) }
}
```

```kotlin
// androidMain
actual fun createSqlDriver(
    schema: SqlSchema<QueryResult.AsyncValue<Unit>>,
    name: String
): SqlDriver = AndroidSqliteDriver(schema, get(), name)

// iosMain
actual fun createSqlDriver(
    schema: SqlSchema<QueryResult.AsyncValue<Unit>>,
    name: String
): SqlDriver = NativeSqliteDriver(schema, name)

// jvmMain (tests / backend)
actual fun createSqlDriver(
    schema: SqlSchema<QueryResult.AsyncValue<Unit>>,
    name: String
): SqlDriver = JdbcSqliteDriver("jdbc:sqlite:$name").also {
    schema.create(it).await()
}
```

### Interface + DI for Services

When a component has dependencies, needs to be testable, or may have significantly different implementations per platform, use an interface in `commonMain` and inject platform implementations:

```kotlin
// commonMain -- interface
interface FileStorage {
    suspend fun read(path: String): ByteArray?
    suspend fun write(path: String, data: ByteArray)
    suspend fun delete(path: String)
}

// commonMain -- use case consumes the interface
class SyncUseCase(
    private val fileStorage: FileStorage,
    private val api: SyncApi
) {
    suspend fun sync(): Result<Unit> = runCatching {
        val data = api.fetchLatest()
        fileStorage.write("sync_cache.json", data)
    }
}
```

```kotlin
// androidMain
class AndroidFileStorage(private val context: Context) : FileStorage {
    override suspend fun read(path: String): ByteArray? =
        withContext(Dispatchers.IO) {
            context.filesDir.resolve(path).takeIf { it.exists() }?.readBytes()
        }
    // ...
}

val androidStorageModule = module {
    single<FileStorage> { AndroidFileStorage(get()) }
}
```

---

## File Naming

| Source Set | Pattern | Example |
|---|---|---|
| `commonMain` | `{Name}.kt` | `UserRepository.kt` |
| `androidMain` | `{Name}.android.kt` | `FileStorage.android.kt` |
| `iosMain` | `{Name}.ios.kt` | `FileStorage.ios.kt` |
| `jvmMain` | `{Name}.jvm.kt` | `SqlDriver.jvm.kt` |

MUST use the platform suffix convention for expect/actual implementation files. This enables IDE navigation and makes the platform source set obvious at a glance.

---

## Dependency Injection with Koin 4.x

Define DI modules in `commonMain` using standard Koin scoping functions. Platform-specific modules extend the shared graph.

### Module Naming Convention

| Module | Contents |
|---|---|
| `domainModule` | Use cases, interactors |
| `networkModule` | HTTP client, API service implementations |
| `dataModule` | Database driver, database instance, repository implementations |
| `viewModelModule` | Shared ViewModels |

### Module Definitions

```kotlin
// commonMain
val domainModule = module {
    factory { LoginUseCase(get(), get()) }
    factory { GetUsersUseCase(get()) }
    factory { SyncUseCase(get(), get()) }
}

val networkModule = module {
    single { HttpClientFactory.create(get()) }
    single<UserApi> { UserApiImpl(get(), get()) }
    single<AuthApi> { AuthApiImpl(get()) }
}

val dataModule = module {
    single { createSqlDriver(AppDatabase.Schema, "app.db") }
    single { AppDatabase(get()) }
    single<UserRepository> { UserRepositoryImpl(get(), get(), get()) }
}

val viewModelModule = module {
    viewModel { DashboardViewModel(get(), get()) }
    viewModel { (userId: String) -> UserDetailViewModel(userId, get()) }
}
```

### Koin Scoping Functions

| Function | Lifecycle | Use For |
|---|---|---|
| `single{}` | Singleton (app lifetime) | HTTP client, database, repositories |
| `factory{}` | New instance per injection | Use cases, mappers |
| `viewModel{}` | ViewModel-scoped (survives rotation) | Screen ViewModels |
| `scoped<T>{}` | Custom scope lifetime | Feature-scoped services |

### Platform Initialization

```kotlin
// androidMain
fun initKoin(context: Context) = startKoin {
    androidContext(context)
    androidLogger(Level.DEBUG)
    modules(SharedModules.all + androidPlatformModule)
}

// iosMain (called from Swift)
fun initKoin() = startKoin {
    modules(SharedModules.all + iosPlatformModule)
}
```

---

## Serialization

MUST annotate all DTOs and domain models that cross serialization boundaries with `@Serializable` from kotlinx-serialization. This is the only serialization library that works across all KMP targets.

```kotlin
@Serializable
data class UserDto(
    val id: String,
    val name: String,
    val email: String,
    @SerialName("created_at")
    val createdAt: Long,
    val roles: List<String> = emptyList()
)

// Polymorphic sealed class serialization
@Serializable
sealed class ApiResult<out T> {
    @Serializable
    data class Success<T>(val data: T) : ApiResult<T>()
    @Serializable
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
}
```

---

## Date and Time

MUST use `kotlinx-datetime` for all date/time operations. It replaces `java.time` and works on all KMP targets. All `Instant` and `LocalDate` types implement `@Serializable` out of the box.

```kotlin
import kotlinx.datetime.*

val now: Instant = Clock.System.now()
val today: LocalDate = now.toLocalDateTime(TimeZone.currentSystemDefault()).date
val utcDateTime: LocalDateTime = now.toLocalDateTime(TimeZone.UTC)

// Arithmetic
val tomorrow = today.plus(1, DateTimeUnit.DAY)
val oneWeekAgo: Instant = now - 7.days

// Serializes as ISO-8601 automatically
@Serializable
data class Event(
    val id: String,
    val title: String,
    val scheduledAt: Instant,
    val date: LocalDate
)
```

---

## Ktor 3.x Client Setup

Configure the HTTP client in `commonMain` with standard plugins. Platform-specific engines are injected via DI or `expect/actual`.

```kotlin
// commonMain
val httpClient = HttpClient {
    install(ContentNegotiation) {
        json(Json {
            ignoreUnknownKeys = true
            isLenient = true
            coerceInputValues = true
        })
    }
    install(Auth) {
        bearer {
            loadTokens {
                BearerTokens(
                    accessToken = tokenStorage.getAccessToken() ?: "",
                    refreshToken = tokenStorage.getRefreshToken() ?: ""
                )
            }
            refreshTokens {
                val tokens = client.post("$baseUrl/auth/refresh") {
                    setBody(RefreshRequest(oldTokens?.refreshToken ?: ""))
                    markAsRefreshTokenRequest()
                }.body<TokenResponse>()
                tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken)
                BearerTokens(tokens.accessToken, tokens.refreshToken)
            }
        }
    }
    install(Logging) {
        logger = object : Logger {
            override fun log(message: String) { Napier.d(message, tag = "Ktor") }
        }
        level = LogLevel.INFO
    }
    install(HttpTimeout) {
        requestTimeoutMillis = 30_000
        connectTimeoutMillis = 10_000
    }
    defaultRequest {
        url(baseUrl)
        contentType(ContentType.Application.Json)
        header(HttpHeaders.Accept, ContentType.Application.Json)
    }
}
```

Platform engines:

| Platform | Engine |
|---|---|
| Android | `HttpClient(Android { })` |
| iOS | `HttpClient(Darwin { })` |
| JVM (tests) | `HttpClient(CIO { })` |

---

## SQLDelight 2.3+

MUST enable async coroutines for all new databases. Use `.sq` files for schema and queries, and observe results via `Flow`.

```kotlin
// build.gradle.kts
sqldelight {
    databases {
        create("AppDatabase") {
            packageName.set("com.example.app.db")
            generateAsync = true
        }
    }
}
```

```kotlin
// Repository using SQLDelight + coroutines
class UserRepositoryImpl(
    private val db: AppDatabase,
    private val api: UserApi,
    private val dispatchers: CoroutineDispatchers
) : UserRepository {

    override fun getUsers(): Flow<List<User>> =
        db.userQueries.getAllUsers()
            .asFlow()
            .mapToList(dispatchers.io)
            .map { it.map(UserEntity::toDomain) }

    override suspend fun refreshUsers() = withContext(dispatchers.io) {
        val dtos = api.getUsers()
        db.transaction {
            dtos.forEach { dto ->
                db.userQueries.insertUser(
                    id = dto.id, name = dto.name,
                    email = dto.email, createdAt = dto.createdAt
                )
            }
        }
    }
}
```

---

## Naming Conventions

| Concept | Pattern | Example |
|---|---|---|
| DTO | `@Serializable data class {Entity}Dto` | `UserDto`, `TransactionDto` |
| Domain model | `data class {Entity}` | `User`, `Transaction` |
| Repository interface | `interface {Entity}Repository` | `UserRepository` |
| Repository implementation | `class {Entity}RepositoryImpl` | `UserRepositoryImpl` |
| API interface | `interface {Service}Api` | `AuthApi`, `SyncApi` |
| API implementation | `class {Service}ApiImpl` | `AuthApiImpl` |
| Use case | `class {Action}UseCase` | `LoginUseCase`, `SyncUseCase` |
| ViewModel | `class {Screen}ViewModel` | `DashboardViewModel` |
| DI module | `val {layer}Module` | `domainModule`, `dataModule` |
| Mapper extension | `fun {Source}.to{Target}()` | `UserDto.toDomain()` |

---

## Summary

| Rule | Severity | Description |
|---|---|---|
| expect/actual for utilities only | MUST | Use interfaces + DI for services and testable components |
| Factory pattern for drivers | MUST | `expect fun createSqlDriver(...)` for platform driver creation |
| Platform file suffix | MUST | `{Name}.android.kt` / `{Name}.ios.kt` for actual implementations |
| Koin modules in commonMain | MUST | `domainModule`, `networkModule`, `dataModule`, `viewModelModule` |
| `@Serializable` on all DTOs | MUST | kotlinx-serialization for cross-platform compatibility |
| `kotlinx-datetime` for dates | MUST | No `java.time` in shared code |
| SQLDelight `generateAsync = true` | MUST | Coroutine-first async queries for all new databases |
| Ktor 3.x with standard plugins | SHOULD | ContentNegotiation, Auth, Logging, HttpTimeout |
| Consistent naming conventions | SHOULD | Follow the naming table for DTOs, repos, use cases, ViewModels |
| `single{}` for singletons, `factory{}` for stateless | SHOULD | Match Koin scope to component lifecycle |
