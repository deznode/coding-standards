# Changelog

All notable changes to the deznode code standard are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
