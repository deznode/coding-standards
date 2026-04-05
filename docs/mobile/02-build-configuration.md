# Build Configuration

Defines the Gradle build setup, dependency management, and convention plugin patterns for Android and KMP projects.

**Why?** Android projects with multiple modules accumulate duplicated build logic -- the same `compileSdk`, `minSdk`, `jvmTarget`, and plugin applications repeated in every `build.gradle.kts`. Convention plugins in a `build-logic/` composite build eliminate this duplication, the TOML version catalog provides a single source of truth for dependency versions, and strict Gradle properties ensure reproducible, fast builds across all developer machines and CI environments.

---

## Convention Plugins in `build-logic/`

Use a **composite build** in `build-logic/` instead of `buildSrc`. The composite build approach avoids `buildSrc`'s limitation of always being recompiled when any build file changes, and it participates in Gradle's configuration cache.

### Directory Structure

```
project-root/
├── app/
├── features/
│   ├── auth/
│   ├── catalog/
│   └── orders/
├── core/
│   ├── data/
│   └── ui/
├── shared/
│   ├── domain/
│   ├── data/
│   └── network/
├── build-logic/                          # Composite build
│   ├── settings.gradle.kts
│   ├── build.gradle.kts
│   └── convention/
│       ├── build.gradle.kts
│       └── src/main/kotlin/
│           ├── AndroidApplicationConventionPlugin.kt
│           ├── AndroidLibraryConventionPlugin.kt
│           ├── AndroidLibraryComposeConventionPlugin.kt
│           └── KmpLibraryConventionPlugin.kt
└── settings.gradle.kts                   # includeBuild("build-logic")
```

### Root Settings

```kotlin
// settings.gradle.kts (root)
pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolution {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "my-app"
include(":app")
include(":shared:domain")
include(":shared:data")
include(":shared:network")
include(":shared:platform")
include(":features:auth")
include(":features:catalog")
include(":features:orders")
```

### Convention Plugin: Android Library

```kotlin
// build-logic/convention/src/main/kotlin/AndroidLibraryConventionPlugin.kt
import com.android.build.gradle.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("com.android.library")
            apply("org.jetbrains.kotlin.android")
        }
        extensions.configure<LibraryExtension> {
            compileSdk = 35
            defaultConfig {
                minSdk = 26
                testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
            }
            compileOptions {
                sourceCompatibility = JavaVersion.VERSION_17
                targetCompatibility = JavaVersion.VERSION_17
            }
        }
        tasks.withType<KotlinCompile>().configureEach {
            compilerOptions {
                jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
            }
        }
    }
}
```

### Convention Plugin: Android Library with Compose

```kotlin
// build-logic/convention/src/main/kotlin/AndroidLibraryComposeConventionPlugin.kt
import com.android.build.gradle.LibraryExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

class AndroidLibraryComposeConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("my-app.android.library")       // Apply base convention first
            apply("org.jetbrains.kotlin.plugin.compose")
        }
        extensions.configure<LibraryExtension> {
            buildFeatures {
                compose = true
            }
        }
    }
}
```

### Convention Plugin: KMP Library

```kotlin
// build-logic/convention/src/main/kotlin/KmpLibraryConventionPlugin.kt
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension

class KmpLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        with(pluginManager) {
            apply("org.jetbrains.kotlin.multiplatform")
            apply("com.android.library")
        }
        extensions.configure<KotlinMultiplatformExtension> {
            applyDefaultHierarchyTemplate()
            androidTarget {
                compilations.all {
                    kotlinOptions {
                        jvmTarget = JavaVersion.VERSION_17.toString()
                    }
                }
            }
            listOf(
                iosX64(),
                iosArm64(),
                iosSimulatorArm64()
            ).forEach { iosTarget ->
                iosTarget.binaries.framework {
                    baseName = project.name
                    isStatic = true
                }
            }
            jvm()
            sourceSets.commonMain.dependencies {
                implementation(project.libs.findLibrary("kotlinx-coroutines-core").get())
            }
            sourceSets.commonTest.dependencies {
                implementation(project.libs.findLibrary("kotlin-test").get())
            }
        }
    }
}
```

### Registering Convention Plugins

```kotlin
// build-logic/convention/build.gradle.kts
plugins {
    `kotlin-dsl`
}

dependencies {
    compileOnly(libs.android.gradlePlugin)
    compileOnly(libs.kotlin.gradlePlugin)
    compileOnly(libs.compose.gradlePlugin)
}

gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "my-app.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidLibrary") {
            id = "my-app.android.library"
            implementationClass = "AndroidLibraryConventionPlugin"
        }
        register("androidLibraryCompose") {
            id = "my-app.android.library.compose"
            implementationClass = "AndroidLibraryComposeConventionPlugin"
        }
        register("kmpLibrary") {
            id = "my-app.kmp.library"
            implementationClass = "KmpLibraryConventionPlugin"
        }
    }
}
```

