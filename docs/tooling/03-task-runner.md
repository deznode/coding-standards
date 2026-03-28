# Task Runner

Taskfile v3 provides a unified command interface for full-stack development. Every developer operation (setup, dev, test, lint, build, clean) has a single `task` command regardless of the underlying toolchain.

---

## Installation

```bash
# macOS
brew install go-task

# Or via npm
npm install -g @go-task/cli
```

Verify: `task --version`

---

## Standard Task Taxonomy

Every project should define these standard tasks:

| Task | Description |
|------|-------------|
| `check` | Verify all prerequisites are installed |
| `setup` | Full-stack setup (env files, dependencies, git hooks) |
| `dev` | Start all services for local development |
| `test` | Run all tests (backend + frontend) |
| `lint` | Run all linters (ktlint + ESLint) |
| `build` | Build all applications for production |
| `clean` | Remove build artifacts |
| `db:reset` | Reset the database (destructive) |

Each top-level task delegates to sub-tasks for individual components (`setup:api`, `setup:web`, `test:api`, `test:web`, etc.).

---

## Skeleton Taskfile (`Taskfile.yml`)

```yaml
version: "3"

vars:
  API_DIR: apps/api
  WEB_DIR: apps/web
  DOCKER_COMPOSE: infrastructure/docker/docker-compose.yml

tasks:
  # ─── Prerequisites ───────────────────────────────────────────────
  check:
    desc: Check prerequisites -- detect missing tools with install instructions
    silent: true
    cmds:
      - |
        missing=0

        check_tool() {
          if command -v "$1" &> /dev/null; then
            printf "  ✓ %-10s %s\n" "$1" "$(eval "$3")"
          else
            printf "  ✗ %-10s missing -- install with: %s\n" "$1" "$2"
            missing=$((missing + 1))
          fi
        }

        echo "Checking prerequisites..."
        echo ""
        check_tool "docker"    "brew install --cask docker"    "docker --version | head -1"
        check_tool "node"      "nvm install --lts"             "node --version"
        check_tool "pnpm"      "npm install -g pnpm"           "pnpm --version"
        check_tool "java"      "sdk install java"              "java --version 2>&1 | head -1"
        check_tool "lefthook"  "brew install lefthook"          "lefthook version"
        echo ""

        if [ "$missing" -gt 0 ]; then
          echo "⚠ $missing tool(s) missing. Install them and re-run: task check"
          exit 1
        else
          echo "All prerequisites installed."
        fi

  # ─── Setup ───────────────────────────────────────────────────────
  setup:
    desc: Full-stack setup -- env templates, dependencies, git hooks
    cmds:
      - task: setup:api
      - task: setup:web
      - task: setup:infra
      - task: setup:hooks

  setup:api:
    desc: API setup -- copy env templates if missing
    cmds:
      - |
        if [ ! -f {{.API_DIR}}/.env.local ]; then
          cp {{.API_DIR}}/.env.local.example {{.API_DIR}}/.env.local
          echo "Created {{.API_DIR}}/.env.local from template"
        else
          echo "{{.API_DIR}}/.env.local already exists, skipping"
        fi

  setup:web:
    desc: Web setup -- copy env template if missing, install dependencies
    cmds:
      - |
        if [ ! -f {{.WEB_DIR}}/.env.local ]; then
          cp {{.WEB_DIR}}/.env.local.example {{.WEB_DIR}}/.env.local
          echo "Created {{.WEB_DIR}}/.env.local from template"
        else
          echo "{{.WEB_DIR}}/.env.local already exists, skipping"
        fi
      - cd {{.WEB_DIR}} && pnpm install

  setup:infra:
    desc: Infrastructure setup -- start database and supporting services
    cmds:
      - docker compose -f {{.DOCKER_COMPOSE}} up -d

  setup:hooks:
    desc: Install git hooks via Lefthook
    cmds:
      - |
        if command -v lefthook &> /dev/null; then
          lefthook install
          echo "Git hooks installed via Lefthook"
        else
          echo "Warning: lefthook is not installed. Install with: brew install lefthook"
        fi

  # ─── Development ─────────────────────────────────────────────────
  dev:
    desc: Full-stack dev -- start API + web in parallel
    deps:
      - dev:api
      - dev:web

  dev:api:
    desc: Start API server (Spring Boot)
    dir: "{{.API_DIR}}"
    cmds:
      - ./gradlew bootRun --args='--spring.profiles.active=local'

  dev:web:
    desc: Start web dev server with Turbopack
    dir: "{{.WEB_DIR}}"
    env:
      WATCHPACK_POLLING: "true"
      CHOKIDAR_USEPOLLING: "true"
    cmds:
      - pnpm run dev

  dev:db:
    desc: Start database only -- useful when backend is not needed
    cmds:
      - docker compose -f {{.DOCKER_COMPOSE}} up -d

  # ─── Testing ─────────────────────────────────────────────────────
  test:
    desc: Run all tests -- API + web
    cmds:
      - task: test:api
      - task: test:web

  test:api:
    desc: Run API tests (uses Testcontainers)
    dir: "{{.API_DIR}}"
    cmds:
      - ./gradlew test

  test:web:
    desc: Run web lint, typecheck, and unit tests
    dir: "{{.WEB_DIR}}"
    cmds:
      - pnpm run lint
      - npx tsc --noEmit
      - pnpm run test:unit

  # ─── Linting ─────────────────────────────────────────────────────
  lint:
    desc: Run all linters -- ktlint + ESLint
    cmds:
      - task: lint:api
      - task: lint:web

  lint:api:
    desc: Run Kotlin linter (ktlint)
    dir: "{{.API_DIR}}"
    cmds:
      - ./gradlew ktlintCheck

  lint:web:
    desc: Run ESLint
    dir: "{{.WEB_DIR}}"
    cmds:
      - pnpm run lint

  # ─── Build ───────────────────────────────────────────────────────
  build:
    desc: Build all applications for production
    cmds:
      - task: build:api
      - task: build:web

  build:api:
    desc: Build API (Spring Boot buildpacks)
    dir: "{{.API_DIR}}"
    cmds:
      - ./gradlew bootBuildImage

  build:web:
    desc: Build web application
    dir: "{{.WEB_DIR}}"
    cmds:
      - pnpm build

  # ─── Database ────────────────────────────────────────────────────
  db:reset:
    desc: Reset the database (WARNING -- destroys all data)
    cmds:
      - docker compose -f {{.DOCKER_COMPOSE}} down -v
      - docker compose -f {{.DOCKER_COMPOSE}} up -d

  # ─── Cleanup ─────────────────────────────────────────────────────
  stop:
    desc: Stop all containers
    cmds:
      - docker compose -f {{.DOCKER_COMPOSE}} down

  clean:
    desc: Clean build artifacts
    cmds:
      - task: clean:api
      - task: clean:web

  clean:api:
    desc: Clean API build artifacts
    dir: "{{.API_DIR}}"
    cmds:
      - ./gradlew clean

  clean:web:
    desc: Clean web build artifacts
    dir: "{{.WEB_DIR}}"
    cmds:
      - rm -rf .next
```

