*[English](README.md) | [Portugues](README.pt.md) | [Kriolu](README.kea.md)*

# Deznode Coding Standards

Synthesized best-of-breed coding standards, tooling configurations, and development workflows extracted from two production projects. This repository provides reusable documentation, configuration templates, and Claude Code rules for bootstrapping new deznode projects.

## Tech Stack Covered

| Layer | Technologies |
|-------|-------------|
| **Backend** | Kotlin, Spring Boot 4, Spring Modulith 2.0, PostgreSQL, Flyway, Testcontainers |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand |
| **Tooling** | Taskfile v3, Lefthook, ESLint, Prettier, ktlint, detekt, EditorConfig |
| **Infrastructure** | Docker, Docker Compose, Terraform |

## Repository Structure

```
coding-standards/
├── docs/                          # Standalone reference documentation
│   ├── backend/
│   │   └── 01-architecture.md     # Spring Modulith architecture patterns
│   ├── frontend/
│   │   └── 01-architecture.md     # Next.js App Router architecture
│   ├── tooling/
│   │   ├── 01-linting-formatting.md   # ESLint, Prettier, ktlint, detekt
│   │   ├── 02-git-hooks.md            # Lefthook pre-commit hooks
│   │   ├── 03-task-runner.md          # Taskfile v3 setup
│   │   └── 04-editor-config.md        # EditorConfig settings
│   ├── git/
│   │   └── 01-workflow.md         # Commits, branches, PRs
│   └── testing/
│       └── 01-strategy.md         # Testing philosophy and tiers
├── templates/
│   ├── claude-rules/              # Claude Code rules (.claude/rules/)
│   │   ├── backend/               # Backend-specific rules
│   │   ├── frontend/              # Frontend-specific rules
│   │   └── infrastructure/        # Infrastructure rules
│   ├── configs/                   # Configuration file templates
│   └── claude-hooks/              # Claude Code hooks (.claude/hooks/)
└── README.md                      # This file
```

## How to Use

### Standalone Documentation (docs/)

Read these files for context and reference when working on any deznode project. Each document is self-contained and covers a specific concern (architecture, tooling, testing, git workflow).

### Claude Rules Templates (templates/claude-rules/)

Copy into a new project's `.claude/rules/` directory to give Claude Code project-specific knowledge:

```bash
cp -r templates/claude-rules/* /path/to/project/.claude/rules/
```

### Configuration Templates (templates/configs/)

Copy and adapt configuration files for new projects:

```bash
cp templates/configs/.editorconfig /path/to/project/
cp templates/configs/lefthook.yml /path/to/project/
cp templates/configs/Taskfile.yml /path/to/project/
```

Review and adjust paths, project names, and tool versions after copying.

### Claude Hooks (templates/claude-hooks/)

Copy into a new project's `.claude/hooks/` directory and configure in `.claude/settings.json`:

```bash
cp -r templates/claude-hooks/* /path/to/project/.claude/hooks/
```

## Quick Start: Bootstrapping a New Deznode Project

1. **Create the project repository** and clone it locally.

2. **Add this repo as a submodule** (or clone it alongside your project):
   ```bash
   git submodule add https://github.com/deznode/coding-standards.git coding-standards
   ```

3. **Copy editor and tooling configs**:
   ```bash
   cp coding-standards/templates/configs/.editorconfig .
   cp coding-standards/templates/configs/lefthook.yml .
   cp coding-standards/templates/configs/Taskfile.yml .
   ```

4. **Set up Claude Code rules**:
   ```bash
   mkdir -p .claude/rules
   cp -r coding-standards/templates/claude-rules/* .claude/rules/
   ```

5. **Set up Claude Code hooks**:
   ```bash
   mkdir -p .claude/hooks
   cp -r coding-standards/templates/claude-hooks/* .claude/hooks/
   ```

6. **Install git hooks**:
   ```bash
   lefthook install
   ```

7. **Customize**: Edit copied files to match your project's directory structure, module names, and tool versions.

8. **Reference the docs**: Use `docs/` as a living reference for architecture decisions, coding patterns, and workflow conventions.

## Documentation Index

### Backend

