# Git Hooks

Lefthook-based pre-commit hooks for automated code quality enforcement. All hooks run in parallel for speed and catch issues before they enter the repository.

---

## Installation

### Install Lefthook

```bash
# macOS (standalone)
brew install lefthook

# Or as a project dev dependency (Node.js projects)
pnpm add -D lefthook
```

### Activate Hooks

```bash
# If installed globally
lefthook install

# If installed as a dev dependency
npx lefthook install
```

This creates the `.git/hooks/pre-commit` symlink. Run this once after cloning and after any `lefthook.yml` changes.

---

## Pre-Commit Hook Configuration

### Full Example (`lefthook.yml`)

```yaml
# Lefthook — Git hooks
# Install: brew install lefthook && lefthook install

pre-commit:
  parallel: true
  commands:
    gitleaks:
      run: gitleaks protect --staged --verbose
      skip:
        - merge
        - rebase

    eslint:
      glob: "apps/web/**/*.{ts,tsx,js,jsx}"
      root: "apps/web/"
      run: npx eslint --max-warnings=0 --fix {staged_files}
      stage_fixed: true

    prettier-code:
      glob: "apps/web/**/*.{ts,tsx,js,jsx}"
      root: "apps/web/"
      run: npx prettier --write {staged_files}
      stage_fixed: true

    prettier-assets:
      glob: "apps/web/**/*.{json,css,yml,yaml}"
      root: "apps/web/"
      run: npx prettier --write {staged_files}
      stage_fixed: true

    ktlint:
      glob: "apps/api/**/*.{kt,kts}"
      root: "apps/api/"
      run: ./gradlew ktlintCheck

    detekt:
      glob: "apps/api/**/*.{kt,kts}"
      root: "apps/api/"
      run: ./gradlew detekt
```

---

## Hook Breakdown

### Secret Scanning: gitleaks

```yaml
gitleaks:
  run: gitleaks protect --staged --verbose
  skip:
    - merge
    - rebase
```

- Scans staged files for secrets (API keys, tokens, passwords)
- `--staged`: Only checks files being committed (fast)
- `--verbose`: Shows details of any findings
- `skip`: Disabled during merge and rebase commits where you cannot control the incoming content
- Optionally point to a custom config: `--config .gitleaks.toml`

### Frontend Linting: ESLint

```yaml
eslint:
  glob: "apps/web/**/*.{ts,tsx,js,jsx}"
  root: "apps/web/"
  run: npx eslint --max-warnings=0 --fix {staged_files}
  stage_fixed: true
```

- `glob`: Only runs on staged TypeScript/JavaScript files in the web app
- `root`: Changes working directory so file paths resolve correctly
- `--max-warnings=0`: Fails the hook if any warnings exist
- `--fix`: Auto-fixes fixable issues (import ordering, spacing, etc.)
- `stage_fixed: true`: Automatically re-stages files that were auto-fixed

### Frontend Formatting: Prettier

```yaml
prettier-code:
  glob: "apps/web/**/*.{ts,tsx,js,jsx}"
  root: "apps/web/"
  run: npx prettier --write {staged_files}
  stage_fixed: true

prettier-assets:
  glob: "apps/web/**/*.{json,css,yml,yaml}"
  root: "apps/web/"
  run: npx prettier --write {staged_files}
  stage_fixed: true
```

Split into two commands to separate code files from asset files. Both use `--write` to format in-place and `stage_fixed: true` to re-stage.

### Backend Style: ktlint

```yaml
ktlint:
  glob: "apps/api/**/*.{kt,kts}"
  root: "apps/api/"
  run: ./gradlew ktlintCheck
```

- Checks Kotlin code style (does not auto-fix in pre-commit to avoid slow Gradle formatting)
- To auto-fix manually: `./gradlew ktlintFormat`

### Backend Analysis: detekt

```yaml
detekt:
  glob: "apps/api/**/*.{kt,kts}"
  root: "apps/api/"
  run: ./gradlew detekt
```

- Runs static analysis for code smells and complexity
- Blocks commit if detekt rules are violated

---

## Key Configuration Patterns

### `stage_fixed: true` vs Manual Re-staging

**Preferred** (`stage_fixed: true`):

```yaml
eslint:
  run: npx eslint --max-warnings=0 --fix {staged_files}
  stage_fixed: true
```

Lefthook automatically re-stages files that were modified by `--fix` or `--write`. This is cleaner and avoids race conditions.

**Legacy** (manual `git add`):

```yaml
eslint:
  run: npx eslint --max-warnings=0 --fix {staged_files} && git add {staged_files}
```

This works but is less robust. Prefer `stage_fixed: true` for new projects.

### Parallel Execution

```yaml
pre-commit:
  parallel: true
```

All commands run in parallel for speed. Each command operates on different file types or directories, so there are no conflicts. A single failure in any command blocks the commit.

### Glob Filtering

```yaml
glob: "apps/web/**/*.{ts,tsx,js,jsx}"
root: "apps/web/"
```

- `glob`: Selects which staged files trigger this hook
- `root`: Sets the working directory for the command
- Combined, they ensure hooks only run on relevant files and resolve paths correctly in a monorepo

### Skip Conditions

```yaml
skip:
  - merge
  - rebase
```

Skips the hook during merge and rebase operations. Useful for gitleaks where merged content may trigger false positives for secrets that were already committed.

---

## Customization

### Adjusting Paths

Update `glob` and `root` to match your project structure:

```yaml
# Single-app project (no monorepo)
eslint:
  glob: "**/*.{ts,tsx,js,jsx}"
  run: npx eslint --max-warnings=0 --fix {staged_files}
  stage_fixed: true

# Different monorepo layout
eslint:
  glob: "packages/frontend/**/*.{ts,tsx,js,jsx}"
  root: "packages/frontend/"
  run: npx eslint --max-warnings=0 --fix {staged_files}
  stage_fixed: true
```

### Adding Custom Hooks

Add project-specific hooks as additional commands under `pre-commit`:

```yaml
pre-commit:
  parallel: true
  commands:
    # ... existing hooks ...

    content-validation:
      glob: "content/**/*.mdx"
      run: npx tsx scripts/validate-content.ts
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Hooks not running | Run `lefthook install` to recreate git hook symlinks |
| `gitleaks: command not found` | Install with `brew install gitleaks` |
| ESLint errors on unrelated files | Check `glob` pattern matches only intended files |
| Slow pre-commit | Verify `parallel: true` is set; check individual hook times |
| Hook blocks merge commit | Add `skip: [merge]` to the offending command |