### Using Convention Plugins in Feature Modules

Module-level build files become minimal:

```kotlin
// features/orders/build.gradle.kts
plugins {
    id("my-app.android.library.compose")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.example.features.orders"
}

dependencies {
    implementation(projects.shared.domain)
    implementation(projects.shared.data)
    implementation(libs.bundles.compose.ui)
    implementation(libs.nav.compose)
    implementation(libs.koin.compose)
    testImplementation(libs.bundles.testing)
}
```

MUST use convention plugins in `build-logic/` for all shared build configuration. MUST NOT duplicate `compileSdk`, `minSdk`, `jvmTarget`, or plugin applications across module build files.

---

## Version Catalog (`libs.versions.toml`)

The TOML version catalog at `gradle/libs.versions.toml` is the single source of truth for all dependency versions. Every dependency, plugin, and version MUST be declared here.

### Sample Catalog

```toml
[versions]
agp             = "9.1.0"
kotlin          = "2.2.10"
ksp             = "2.2.10-1.0.31"
compose-bom     = "2026.03.01"
koin            = "4.1.0"
ktor            = "3.1.1"
sqldelight      = "2.3.0"
navigation      = "2.9.7"
lifecycle       = "2.10.0"
coroutines      = "1.10.1"
serialization   = "1.8.0"
datastore       = "1.2.1"
work            = "2.11.2"
compileSdk      = "35"
minSdk          = "26"
targetSdk       = "35"

[libraries]
# Compose BOM (no version -- managed by BOM)
compose-bom           = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
compose-ui            = { group = "androidx.compose.ui", name = "ui" }
compose-m3            = { group = "androidx.compose.material3", name = "material3" }
compose-tooling       = { group = "androidx.compose.ui", name = "ui-tooling" }
compose-preview       = { group = "androidx.compose.ui", name = "ui-tooling-preview" }

# Navigation
nav-compose           = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }

# Lifecycle
lifecycle-vm-compose  = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }
lifecycle-rt-compose  = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }

# Kotlin
kotlinx-coroutines-core = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "coroutines" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }
kotlinx-serialization   = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
kotlin-test             = { group = "org.jetbrains.kotlin", name = "kotlin-test" }

# Koin (KMP-compatible)
koin-core             = { group = "io.insert-koin", name = "koin-core", version.ref = "koin" }
koin-android          = { group = "io.insert-koin", name = "koin-android", version.ref = "koin" }
koin-compose          = { group = "io.insert-koin", name = "koin-androidx-compose", version.ref = "koin" }

# Ktor
ktor-client-core      = { group = "io.ktor", name = "ktor-client-core", version.ref = "ktor" }
ktor-client-android   = { group = "io.ktor", name = "ktor-client-android", version.ref = "ktor" }
ktor-client-darwin    = { group = "io.ktor", name = "ktor-client-darwin", version.ref = "ktor" }
ktor-client-cio       = { group = "io.ktor", name = "ktor-client-cio", version.ref = "ktor" }
ktor-content-negotiation = { group = "io.ktor", name = "ktor-client-content-negotiation", version.ref = "ktor" }
ktor-serialization    = { group = "io.ktor", name = "ktor-serialization-kotlinx-json", version.ref = "ktor" }

# SQLDelight
sqldelight-android    = { group = "app.cash.sqldelight", name = "android-driver", version.ref = "sqldelight" }
sqldelight-native     = { group = "app.cash.sqldelight", name = "native-driver", version.ref = "sqldelight" }
sqldelight-jvm        = { group = "app.cash.sqldelight", name = "sqlite-driver", version.ref = "sqldelight" }
sqldelight-coroutines = { group = "app.cash.sqldelight", name = "coroutines-extensions", version.ref = "sqldelight" }

# DataStore
datastore-prefs       = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }

# WorkManager
work-runtime          = { group = "androidx.work", name = "work-runtime-ktx", version.ref = "work" }

# Build-logic dependencies (for convention plugins)
android-gradlePlugin  = { group = "com.android.tools.build", name = "gradle", version.ref = "agp" }
kotlin-gradlePlugin   = { group = "org.jetbrains.kotlin", name = "kotlin-gradle-plugin", version.ref = "kotlin" }
compose-gradlePlugin  = { group = "org.jetbrains.kotlin", name = "compose-compiler-gradle-plugin", version.ref = "kotlin" }

[bundles]
compose-ui    = ["compose-ui", "compose-m3", "compose-preview", "lifecycle-vm-compose", "lifecycle-rt-compose"]
ktor-common   = ["ktor-client-core", "ktor-content-negotiation", "ktor-serialization"]
testing       = ["kotlin-test", "kotlinx-coroutines-test"]

[plugins]
android-app           = { id = "com.android.application", version.ref = "agp" }
android-lib           = { id = "com.android.library", version.ref = "agp" }
kotlin-android        = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-multiplatform  = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
kotlin-compose        = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization  = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
ksp                   = { id = "com.google.devtools.ksp", version.ref = "ksp" }
sqldelight            = { id = "app.cash.sqldelight", version.ref = "sqldelight" }
```

