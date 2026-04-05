# Quality Tooling

Static analysis, code coverage, architecture enforcement, and security scanning tools for Kotlin and Android projects.

**Why?** Code review alone cannot catch every style violation, coroutine misuse, architecture drift, or security vulnerability across a growing codebase. Automated quality tooling provides deterministic, repeatable checks that run on every commit. Without a clear tooling stack, teams either have no gates (bugs reach production) or adopt overlapping tools that slow the build without proportional benefit. This document defines what to use, how to configure it, and what to skip.

---

## ktlint

**Version**: 1.8.0 | **Purpose**: Kotlin code formatting and style enforcement | **License**: MIT

ktlint enforces the official Kotlin coding conventions with zero configuration. It auto-fixes most style violations and integrates with pre-commit hooks to prevent formatting issues from reaching code review.

### Gradle Setup

```kotlin
// build.gradle.kts
plugins {
    id("org.jlleitschuh.gradle.ktlint") version "12.1.0"
}

ktlint {
    version.set("1.8.0")
}
```

### Pre-Commit Hook

MUST run ktlint formatting as a pre-commit hook. This prevents style violations from entering the repository.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: ktlint
        name: ktlint
        entry: ./gradlew ktlintFormat
        language: system
        types: [kotlin]
        pass_filenames: false
```

Alternatively, add ktlint check to the Gradle build chain:

```kotlin
tasks.named("check") {
    dependsOn("ktlintCheck")
}
```

### Key Characteristics

| Aspect | Detail |
|---|---|
| Configuration | Zero-config (convention over configuration) |
| Auto-fix | Comprehensive (fixes most violations automatically) |
| Speed | Fast (syntax-level analysis) |
| Scope | Formatting and style only (not bug detection) |

---

## Detekt

**Version**: 1.23.8 | **Purpose**: Kotlin static analysis with 300+ rules | **License**: Apache 2.0

Detekt is the only static analysis tool that natively understands Kotlin constructs: coroutines, flows, suspend functions, sealed interfaces, and extension functions. Java-based tools like SpotBugs can process Kotlin bytecode but miss Kotlin-specific anti-patterns.

### Gradle Setup

```kotlin
// build.gradle.kts
plugins {
    id("io.gitlab.arturbosch.detekt") version "1.23.8"
}

detekt {
    config.setFrom(file("config/detekt.yml"))
    buildUponDefaultConfig = true
}

dependencies {
    detektPlugins("io.gitlab.arturbosch.detekt:detekt-formatting:1.23.8")
}
```

The `detekt-formatting` plugin embeds ktlint rules inside Detekt, allowing a single tool invocation for both formatting and linting. Teams MAY use this instead of running ktlint separately.

### Key Configuration

| Setting | Purpose | Default |
|---|---|---|
| `buildUponDefaultConfig` | Extend defaults rather than replace | `false` |
| `baseline` | XML file with known issues to suppress | None |
| `allRules` | Enable all available rules | `false` |
| `detekt-formatting` plugin | Integrates ktlint rules into Detekt | Not included |

### What Detekt Catches

- Coroutine misuse (blocking calls in suspend functions, missing `withContext`)
- Cyclomatic complexity violations
- Code smells (magic numbers, long methods, large classes)
- Naming convention violations
- Unused imports and dead code
- Exception handling anti-patterns

### Detekt vs ktlint

| Aspect | Detekt | ktlint |
|---|---|---|
| Purpose | Code quality / smells | Code formatting / style |
| Auto-fix | Limited | Comprehensive |
| Speed | Slower (deep AST analysis) | Fast (syntax-level) |
| Configuration | Highly configurable | Minimal |

MUST use both. ktlint for deterministic formatting, Detekt for deeper quality analysis.

---

## Kover

**Version**: 0.9.7 | **Purpose**: Kotlin-native code coverage | **License**: Apache 2.0

Kover is developed by JetBrains specifically for Kotlin JVM and Kotlin Multiplatform. It correctly handles Kotlin-specific bytecode patterns where JaCoCo produces false negatives.

### Gradle Setup

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

### Why Kover Over JaCoCo

| Scenario | JaCoCo | Kover |
|---|---|---|
| `inline` functions | Reports uncoverable synthetic bytecode as missing | Correctly excludes inlined code |
| `data class` `copy()`/`equals()`/`hashCode()` | Inflates uncovered lines | Handles correctly |
| Coroutine continuations | False missing branches | Coroutine-aware via JetBrains agent |
| Sealed class exhaustive `when` | False uncovered branches | No false negatives |

### Report Formats

Kover generates HTML and XML reports. The XML format is compatible with SonarQube and Codecov for CI integration.

### Coverage Threshold

SHOULD enforce a minimum 80% line coverage threshold via the `verify` block. Teams may adjust this based on project maturity but MUST NOT set it below 60%.

---

## ArchUnit

**Version**: 1.4.1 | **Purpose**: Architecture compliance as executable tests | **License**: Apache 2.0

ArchUnit encodes architecture decisions as unit tests. When someone violates a layer boundary or naming convention, the build fails instead of relying on code review.

### Gradle Setup

```kotlin
// build.gradle.kts
dependencies {
    testImplementation("com.tngtech.archunit:archunit-junit5:1.4.1")
}
```

### Layer Boundary Enforcement

```kotlin
@AnalyzeClasses(packages = ["com.example.myapp"])
class ArchitectureTest {