---

## Key Patterns

### Variable Extraction

```yaml
vars:
  API_DIR: apps/api
  WEB_DIR: apps/web
  DOCKER_COMPOSE: infrastructure/docker/docker-compose.yml
```

Define paths as variables at the top of the Taskfile. This makes the configuration easy to adapt when directory structures differ between projects.

### Prerequisite Checking

The `check` task uses a `check_tool` shell function to verify each required tool:

```bash
check_tool() {
  if command -v "$1" &> /dev/null; then
    printf "  ✓ %-10s %s\n" "$1" "$(eval "$3")"
  else
    printf "  ✗ %-10s missing -- install with: %s\n" "$1" "$2"
    missing=$((missing + 1))
  fi
}
```

Each tool check includes:
1. The command name to look for
2. The install instruction to display if missing
3. A version command to display if found

### Parallel Development Startup

```yaml
dev:
  deps:
    - dev:api
    - dev:web
```

Using `deps` instead of `cmds` runs the API and web servers in parallel. Both processes start simultaneously and output is interleaved.

### Idempotent Setup

Setup tasks check for existing files before copying templates:

```yaml
- |
  if [ ! -f {{.API_DIR}}/.env.local ]; then
    cp {{.API_DIR}}/.env.local.example {{.API_DIR}}/.env.local
    echo "Created from template"
  else
    echo "Already exists, skipping"
  fi
```

This makes `task setup` safe to run repeatedly without overwriting local configuration.

### Destructive Task Warnings

Database reset and other destructive operations include clear warnings in the description:

```yaml
db:reset:
  desc: Reset the database (WARNING -- destroys all data)
```

---

## Adapting for Your Project

1. **Update `vars`**: Set `API_DIR`, `WEB_DIR`, and `DOCKER_COMPOSE` to match your directory layout.
2. **Add/remove tools** in the `check` task based on your stack.
3. **Adjust build commands**: Replace `bootBuildImage` with `build` or `jibDockerBuild` if using a different build strategy.
4. **Add project-specific tasks**: Content validation, database migrations, deployment scripts, etc.