---

## BOM-Based Versioning

Use BOMs (Bill of Materials) to keep related library families in sync without specifying individual versions:

```kotlin
// Module build.gradle.kts
dependencies {
    val bom = platform(libs.compose.bom)
    implementation(bom)
    implementation(libs.compose.ui)          // No version -- BOM controls it
    implementation(libs.compose.m3)          // No version -- BOM controls it
    debugImplementation(libs.compose.tooling)
}
```

BOMs available for Android projects:

| BOM | Controls |
|-----|----------|
| `androidx.compose:compose-bom` | All `compose.*` libraries (UI, Material3, Animation, Runtime) |
| `org.jetbrains.kotlin:kotlin-bom` | All `kotlinx.*` standard libraries |

MUST use the Compose BOM for all Compose dependencies. MUST NOT specify individual Compose library versions alongside the BOM.

---

## Version Catalog Naming Conventions

Follow consistent naming within `libs.versions.toml`:

| Section | Convention | Example |
|---------|-----------|---------|
| `[versions]` | Lowercase, hyphenated | `compose-bom`, `kotlin`, `ktor` |
| `[libraries]` | Lowercase, hyphenated, `group-artifact` pattern | `ktor-client-core`, `compose-m3` |
| `[plugins]` | Lowercase, hyphenated, `provider-scope` pattern | `kotlin-android`, `android-app` |
| `[bundles]` | Lowercase, hyphenated, descriptive group name | `compose-ui`, `ktor-common`, `testing` |

Reference from Gradle scripts:

```kotlin
libs.versions.kotlin              // version string
libs.plugins.kotlin.android       // plugin alias
libs.bundles.compose.ui           // dependency bundle
libs.compose.m3                   // single library
```

MUST use consistent naming across the entire catalog. MUST NOT mix naming conventions (e.g., camelCase and kebab-case in the same section).

---

## Gradle Properties

Set these properties in `gradle.properties` at the project root for all projects:

```properties
# Performance
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configuration-cache=true
org.gradle.jvmargs=-Xmx4g -XX:+UseG1GC

# Kotlin
kotlin.incremental=true
kotlin.incremental.useClasspathSnapshot=true

# Android
android.useAndroidX=true
android.nonTransitiveRClass=true
```

| Property | Purpose |
|----------|---------|
| `org.gradle.parallel=true` | Build independent modules concurrently |
| `org.gradle.caching=true` | Reuse task outputs from previous builds |
| `org.gradle.configuration-cache=true` | Cache the configuration phase (3-4x speedup on large projects) |
| `org.gradle.jvmargs=-Xmx4g` | Sufficient heap for multi-module builds |
| `kotlin.incremental=true` | Only recompile changed Kotlin files |
| `kotlin.incremental.useClasspathSnapshot=true` | More precise incremental compilation |
| `android.nonTransitiveRClass=true` | Each module sees only its own R class (faster builds, no leaking) |

MUST enable `parallel`, `caching`, and `configuration-cache` in all projects. MUST set `nonTransitiveRClass=true`.

---

## Version Pinning

MUST pin exact dependency versions. Dynamic versions (`1.+`, `latest.release`, `[1.0,2.0)`) are forbidden -- they make builds non-reproducible and can introduce breaking changes silently.

```kotlin
// CORRECT: pinned version
implementation("io.ktor:ktor-client-core:3.1.1")

// WRONG: dynamic version -- builds are non-reproducible
implementation("io.ktor:ktor-client-core:3.+")
implementation("io.ktor:ktor-client-core:latest.release")
```

When using the version catalog, versions are pinned by definition. Ensure the catalog entry always specifies an exact version:

```toml
# CORRECT
ktor = "3.1.1"

# WRONG
ktor = "3.+"
```

---

## Kotlin JVM Target

MUST set `jvmTarget` to 17 or higher in all modules. Kotlin 2.2+ and Gradle 9.x require JDK 17, and setting the JVM target explicitly ensures bytecode compatibility:

```kotlin
// In convention plugin
tasks.withType<KotlinCompile>().configureEach {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
```

MUST NOT use the deprecated `kotlinOptions {}` block -- it raises a compiler error in Kotlin 2.2+. Use `compilerOptions {}` instead:

```kotlin
// WRONG: removed in Kotlin 2.2
kotlinOptions {
    jvmTarget = "17"
}

// CORRECT: compilerOptions
compilerOptions {
    jvmTarget.set(JvmTarget.JVM_17)
}
```

---

## Dependency Verification

Enable Gradle dependency verification to detect tampered or unexpected artifacts. Generate the verification file and commit it:

```bash
# Generate initial verification metadata
./gradlew --write-verification-metadata sha256 help
```

This creates `gradle/verification-metadata.xml` containing SHA-256 checksums for all resolved dependencies. Gradle will fail the build if any dependency checksum does not match.

```xml
<!-- gradle/verification-metadata.xml (excerpt) -->
<verification-metadata>
   <configuration>
      <verify-metadata>true</verify-metadata>
      <verify-signatures>false</verify-signatures>
   </configuration>
   <components>
      <component group="io.ktor" name="ktor-client-core" version="3.1.1">
         <artifact name="ktor-client-core-3.1.1.jar">
            <sha256 value="abc123..." origin="Generated by Gradle"/>
         </artifact>
      </component>
   </components>
</verification-metadata>
```

SHOULD enable dependency verification via `gradle/verification-metadata.xml`. MUST commit the verification file to version control.

---

## Module Dependency Graph

Feature modules depend on core/shared layers. The dependency direction flows from features down to shared modules, never sideways between features:

```
androidApp
  ├── :features:auth
  ├── :features:catalog
  └── :features:orders

:features:auth
  ├── :shared:domain          (api)
  ├── :shared:data            (implementation)
  └── :core:ui                (implementation)

:features:catalog
  ├── :shared:domain          (api)
  ├── :shared:data            (implementation)
  └── :core:ui                (implementation)

:shared:data
  ├── :shared:domain          (api)
  └── :shared:network         (implementation)

:shared:network
  └── :shared:domain          (implementation -- for DTOs/mappers)

:shared:domain
  └── (no project dependencies -- pure Kotlin)
```

Use `api()` when a module's public API exposes types from the dependency (e.g., features expose domain types). Use `implementation()` when the dependency is an internal detail.

MUST NOT create circular dependencies between modules. MUST NOT add dependencies between feature modules. MUST use `api()` only when the dependency's types are part of the module's public API.

---

## Automated Dependency Updates

Configure Renovate or Dependabot for automated dependency update PRs:

### Renovate (Recommended)

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchManagers": ["gradle"],
      "groupName": "Compose BOM",
      "matchPackageNames": ["androidx.compose:compose-bom"]
    },
    {
      "matchManagers": ["gradle"],
      "groupName": "Kotlin",
      "matchPackagePrefixes": ["org.jetbrains.kotlin"]
    },
    {
      "matchManagers": ["gradle"],
      "groupName": "Ktor",
      "matchPackagePrefixes": ["io.ktor"]
    }
  ]
}
```

### Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "gradle"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      kotlin:
        patterns:
          - "org.jetbrains.kotlin*"
      compose:
        patterns:
          - "androidx.compose*"
```

SHOULD configure automated dependency update tooling. SHOULD group related dependency updates (Compose, Kotlin, Ktor) into single PRs.

---

## Summary

| Rule | Severity | Description |
|------|----------|-------------|
| Convention plugins | MUST | Use `build-logic/` composite build for all shared build configuration |
| No duplicated config | MUST | `compileSdk`, `minSdk`, `jvmTarget` set only in convention plugins |
| Version catalog | MUST | Declare all dependencies and versions in `libs.versions.toml` |
| BOM usage | MUST | Use Compose BOM; do not specify individual Compose library versions |
| Catalog naming | MUST | Use consistent lowercase-hyphenated naming across all catalog sections |
| Parallel builds | MUST | Enable `org.gradle.parallel=true` |
| Build caching | MUST | Enable `org.gradle.caching=true` |
| Configuration cache | MUST | Enable `org.gradle.configuration-cache=true` |
| Non-transitive R class | MUST | Set `android.nonTransitiveRClass=true` |
| Exact versions | MUST | Pin exact versions; no dynamic versions (`1.+`) |
| JVM target 17+ | MUST | Set `jvmTarget` to 17 or higher in all modules |
| `compilerOptions` | MUST | Use `compilerOptions {}`, not deprecated `kotlinOptions {}` |
| Dependency verification | SHOULD | Enable `gradle/verification-metadata.xml` and commit it |
| Module graph | MUST | Features depend on shared layers; no cross-feature dependencies |
| `api()` vs `implementation()` | MUST | Use `api()` only when dependency types are part of the public API |
| Automated updates | SHOULD | Configure Renovate or Dependabot for dependency update PRs |