    @ArchTest
    val layerDependencies = layeredArchitecture()
        .consideringAllDependencies()
        .layer("Controller").definedBy("..controller..")
        .layer("Service").definedBy("..service..")
        .layer("Repository").definedBy("..repository..")
        .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
        .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
        .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service")
}
```

### Module Boundary Enforcement

For KMP projects with shared modules, verify that modules do not cross boundaries:

```kotlin
@ArchTest
val domainDoesNotDependOnData = noClasses()
    .that().resideInAPackage("..domain..")
    .should().dependOnClassesThat().resideInAPackage("..data..")
    .because("Domain layer must not depend on data layer")

@ArchTest
val repositoryImplementationsInDataOnly = classes()
    .that().implement(com.example.domain.repository.UserRepository::class.java)
    .should().resideInAPackage("..data.repository..")
    .because("Repository implementations belong in the data layer")
```

---

## SpotBugs + Find Security Bugs

**Version**: SpotBugs 4.9.6 + Find Security Bugs 1.14.0 | **Purpose**: Post-compilation bytecode analysis and OWASP security scanning

SpotBugs analyzes compiled `.class` files, meaning it works with any JVM language including Kotlin. The Find Security Bugs plugin adds 144 security vulnerability patterns covering the OWASP Top 10.

Use SpotBugs for Java modules in mixed Kotlin/Java projects and for security scanning of all JVM bytecode.

### Gradle Setup

```kotlin
// build.gradle.kts
plugins {
    id("com.github.spotbugs") version "6.4.8"
}

spotbugs {
    toolVersion.set("4.9.6")
    effort.set(Effort.MAX)
    reportLevel.set(Confidence.LOW)
}

dependencies {
    spotbugsPlugins("com.h3xstream.findsecbugs:findsecbugs-plugin:1.14.0")
}
```

### When To Use

| Scenario | Tool |
|---|---|
| Kotlin-only modules | Detekt (native Kotlin AST) |
| Java modules | SpotBugs + Error Prone |
| Mixed Kotlin/Java modules | SpotBugs (bytecode) + Detekt (Kotlin source) |
| Security scanning | Find Security Bugs plugin on all modules |

---

## Trivy

**Purpose**: Container and dependency vulnerability scanning in CI

Trivy scans Gradle lockfiles, Docker images, and filesystem dependencies for known CVEs. It is free, fast, and produces SARIF output for GitHub Security tab integration.

### CI Integration

```yaml
# .github/workflows/security.yml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'sarif'
    output: 'trivy-results.sarif'

- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

SHOULD run Trivy on every PR to catch dependency vulnerabilities before merge. For container scanning, run Trivy against the final Docker image in the release pipeline.

---

## Renovate

**Purpose**: Automated dependency updates with version catalog support