| Document | Description |
|----------|-------------|
| [Architecture](docs/backend/01-architecture.md) | Spring Modulith module layout, DDD patterns, event-driven communication |
| [API Design](docs/backend/02-api-design.md) | ApiResult wrappers, controllers, HTTP patterns, validation |
| [Kotlin Conventions](docs/backend/03-kotlin-conventions.md) | Jackson 3.x, kotlin-logging, transactions, naming conventions |
| [Database Patterns](docs/backend/04-database-patterns.md) | Flyway migrations, entities, UUID keys, JSONB, full-text search |
| [Security](docs/backend/05-security.md) | JWT authentication, exception hierarchy, rate limiting |
| [Testing](docs/backend/06-testing.md) | Integration tests, MockMvc, Testcontainers, modularity tests |

### Frontend

| Document | Description |
|----------|-------------|
| [Architecture](docs/frontend/01-architecture.md) | Next.js App Router, server components, client islands, caching |
| [Component Patterns](docs/frontend/02-component-patterns.md) | forwardRef, clsx, loading states, import organization |
| [State Management](docs/frontend/03-state-management.md) | Zustand, TanStack Query, query key factories, Zod schemas |
| [Styling](docs/frontend/04-styling.md) | 3-tier token architecture, dark mode, Tailwind CSS 4 |
| [API Client](docs/frontend/05-api-client.md) | Factory pattern, serverApi, client hooks, dual data fetching |

### Tooling

| Document | Description |
|----------|-------------|
| [Linting and Formatting](docs/tooling/01-linting-formatting.md) | ESLint, Prettier, ktlint, detekt configuration |
| [Git Hooks](docs/tooling/02-git-hooks.md) | Lefthook pre-commit hook setup |
| [Task Runner](docs/tooling/03-task-runner.md) | Taskfile v3 standard tasks |
| [Editor Config](docs/tooling/04-editor-config.md) | EditorConfig cross-editor settings |

### Workflow & Quality

| Document | Description |
|----------|-------------|
| [Git Workflow](docs/git/01-workflow.md) | Conventional commits, branching, PR process |
| [Testing Strategy](docs/testing/01-strategy.md) | Testing philosophy, tiers, and commands |

### Templates

| Directory | Description |
|-----------|-------------|
| [Claude Rules](templates/claude-rules/) | Claude Code rule files for `.claude/rules/` |
| [Config Templates](templates/configs/) | Reusable configuration files |
| [Claude Hooks](templates/claude-hooks/) | Claude Code hook scripts |

## Rule Severity Levels

Rules in the documentation use three severity levels to set expectations:

| Level | Meaning | Enforcement |
|-------|---------|-------------|
| **MUST** | Non-negotiable. Violations block PRs. | Automated (linter, CI gate, pre-commit hook) |
| **SHOULD** | Strong recommendation. Follow unless you have a documented reason not to. | Code review |
| **MAY** | Team preference. Use judgment based on context. | Informational |

Rules enforced by tooling (formatters, linters, CI) have near-100% compliance. Focus human attention on architecture, security, and correctness decisions.

## Exceptions

Deviating from a standard is acceptable when:

1. The rule doesn't apply to the specific context (e.g., a prototype, spike, or proof-of-concept).
2. Following the rule would introduce worse problems (performance, readability, or maintainability).
3. The rule conflicts with a third-party library or framework constraint.

**How to document an exception:**
- Add an inline comment explaining the deviation: `// Exception: [reason]`
- For architectural deviations, record an ADR (Architecture Decision Record).
- If the same exception recurs across multiple files, propose a rule change instead.

## Contributing to the Standard

These standards are living documents. To propose a change:

1. **Open a PR** against this repository with the proposed change.
2. **Include rationale** — explain what problem the change solves or what improvement it brings.
3. **Reference evidence** — link to incidents, code review discussions, or industry practices that support the change.
4. **Allow review time** — changes affect all projects. Give the team at least one week to comment.

Changes that remove rules require the same rigor as adding them. Document why the rule is no longer needed.

## Review Cadence

Review this standard **quarterly** to:
- Remove rules that no longer provide value.
- Add rules based on recurring bugs, code review friction, or new tooling.
- Update version references (Spring Boot, Next.js, Tailwind, etc.) as the stack evolves.
- Incorporate feedback from developers using the standard.

## Origin

Battle-tested coding standards distilled from production full-stack projects (Kotlin/Spring Boot 4 + Next.js 16).
