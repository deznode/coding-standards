---
paths:
  - shared/**
  - apps/mobile/**
standard_type: aspirational
---

# Kotlin Multiplatform Conventions

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/mobile/04-kotlin-conventions.md`

## expect/actual Usage

Reserve `expect`/`actual` for platform utilities only. Prefer interfaces + DI for abstractions:

```kotlin
// CORRECT -- expect/actual for platform primitives
expect fun platformName(): String

actual fun platformName(): String = "Android"  // androidMain
actual fun platformName(): String = "iOS"       // iosMain

// PREFERRED -- interface + DI for business abstractions
interface FileStorage {
    suspend fun save(key: String, data: ByteArray)
    suspend fun load(key: String): ByteArray?
}

// Inject platform implementations via Koin
```

## Dependency Injection with Koin 4.x

Define modules in `commonMain`, provide platform implementations per source set:

```kotlin
// commonMain
val sharedModule = module {
    singleOf(::AuthRepository)
    factoryOf(::LoginUseCase)
    viewModelOf(::LoginViewModel)
}

// androidMain
val platformModule = module {
    single<FileStorage> { AndroidFileStorage(get()) }
}

// iosMain
val platformModule = module {
    single<FileStorage> { IosFileStorage() }
}
```

Use `singleOf`, `factoryOf`, `viewModelOf` constructor DSL. Avoid manual `get()` calls.

## Serialization and Dates

Use `@Serializable` for all DTOs. Never use reflection-based serialization:

```kotlin
@Serializable
data class UserDto(
    val id: String,
    val name: String,
    @Serializable(with = InstantSerializer::class)
    val createdAt: Instant,
)
```

Use `kotlinx-datetime` for all date/time operations. Never use `java.time` in `commonMain`:

```kotlin
import kotlinx.datetime.*

val now = Clock.System.now()
val date = now.toLocalDateTime(TimeZone.currentSystemDefault()).date
```

## Ktor 3.x Client

```kotlin
val httpClient = HttpClient {
    install(ContentNegotiation) {
        json(Json {
            ignoreUnknownKeys = true
            isLenient = false
            encodeDefaults = true
        })
    }
    install(HttpTimeout) {
        requestTimeoutMillis = 30_000
        connectTimeoutMillis = 10_000
    }
    install(Logging) {
        level = LogLevel.HEADERS
    }
}
```

Define API services as interfaces in `shared/network/`, implement with Ktor client calls.

## SQLDelight 2.3+

Use async drivers and `suspending` queries:

```kotlin
// Async driver setup
val driver = AndroidSqliteDriver(
    schema = AppDatabase.Schema,
    context = context,
    name = "app.db",
)

// Queries return Flow for reactive updates
fun observeUsers(): Flow<List<User>> =
    queries.selectAll().asFlow().mapToList(Dispatchers.IO)
```

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| DTO | `{Name}Dto` | `UserDto`, `OrderItemDto` |
| Domain model | Plain noun | `User`, `Order` |
| Repository interface | `{Entity}Repository` | `UserRepository` |
| Repository impl | `{Entity}RepositoryImpl` | `UserRepositoryImpl` |
| API service | `{Domain}Api` | `AuthApi`, `OrderApi` |
| Use case | `{Action}{Entity}UseCase` | `LoginUseCase`, `FetchOrdersUseCase` |
| ViewModel | `{Screen}ViewModel` | `DashboardViewModel` |
| Mapper extension | `{Source}.to{Target}()` | `UserDto.toDomain()` |
| Koin module | `{feature}Module` | `authModule`, `networkModule` |

## Key Rules

| Rule | Detail |
|------|--------|
| expect/actual scope | Platform utilities only; prefer interfaces + DI |
| DI framework | Koin 4.x with constructor DSL (`singleOf`, `factoryOf`) |
| Serialization | `@Serializable` annotation, no reflection |
| Date/time library | `kotlinx-datetime`, never `java.time` in common code |
| HTTP client | Ktor 3.x with `ContentNegotiation` + `HttpTimeout` |
| Local database | SQLDelight 2.3+ with async drivers |
| Mapping pattern | Extension functions: `dto.toDomain()`, `entity.toDto()` |