Renovate creates pull requests for dependency updates, supports Gradle version catalogs (`libs.versions.toml`), and provides configurable auto-merge policies for minor/patch updates.

### Configuration

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["major-update"]
    }
  ]
}
```

SHOULD configure Renovate for all repositories. Auto-merge minor and patch updates; require manual review for major updates.

---

## Error Prone

**Version**: 2.48.0 | **Purpose**: Compile-time static analysis for Java code

Error Prone catches bugs during compilation with auto-fix suggestions. Use it for any Java modules in mixed Kotlin/Java projects. It does NOT support Kotlin source files.

### Gradle Setup

```kotlin
// build.gradle.kts (Java modules only)
plugins {
    id("net.ltgt.errorprone") version "4.0.1"
    java
}

dependencies {
    errorprone("com.google.errorprone:error_prone_core:2.48.0")
}

tasks.withType<JavaCompile>().configureEach {
    options.errorprone.disableWarningsInGeneratedCode.set(true)
    options.errorprone.isEnabled.set(true)
}
```

### Limitations

- Requires JDK 21+ to run
- Java only (cannot analyze Kotlin source)
- Adds 10-30% to compile time

---

## Recommended Tiers

Organize tooling adoption by priority. MUST tools are non-negotiable for any new project. SHOULD tools add significant value and should be adopted as the project matures. MAY tools provide incremental benefit for specific use cases.

| Tier | Tool | Category | Rationale |
|---|---|---|---|
| MUST | ktlint 1.8.0 | Formatting | Zero-config, auto-fix, pre-commit enforcement |
| MUST | Detekt 1.23.8 | Static analysis | 300+ Kotlin-native rules, coroutine awareness |
| MUST | Kover 0.9.7 | Coverage | Kotlin-native, handles inline/coroutines correctly |
| SHOULD | ArchUnit 1.4.1 | Architecture | Executable architecture tests, prevents drift |
| SHOULD | Trivy | Security | Dependency + container CVE scanning in CI |
| SHOULD | Renovate | Dependencies | Automated updates with version catalog support |
| MAY | SpotBugs 4.9.6 | Security / bytecode | Post-compilation analysis, OWASP via Find Security Bugs |
| MAY | Error Prone 2.48.0 | Java static analysis | Compile-time bug detection for Java modules |
| MAY | PIT | Mutation testing | Verifies test assertion quality; high build time cost |

---

## Build Integration

### Gradle Task Chain

Wire quality tools into the standard build lifecycle so they run automatically:

```kotlin
// build.gradle.kts
tasks.named("check") {
    dependsOn("ktlintCheck")
    dependsOn("detekt")
}

// Coverage report after tests
tasks.named("test") {
    finalizedBy("koverVerify")
}
```

### CI Pipeline Order

```
1. ktlintCheck        (fast, fail early on formatting)
2. detekt             (static analysis)
3. test               (unit + integration tests)
4. koverVerify        (coverage threshold check)
5. archTest           (architecture compliance)
6. trivy              (dependency vulnerability scan)
```

MUST fail the CI pipeline on any MUST-tier tool failure. SHOULD tools produce warnings that block merge via branch protection rules.

---

## Summary

| Rule | Severity | Description |
|---|---|---|
| ktlint in pre-commit hook | MUST | Auto-format on commit; prevent style violations in repo |
| Detekt with default + custom config | MUST | Kotlin-native static analysis on every build |
| Kover with 80% minimum coverage | MUST | Kotlin-aware coverage; no false negatives from inline/coroutines |
| ArchUnit layer tests | SHOULD | Executable architecture rules in test suite |
| Trivy in CI | SHOULD | Dependency and container vulnerability scanning |
| Renovate for dependency updates | SHOULD | Automated PRs for minor/patch; manual review for major |
| SpotBugs for Java/security | MAY | Bytecode analysis + OWASP Top 10 via Find Security Bugs |
| Error Prone for Java modules | MAY | Compile-time bug detection with auto-fix |
| PIT mutation testing | MAY | Test quality verification; defer until coverage matures |
| Quality tools in CI pipeline | MUST | Fail build on MUST-tier failures; warn on SHOULD-tier |
