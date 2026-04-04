[🇬🇧 English](README.md) · [🇨🇻 Portugues](README.pt.md)

# Deznode Coding Standards

Normas de desenvolvimento, configuracoes de ferramentas e fluxos de trabalho para projetos deznode. Este repositorio fornece documentacao reutilizavel, templates de configuracao e regras para Claude Code, para iniciar novos projetos.

## Stack Tecnologica

| Camada | Tecnologias |
|--------|-------------|
| **Backend** | Kotlin, Spring Boot 4, Spring Modulith 2.0, PostgreSQL, Flyway, Testcontainers |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand |
| **Ferramentas** | Taskfile v3, Lefthook, ESLint, Prettier, ktlint, detekt, EditorConfig |
| **Infraestrutura** | Docker, Docker Compose, Terraform |

## Inicio Rapido: Criar um Novo Projeto Deznode

1. **Criar o repositorio** e clonar localmente.

2. **Clonar este repo** ao lado do projeto:
   ```bash
   git clone https://github.com/deznode/coding-standards.git
   ```

3. **Copiar configuracoes do editor e ferramentas**:
   ```bash
   cp coding-standards/templates/configs/.editorconfig .
   cp coding-standards/templates/configs/lefthook.yml .
   cp coding-standards/templates/configs/Taskfile.yml .
   ```

4. **Configurar regras do Claude Code**:
   ```bash
   mkdir -p .claude/rules
   cp -r coding-standards/templates/claude-rules/* .claude/rules/
   ```

5. **Configurar hooks do Claude Code**:
   ```bash
   mkdir -p .claude/hooks
   cp -r coding-standards/templates/claude-hooks/* .claude/hooks/
   ```

6. **Instalar git hooks**:
   ```bash
   lefthook install
   ```

7. **Personalizar**: Editar os ficheiros copiados para corresponder a estrutura do projeto, nomes dos modulos e versoes das ferramentas.

8. **Consultar a documentacao**: Usar `docs/` como referencia para decisoes de arquitetura, padroes de codigo e convencoes de fluxo de trabalho.

## Documentacao

Toda a documentacao detalhada esta em ingles na pasta `docs/`. Abaixo os links diretos:

### Backend

| Documento | Descricao |
|-----------|-----------|
| [Architecture](docs/backend/01-architecture.md) | Spring Modulith, padroes DDD, comunicacao por eventos |
| [API Design](docs/backend/02-api-design.md) | Controllers, padroes HTTP, validacao |
| [Kotlin Conventions](docs/backend/03-kotlin-conventions.md) | Jackson 3.x, logging, transacoes, convencoes de nomes |
| [Database Patterns](docs/backend/04-database-patterns.md) | Flyway, entidades, UUID, JSONB, pesquisa full-text |
| [Security](docs/backend/05-security.md) | Autenticacao JWT, autorizacao, rate limiting |
| [Testing](docs/backend/06-testing.md) | Testes de integracao, MockMvc, MockK, Testcontainers, fixtures |
| [Error Handling](docs/backend/07-error-handling.md) | Hierarquia de excecoes sealed, ProblemDetail (RFC 9457), @ControllerAdvice |

### Frontend

| Documento | Descricao |
|-----------|-----------|
| [Architecture](docs/frontend/01-architecture.md) | Next.js App Router, server components, caching |
| [Component Patterns](docs/frontend/02-component-patterns.md) | forwardRef, clsx, loading states |
| [State Management](docs/frontend/03-state-management.md) | Zustand, TanStack Query, Zod schemas |
| [Styling](docs/frontend/04-styling.md) | Tokens de design, dark mode, Tailwind CSS 4 |
| [API Client](docs/frontend/05-api-client.md) | Factory pattern, hooks, data fetching |

### Ferramentas e Qualidade

| Documento | Descricao |
|-----------|-----------|
| [Git Workflow](docs/git/01-workflow.md) | Conventional commits, branches, PRs |
| [Testing Strategy](docs/testing/01-strategy.md) | Filosofia de testes e niveis |
| [Linting](docs/tooling/01-linting-formatting.md) | ESLint, Prettier, ktlint, detekt |

## Como Contribuir

Estas normas sao documentos vivos. Para propor uma alteracao:

1. **Abrir um PR** neste repositorio com a alteracao proposta.
2. **Incluir justificacao** — explicar que problema a alteracao resolve.
3. **Referenciar evidencias** — linkar incidentes, discussoes de code review ou praticas da industria.
4. **Dar tempo para revisao** — as alteracoes afetam todos os projetos. Dar pelo menos uma semana para comentarios.

