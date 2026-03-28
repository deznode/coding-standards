# Linting and Formatting

Unified linting and formatting configuration for full-stack projects with Kotlin backend and Next.js frontend.

---

## Frontend: ESLint

### Base Configuration

Use the Next.js flat config with core-web-vitals and TypeScript support, plus eslint-plugin-perfectionist for deterministic import ordering.

**Dependencies**:

```bash
pnpm add -D eslint eslint-config-next eslint-plugin-perfectionist
```

### ESLint Config (`eslint.config.mjs`)

```js
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Add project-specific ignores here
  ]),
  // Import ordering rules
  {
    plugins: { perfectionist },
    rules: {
      "perfectionist/sort-imports": [
        "warn",
        {
          type: "alphabetical",
          order: "asc",
          ignoreCase: true,
          internalPattern: ["^@/.+"],
          newlinesBetween: 1,
          groups: [
            "type-import",
            "value-builtin",
            "value-external",
            "value-internal",
            "type-internal",
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "ts-equals-import",
            "unknown",
          ],
        },
      ],
      "perfectionist/sort-named-imports": [
        "warn",
        {
          type: "alphabetical",
          order: "asc",
          ignoreCase: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
```

### Key ESLint Conventions

- **`--max-warnings=0`**: Treat warnings as errors in CI and pre-commit hooks. This prevents gradual degradation.
- **`@typescript-eslint/no-unused-vars`**: Allow underscore-prefixed variables (`_unused`) to suppress unused warnings intentionally.
- **Flat config**: Use `defineConfig()` and `globalIgnores()` from `eslint/config` (not the legacy `.eslintrc` format).
- **Import ordering**: eslint-plugin-perfectionist enforces alphabetical sorting grouped by type imports, builtins, externals, internals, then relative paths. This eliminates import ordering debates in code review.

### Test File Overrides

For test files, relax rules that interfere with testing patterns:

```js
// Add to defineConfig array
{
  files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
  },
},
```

---

## Frontend: Prettier

### Configuration (`.prettierrc`)

```json
{
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf",
  "printWidth": 80,
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "useTabs": false,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/app/globals.css"
}
```

**Dependencies**:

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

### Key Prettier Conventions

- **`prettier-plugin-tailwindcss`**: Automatically sorts Tailwind CSS classes in a consistent order. Requires pointing `tailwindStylesheet` to the main CSS file that imports Tailwind.
- **Double quotes**: Standardize on double quotes (`singleQuote: false`) for consistency with JSX.
- **80-character print width**: Keeps code readable in side-by-side diffs and smaller screens.
- **ES5 trailing commas**: Cleaner diffs when adding items to arrays/objects.

---

## Backend: ktlint

### Kotlin Style Checking

ktlint is integrated via the Gradle plugin. No separate installation required.

**Commands**:

```bash
# Check code style
./gradlew ktlintCheck

# Auto-format code
./gradlew ktlintFormat
```

### EditorConfig Integration

ktlint reads rules from `.editorconfig`. Key Kotlin-specific settings:

```ini
[*.{kt,kts}]
indent_size = 4
ktlint_standard_no-wildcard-imports = disabled
```

Disabling `no-wildcard-imports` allows wildcard imports for Spring and Kotlin standard library patterns where they are idiomatic.

---

## Backend: detekt

### Kotlin Static Analysis

detekt provides deeper static analysis beyond style checking, catching code smells, complexity issues, and potential bugs.

**Commands**:

```bash
# Run static analysis
./gradlew detekt
```

### Integration with ktlint

Use both tools together:
- **ktlint**: Formatting and style (fast, auto-fixable)
- **detekt**: Code quality, complexity, and correctness (deeper analysis)

Both run as pre-commit hooks (see [Git Hooks](02-git-hooks.md)) and in CI.

---

## Running All Linters

Use the task runner to execute all linters across the stack:

```bash
# All linters
task lint

# Backend only
task lint:api    # Runs ./gradlew ktlintCheck

# Frontend only
task lint:web    # Runs pnpm run lint (ESLint)
```

See [Task Runner](03-task-runner.md) for the complete task configuration.

---

## Summary

| Tool | Language | Purpose | Command |
|------|----------|---------|---------|
| ESLint | TypeScript/JSX | Lint rules + import ordering | `pnpm run lint` |
| Prettier | TypeScript/CSS/JSON | Code formatting + Tailwind class sorting | `npx prettier --write .` |
| ktlint | Kotlin | Code style + formatting | `./gradlew ktlintCheck` |
| detekt | Kotlin | Static analysis + code smells | `./gradlew detekt` |
