---
paths:
  - .detekt/**
  - "**/detekt.yml"
---

# Quality Tooling

> Full reference: `docs/mobile/07-quality-tooling.md`

## Tier Overview

| Tier | Tools | Policy |
|------|-------|--------|
| MUST | ktlint, Detekt | CI gate -- build fails on violations |
| SHOULD | Kover, ArchUnit, Trivy | CI reporting -- warnings, not blockers |
| MAY | SpotBugs, PIT | Optional -- run on demand |

## MUST: ktlint

Zero-configuration Kotlin linter and formatter. Enforces official Kotlin coding conventions:

```kotlin
// build.gradle.kts
plugins {
    id("org.jlleitschuh.gradle.ktlint") version libs.versions.ktlint.get()
}

ktlint {
    android.set(true)
    outputToConsole.set(true)
    reporters {
        reporter(org.jlleitschuh.gradle.ktlint.reporter.ReporterType.SARIF)
    }
}
```

Run `./gradlew ktlintCheck` in CI. Run `./gradlew ktlintFormat` locally before committing.

No custom `.editorconfig` overrides unless the team explicitly agrees. The goal is zero-config consistency.

## MUST: Detekt

Static analysis with 300+ rules for code complexity, style, naming, and potential bugs:

```kotlin
// build.gradle.kts
plugins {
    id("io.gitlab.arturbosch.detekt") version libs.versions.detekt.get()
}

detekt {
    config.setFrom(files("$rootDir/.detekt/detekt.yml"))
    buildUponDefaultConfig = true
    parallel = true
}

dependencies {
    detektPlugins(libs.detekt.formatting)
    detektPlugins(libs.detekt.compose.rules)
}
```

Key configuration in `detekt.yml`:

```yaml
complexity:
  LongMethod:
    threshold: 30
  CyclomaticComplexity:
    threshold: 10
  LongParameterList:
    ignoreAnnotated: ['Composable']

naming:
  FunctionNaming:
    ignoreAnnotated: ['Composable']
```

Always include `detekt-compose-rules` for Compose-specific checks (stability, modifier usage, preview annotations).

## SHOULD: Kover

Kotlin-native code coverage (see Testing rule for setup). Configure minimum thresholds:

```kotlin
kover {
    reports {
        verify {
            rule {
                minBound(70)  // 70% line coverage minimum
            }
        }
    }
}
```

Track coverage trends over time. Do not enforce 100% -- focus on meaningful coverage of business logic.

## SHOULD: ArchUnit

Enforce module boundaries and architectural rules at test time. Write tests that verify domain does not depend on infrastructure and feature modules do not depend on each other (`slices().matching("..features.(*)..").should().notDependOnEachOther()`).

## SHOULD: Trivy

Dependency vulnerability scanning. Run `trivy fs --scanners vuln --severity HIGH,CRITICAL .` on every PR. Block merges on CRITICAL vulnerabilities only (`--exit-code 1 --severity CRITICAL`).

## MAY: SpotBugs

On-demand JVM bytecode analysis for null dereferences, resource leaks, and concurrency issues.

## MAY: PIT Mutation Testing

Run `./gradlew pitest` periodically on domain code. Target 80%+ mutation kill rate.

## CI Pipeline Integration

```yaml
# Recommended CI stage order
stages:
  - ktlintCheck          # Fast, fails first
  - detekt                # Static analysis
  - test                  # Unit + integration tests
  - koverVerify           # Coverage thresholds
  - trivy                 # Vulnerability scan
```

ktlint and Detekt run first because they are fastest and catch formatting/style issues before expensive test execution.

## Key Rules

| Rule | Detail |
|------|--------|
| ktlint | MUST -- zero config, CI gate, format before commit |
| Detekt | MUST -- 300+ rules, include compose-rules plugin |
| Kover | SHOULD -- 70% minimum, focus on business logic |
| ArchUnit | SHOULD -- enforce layer separation and module boundaries |
| Trivy | SHOULD -- block CRITICAL vulns on PRs |
| SpotBugs | MAY -- on-demand bytecode analysis |
| PIT | MAY -- periodic mutation testing on domain code |
| CI order | Lint -> analyze -> test -> coverage -> security |
