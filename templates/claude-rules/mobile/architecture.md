---
paths:
  - shared/**
  - apps/mobile/**
---

# KMP Architecture

> Full reference: `docs/mobile/01-architecture.md`

## Module Structure

```
shared/
  domain/                    # Pure Kotlin domain models, use cases
  data/                      # Repository implementations, mappers
  network/                   # Ktor HTTP client, API definitions
  platform/                  # expect/actual platform abstractions
features/
  feature-auth/              # Feature module per bounded context
  feature-dashboard/
  feature-settings/
apps/
  androidApp/                # Android entry point, Compose UI
  iosApp/                    # iOS entry point, SwiftUI bridge
```

Each feature module is a self-contained bounded context with its own domain, data, and presentation layers.

## Source Set Hierarchy

```kotlin
kotlin {
    applyDefaultHierarchyTemplate()

    sourceSets {
        commonMain.dependencies { /* shared deps */ }
        androidMain.dependencies { /* android-specific */ }
        iosMain.dependencies { /* ios-specific */ }
    }
}
```

- `commonMain` holds all business logic and interfaces
- `androidMain` / `iosMain` hold platform implementations only
- Never put business logic in platform source sets

## DDD for Mobile

Bounded contexts map to feature modules. Each feature module owns:

- **Value objects** -- immutable data classes with validation in `init {}`
- **Aggregates** -- root entities that enforce invariants
- **Domain events** -- sealed interfaces for intra-module communication

```kotlin
// shared/domain/
data class Money(val amount: BigDecimal, val currency: Currency) {
    init { require(amount >= BigDecimal.ZERO) { "Amount must be non-negative" } }
}
```

## Clean Architecture Layers

```
domain/          # Entities, value objects, repository interfaces, use cases
  |              # No framework dependencies. Pure Kotlin.
application/     # Use case orchestration, DTOs, mappers
  |              # Depends on domain only.
infrastructure/  # Repository impls, network clients, DB drivers
                 # Depends on domain + application.
```

Dependencies flow **inward** only: infrastructure -> application -> domain.

## Cross-Module Communication

Modules communicate via an event bus or shared interfaces -- never direct imports between feature modules.

```kotlin
// shared/domain/events/
interface AppEventBus {
    fun publish(event: AppEvent)
    fun subscribe(handler: (AppEvent) -> Unit)
}

// Feature modules publish/subscribe without knowing each other
eventBus.publish(UserLoggedInEvent(userId))
```

If module A needs data from module B, define an interface in `shared/domain/` and implement it in module B. Inject via DI.

## Key Rules

| Rule | Detail |
|------|--------|
| Business logic location | `commonMain` only, never in platform source sets |
| Feature isolation | One feature module per bounded context |
| Dependency direction | Infrastructure -> application -> domain (inward only) |
| Cross-module comms | Events or shared interfaces, never direct imports |
| Platform code | `expect`/`actual` in `shared/platform/` only |
| Source set template | Always use `applyDefaultHierarchyTemplate()` |
| Value objects | Immutable data classes with `init {}` validation |
