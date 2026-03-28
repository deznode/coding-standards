# Git Workflow

Conventions for commits, branches, pull requests, and code review.

---

## Conventional Commits

All commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types

| Type | When to Use |
|------|------------|
| `feat` | A new feature or user-facing capability |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Code style changes (formatting, semicolons, whitespace) |
| `refactor` | Code restructuring without changing behavior |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (dependencies, CI config, build scripts) |

### Scope

Use the module or area name in parentheses for targeted changes:

```
feat(auth): add JWT token refresh endpoint
fix(dashboard): resolve chart rendering on mobile
docs(api): update endpoint documentation for v2
refactor(orders): extract payment processing to dedicated service
test(users): add integration tests for profile updates
chore(deps): bump Spring Boot to 4.1.0
```

Scope is optional but recommended when the change is clearly within one module.

### Commit Message Examples

```
feat(directory): add search filters for business categories
fix(auth): resolve JWT token refresh loop
docs(api): update endpoint documentation for v2
style(web): apply prettier formatting to config files
refactor(orders): extract validation logic to value objects
test(inventory): add Testcontainers integration tests
chore(ci): update GitHub Actions to Node 22
```

### Rules

- **Imperative mood**: "add feature" not "added feature" or "adds feature"
- **Lowercase first word**: "add search filters" not "Add search filters"
- **No period at end**: "add search filters" not "add search filters."
- **50-character limit** for the subject line (soft limit, 72 hard)
- **Body** for the "why": If the commit needs explanation, add a blank line and a body paragraph

---

## Branch Naming

Use descriptive branch names with type prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/add-map-filters` |
| `fix/` | Bug fixes | `fix/login-redirect-issue` |
| `docs/` | Documentation changes | `docs/update-api-reference` |
| `refactor/` | Code restructuring | `refactor/extract-auth-hook` |

### Branch Name Rules

- Lowercase with hyphens: `feature/add-user-search` (not `Feature/AddUserSearch`)
- Descriptive but concise: `fix/login-redirect` (not `fix/issue-with-the-login-page-redirect-not-working`)
- Reference issue numbers when applicable: `fix/123-login-redirect`

---

## Pull Request Process

### Creating a PR

1. **Fork the repository** (for external contributors) or create a branch (for team members)
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the coding standards
4. **Commit** with conventional commit messages
5. **Update your branch** with the latest `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
6. **Push** to your fork or remote branch:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** on GitHub with:
   - A clear title describing the change
   - A description explaining what and why
   - Reference to related issues (e.g., "Closes #123")

### PR Requirements

- All CI checks must pass (lint, typecheck, tests, build)
- Code follows project style guidelines (enforced by pre-commit hooks)
- New features include appropriate tests
- Documentation is updated if behavior changes

### Review Guidelines

- **All contributions require review** by at least one maintainer
- Focus on **clarity**, **correctness**, and **maintainability**
- Be constructive and specific in feedback
- Iterate based on review comments
- Approve only when all concerns are addressed

---

## Pre-Commit Hook Enforcement

Pre-commit hooks (via Lefthook) run automatically before every commit:

- **gitleaks**: Scans for secrets (API keys, tokens, passwords)
- **ESLint**: Lints TypeScript/JavaScript with `--max-warnings=0`
- **Prettier**: Formats frontend code and assets
- **ktlint**: Checks Kotlin code style
- **detekt**: Runs Kotlin static analysis

If any hook fails, the commit is blocked. Fix the issue and re-commit.

See [Git Hooks](../tooling/02-git-hooks.md) for the full Lefthook configuration.

---

## Common Workflow

### Starting New Work

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-user-search

# Make changes, commit as you go
git add src/components/search-bar.tsx
git commit -m "feat(search): add search bar component"

git add src/hooks/use-search.ts
git commit -m "feat(search): add search hook with debounce"
```

### Preparing for PR

```bash
# Rebase on latest main
git fetch origin
git rebase origin/main

# Push (force-push if rebased)
git push origin feature/add-user-search
```

### After PR Feedback

```bash
# Make requested changes
git add .
git commit -m "fix(search): address PR feedback on error handling"
git push origin feature/add-user-search
```

---

## Summary

| Convention | Standard |
|-----------|----------|
| Commit format | Conventional Commits (`type(scope): description`) |
| Branch naming | `feature/`, `fix/`, `docs/`, `refactor/` + kebab-case |
| PR base branch | `main` |
| Pre-commit hooks | Lefthook (gitleaks + ESLint + Prettier + ktlint + detekt) |
| Review required | At least one maintainer approval |
