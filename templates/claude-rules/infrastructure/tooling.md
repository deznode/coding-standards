---
paths:
  - "**/Taskfile.yml"
  - "**/lefthook.yml"
  - "**/.editorconfig"
---

# Developer Tooling

> Full references: `docs/tooling/01-linting-formatting.md`, `docs/tooling/02-git-hooks.md`, `docs/tooling/03-task-runner.md`, `docs/tooling/04-editor-config.md`

## Task Runner (Taskfile v3)

Standard task taxonomy -- every project defines:

| Task | Purpose |
|------|---------|
| `check` | Verify prerequisites are installed |
| `setup` | Full-stack setup (env, deps, hooks) |
| `dev` | Start all services (parallel) |
| `test` | Run all tests |
| `lint` | Run all linters |
| `build` | Production builds |
| `clean` | Remove build artifacts |
| `db:reset` | Reset database (destructive) |

Each top-level task delegates to sub-tasks: `setup:api`, `setup:web`, `test:api`, `test:web`, etc.

## Pre-Commit Hooks (Lefthook)

All hooks run in parallel (`parallel: true`):

| Hook | Scope | Purpose |
|------|-------|---------|
| `gitleaks` | All staged | Secret scanning |
| `eslint` | `apps/web/**/*.{ts,tsx}` | Lint + auto-fix |
| `prettier-code` | `apps/web/**/*.{ts,tsx}` | Format code |
| `prettier-assets` | `apps/web/**/*.{json,css,yml}` | Format assets |
| `ktlint` | `apps/api/**/*.{kt,kts}` | Kotlin style |
| `detekt` | `apps/api/**/*.{kt,kts}` | Kotlin analysis |

Key patterns:
- `stage_fixed: true` for auto-fix hooks (re-stages modified files)
- `--max-warnings=0` on ESLint (zero-warning policy)
- `skip: [merge, rebase]` on gitleaks

## Linting Stack

| Tool | Language | Command |
|------|----------|---------|
| ESLint | TypeScript/JSX | `pnpm lint` |
| Prettier | TS/CSS/JSON | `npx prettier --write .` |
| ktlint | Kotlin | `./gradlew ktlintCheck` |
| detekt | Kotlin | `./gradlew detekt` |

## EditorConfig

Baseline formatting (`.editorconfig`):
- Default: 2-space indent, UTF-8, LF endings
- Kotlin/Java: 4-space indent
- Kotlin: `ktlint_standard_no-wildcard-imports = disabled`
- Markdown: `trim_trailing_whitespace = false`
