*[English](README.md) | [Portugues](README.pt.md) | [Kriolu](README.kea.md)*

# Deznode Coding Standards

Normas di dizenvolvimentu, konfigurasoes di ferramentas i fluxus di trabalhu tirado di projetus di produsao. Es repositoriu ta fornese dokumentasao reutilizavel, templates di konfigurasao i regras pa Claude Code, pa inisia projetus novu di deznode.

## Stack Teknolojiku

| Kamada | Teknolojias |
|--------|-------------|
| **Backend** | Kotlin, Spring Boot 4, Spring Modulith 2.0, PostgreSQL, Flyway, Testcontainers |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand |
| **Ferramentas** | Taskfile v3, Lefthook, ESLint, Prettier, ktlint, detekt, EditorConfig |
| **Infraestrutura** | Docker, Docker Compose, Terraform |

## Inisiu Rapidu: Kria um Projetu Novu Deznode

1. **Kria repositoriu** i klona lokal.

2. **Junta es repo komu submodulu** (o klona djuntu ku bu projetu):
   ```bash
   git submodule add https://github.com/deznode/coding-standards.git coding-standards
   ```

3. **Kopia konfigurasoes di editor i ferramentas**:
   ```bash
   cp coding-standards/templates/configs/.editorconfig .
   cp coding-standards/templates/configs/lefthook.yml .
   cp coding-standards/templates/configs/Taskfile.yml .
   ```

4. **Konfigura regras di Claude Code**:
   ```bash
   mkdir -p .claude/rules
   cp -r coding-standards/templates/claude-rules/* .claude/rules/
   ```

5. **Konfigura hooks di Claude Code**:
   ```bash
   mkdir -p .claude/hooks
   cp -r coding-standards/templates/claude-hooks/* .claude/hooks/
   ```

6. **Instala git hooks**:
   ```bash
   lefthook install
   ```

7. **Personaliza**: Edita ficheiros kopiadu pa korrespondi ku estrutura di bu projetu, nomi di modulus i versoes di ferramentas.

8. **Konsulta dokumentasao**: Uza `docs/` komu referensia pa desizoes di arkitetura, padroes di kodigo i konvensoes di fluxu di trabalhu.

## Dokumentasao

Tudu dokumentasao detalhadu sta na ingles na pasta `docs/`. Abaxu links diretu:

### Backend

| Dokumentu | Diskrisao |
|-----------|-----------|
| [Architecture](docs/backend/01-architecture.md) | Spring Modulith, padroes DDD, komunikasao por eventus |
| [API Design](docs/backend/02-api-design.md) | Controllers, padroes HTTP, validasao |
| [Kotlin Conventions](docs/backend/03-kotlin-conventions.md) | Jackson 3.x, logging, transasoes, konvensoes di nomis |
| [Database Patterns](docs/backend/04-database-patterns.md) | Flyway, entidadis, UUID, JSONB, piskiza full-text |
| [Security](docs/backend/05-security.md) | Autentikasao JWT, hierarkia di eksesoes, rate limiting |
| [Testing](docs/backend/06-testing.md) | Testis di integrasao, MockMvc, Testcontainers |

### Frontend

| Dokumentu | Diskrisao |
|-----------|-----------|
| [Architecture](docs/frontend/01-architecture.md) | Next.js App Router, server components, caching |
| [Component Patterns](docs/frontend/02-component-patterns.md) | forwardRef, clsx, loading states |
| [State Management](docs/frontend/03-state-management.md) | Zustand, TanStack Query, Zod schemas |
| [Styling](docs/frontend/04-styling.md) | Tokens di dizain, dark mode, Tailwind CSS 4 |
| [API Client](docs/frontend/05-api-client.md) | Factory pattern, hooks, data fetching |

### Ferramentas i Qualidadi

| Dokumentu | Diskrisao |
|-----------|-----------|
| [Git Workflow](docs/git/01-workflow.md) | Conventional commits, branches, PRs |
| [Testing Strategy](docs/testing/01-strategy.md) | Filozofia di testis i niveis |
| [Linting](docs/tooling/01-linting-formatting.md) | ESLint, Prettier, ktlint, detekt |

## Modi di Kontribui

Es normas e dokumentus vivu. Pa propoe um mudansa:

1. **Abri um PR** na es repositoriu ku mudansa proposta.
2. **Inklui justifikasao** — splika ki problema mudansa ta risolvi.
3. **Referensia evidensias** — linka insidentis, diskusoes di code review o pratikas di industria.
4. **Da tempu pa revisao** — mudansas ta afeta tudu projetus. Da pelo menus um semana pa komentarius.

## Orijem

Normas di dizenvolvimentu testadu na produsao, tiradu di projetus full-stack (Kotlin/Spring Boot 4 + Next.js 16).
