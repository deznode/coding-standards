# Changelog

All notable changes to the deznode code standard are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.0] - 2026-04-05

### Added

- **Frontend Performance doc** (`docs/frontend/06-performance.md`): 21 performance optimization rules across 3 tiers (Eliminating Waterfalls, Bundle Size, Server-Side Performance), adapted from Vercel Engineering best practices for the deznode Next.js/React stack
- **Claude rule** (`templates/claude-rules/frontend/performance.md`): Condensed performance patterns for Claude Code

## [1.2.0] - 2026-04-05

### Added

- **Mobile (Android/KMP) documentation** (`docs/mobile/`): 7 new standards documents covering KMP architecture, build configuration, Compose patterns, Kotlin conventions, offline-first architecture, testing, and quality tooling
- **Mobile Claude rule templates** (`templates/claude-rules/mobile/`): 7 path-scoped rule files for mobile/KMP projects
- **KMP ecosystem detection** in `detect_standards.py`: Detects Kotlin Multiplatform projects via `shared/src/commonMain/` directory structure or multiplatform plugin references in `build.gradle.kts`
- **KMP bootstrap example** (`EXAMPLES.md`): Example 5 demonstrating mobile project bootstrap
- **KMP troubleshooting** (`TROUBLESHOOTING.md`): "KMP/Android Ecosystem Not Detected" section

### Changed

- **README.md** and **README.pt.md**: Added Mobile (Android/KMP) section to tech stack table, repository structure, and documentation index
- **SKILL.md**: Added mobile trigger phrases and KMP/Android ecosystem support
- **WORKFLOW.md**: Added Mobile (7 rules) to bootstrap options, KMP path collection, and ecosystem-to-template mapping table
- **detect_standards.py**: Added `"mobile"` to `RULE_CATEGORIES` and KMP/Android detection logic in `detect_ecosystems()`

## [1.1.0] - 2026-04-04

### Added

- **Error Handling doc** (`docs/backend/07-error-handling.md`): Sealed class exception hierarchies per module, ProblemDetail (RFC 9457) response format, ordered `@RestControllerAdvice` handlers, rich domain state transitions
- **Command Objects + Mapper pattern** in API design (`02-api-design.md`): Separation of Request DTOs from domain Commands with `{Action}{Resource}Command` naming, `object {Module}Mapper` pattern bridging HTTP and domain layers
- **MockK testing patterns** (`06-testing.md`): MockK as preferred mocking library over Mockito, `@MockkBean`, `slot<T>()` argument capture, relaxed mocks, Mockito-to-MockK migration table
- **Test Fixtures pattern** (`06-testing.md`): `object {Module}Fixtures` factory objects with sensible defaults for declarative test setup
- **Domain Unit Tests** section (`06-testing.md`): Pure Kotlin tests with MockK, entity-level tests for domain invariants
- **Claude rule** (`templates/claude-rules/backend/error-handling.md`): Condensed error handling patterns for Claude Code

### Changed

- **Security doc** (`05-security.md`): Moved error handling to dedicated `07-error-handling.md`, retained JWT, auth, and rate limiting
- **API Design doc** (`02-api-design.md`): Updated error format to reference ProblemDetail, updated module layout with commands/mappers/exceptions, updated controller example with Command flow
- **Testing doc** (`06-testing.md`): Replaced Mockito with MockK throughout, updated slice test examples, expanded test organization summary
- **Kotlin Conventions** (`03-kotlin-conventions.md`): Added naming conventions for Commands, Exceptions, Mappers, Fixtures; updated DTO mapping section with Mapper object alternative
- **Architecture doc** (`01-architecture.md`): Updated module package layout with exception/command/mapper placements, updated request flow diagram with Command intermediary, updated shared kernel listing
- **Claude rules**: Updated `security.md`, `api-patterns.md`, `testing-patterns.md`, `kotlin-conventions.md` to reflect new patterns

## [1.0.0] - 2026-03-27

### Added

- **Backend docs**: Architecture (Spring Modulith + DDD), API design (ApiResult wrappers), Kotlin conventions (Jackson 3.x, kotlin-logging), database patterns (Flyway, JSONB, UUID keys), security (JWT, rate limiting), testing (Testcontainers, MockMvc)
- **Frontend docs**: Architecture (App Router, server components, donut pattern), component patterns (forwardRef, clsx), state management (Zustand, TanStack Query, query key factories), styling (3-tier token architecture, dark mode), API client (factory pattern, dual data fetching)
- **Tooling docs**: Linting/formatting (ESLint + perfectionist, Prettier, ktlint, detekt), git hooks (Lefthook with stage_fixed), task runner (Taskfile v3), editor config
- **Workflow docs**: Git workflow (conventional commits, branching), testing strategy (verification tiers)
- **Claude rules templates**: 13 ready-to-copy `.claude/rules/` files for backend, frontend, and infrastructure
- **Config templates**: .editorconfig, .prettierrc, eslint.config.mjs, lefthook.yml, Taskfile.yml
- **Claude hooks**: Auto-lint hook (ESLint on Edit/Write) with settings.json
- **Adoption infrastructure**: Severity levels, exception process, contributing guide, review cadence

Initial release.
