---
paths:
  - build-logic/**
  - gradle/**
  - "*.gradle.kts"
---

# Build Configuration

> Full reference: `docs/mobile/02-build-configuration.md`

## Convention Plugins

All build logic lives in `build-logic/` (replaces `buildSrc`):

```
build-logic/
  convention/
    src/main/kotlin/
      kmp-library.gradle.kts       # Shared KMP library config
      android-app.gradle.kts       # Android application config
      compose-multiplatform.gradle.kts  # Compose setup
    build.gradle.kts
  settings.gradle.kts
```

Apply convention plugins by ID, not by path:

```kotlin
// feature module build.gradle.kts
plugins {
    id("kmp-library")
    id("compose-multiplatform")
}
```

Never duplicate build configuration across modules. Extract common setup into convention plugins.

## Version Catalog

All dependency versions live in `gradle/libs.versions.toml`:

```toml
[versions]
kotlin = "2.1.20"
ktor = "3.1.1"
koin = "4.1.0"
compose-multiplatform = "1.7.3"
sqldelight = "2.3.0"

[libraries]
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-content-negotiation = { module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }

[plugins]
kotlin-multiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
```

Naming conventions:
- Versions: `kebab-case` matching the library group
- Libraries: `{group}-{artifact}` with dots replaced by hyphens
- Bundles: group related libraries (e.g., `ktor-client`, `testing-common`)

## BOM-Based Versioning

Use BOMs when available to align transitive dependency versions:

```kotlin
implementation(platform(libs.koin.bom))
implementation(libs.koin.core)      // Version from BOM, no explicit version
implementation(libs.koin.android)
```

## Gradle Properties

```properties
# gradle.properties
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=true
org.gradle.jvmargs=-Xmx4g -XX:+UseParallelGC

kotlin.code.style=official
kotlin.mpp.applyDefaultHierarchyTemplate=true
```

Enable configuration cache for faster builds. All team members must use identical Gradle properties -- commit `gradle.properties` to VCS.

## Version Pinning

Pin exact versions. Never use dynamic version ranges:

```kotlin
// CORRECT
implementation("io.ktor:ktor-client-core:3.1.1")

// WRONG -- dynamic versions break reproducibility
implementation("io.ktor:ktor-client-core:3.+")
implementation("io.ktor:ktor-client-core:[3.0,4.0)")
```

Use Dependabot or Renovate for automated version bumps with review.

## Key Rules

| Rule | Detail |
|------|--------|
| Build logic location | `build-logic/` convention plugins, never `buildSrc` |
| Version management | `gradle/libs.versions.toml` exclusively |
| BOM usage | Always prefer BOMs when available |
| Dynamic versions | Forbidden -- pin exact versions |
| Gradle parallelism | `parallel=true`, `caching=true`, `configuration-cache=true` |
| Plugin application | By convention plugin ID, not by copy-pasting config |
| Gradle wrapper | Commit `gradlew`, `gradle-wrapper.jar`, `gradle-wrapper.properties` |
