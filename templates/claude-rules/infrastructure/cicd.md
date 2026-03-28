---
paths:
  - infrastructure/**
  - .github/**
---

# CI/CD and Infrastructure

> Full references: `docs/tooling/03-task-runner.md`, `docs/git/01-workflow.md`

## Docker Compose (Local Development)

Infrastructure services (database, cache, etc.) run via Docker Compose:

```yaml
# infrastructure/docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Common commands:
- `task dev:db` -- start database
- `task db:reset` -- destroy and recreate (destructive)
- `task stop` -- stop all containers

## CI/CD Workflow Taxonomy

Standard pipeline stages:

| Stage | Backend | Frontend |
|-------|---------|----------|
| Lint | `./gradlew ktlintCheck` + `./gradlew detekt` | `pnpm lint` |
| Typecheck | (compile) | `tsc --noEmit` |
| Test | `./gradlew test` | `pnpm test:unit` |
| Build | `./gradlew bootBuildImage` | `pnpm build` |
| Secret scan | `gitleaks detect` | `gitleaks detect` |

All CI checks must pass before merge (enforced via branch protection).

## Build Patterns

### Backend (Spring Boot)

```bash
# Development
./gradlew bootRun --args='--spring.profiles.active=local'

# Container image (Cloud Native Buildpacks)
./gradlew bootBuildImage
```

### Frontend (Next.js)

```bash
# Development (Turbopack)
pnpm dev

# Production build
pnpm build
```

## Deployment Conventions

- Spring profiles: `local`, `test`, `production`
- Environment variables for secrets (never hardcoded)
- Health check endpoints for readiness/liveness probes
- Flyway runs migrations on startup (production uses `migration + seed` dirs)

## Conventional Commits in CI

Commit format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Branch prefixes: `feature/`, `fix/`, `docs/`, `refactor/`

See `docs/git/01-workflow.md` for full conventions.
