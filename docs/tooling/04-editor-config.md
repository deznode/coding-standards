# EditorConfig

EditorConfig provides consistent formatting defaults across all editors and IDEs. These settings are the baseline -- linters and formatters (ESLint, Prettier, ktlint) enforce stricter rules on top.

---

## Standard Configuration (`.editorconfig`)

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.{kt,kts}]
indent_size = 4
ktlint_standard_no-wildcard-imports = disabled

[*.{java}]
indent_size = 4

[*.{gradle.kts}]
indent_size = 4

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

---

## Section Breakdown

### Default Settings (`[*]`)

| Setting | Value | Rationale |
|---------|-------|-----------|
| `charset` | `utf-8` | Universal character encoding |
| `end_of_line` | `lf` | Unix line endings (consistent across macOS/Linux, avoids CRLF issues) |
| `indent_style` | `space` | Spaces render consistently everywhere |
| `indent_size` | `2` | Standard for TypeScript, JavaScript, JSON, YAML, CSS |
| `insert_final_newline` | `true` | POSIX standard, cleaner git diffs |
| `trim_trailing_whitespace` | `true` | Prevents noise in diffs |

### Kotlin and Java (`[*.{kt,kts}]`, `[*.{java}]`, `[*.{gradle.kts}]`)

```ini
[*.{kt,kts}]
indent_size = 4
ktlint_standard_no-wildcard-imports = disabled
```

- **4-space indentation**: Standard for JVM languages (matches IntelliJ defaults and Kotlin coding conventions).
- **`ktlint_standard_no-wildcard-imports = disabled`**: Allows wildcard imports (`import java.util.*`) which are idiomatic in Kotlin, especially for Spring framework annotations and Kotlin standard library extensions.
- Gradle build scripts (`.gradle.kts`) also use 4-space indentation.

### Markdown (`[*.md]`)

```ini
[*.md]
trim_trailing_whitespace = false
```

Markdown uses trailing double spaces to indicate a line break (`<br>`). Disabling trim preserves intentional formatting.

### Makefile (`[Makefile]`)

```ini
[Makefile]
indent_style = tab
```

Makefiles require tabs for indentation. This is a language requirement, not a preference.

---

## Integration with Other Tools

### Prettier

Prettier respects `.editorconfig` settings for `end_of_line`, `indent_style`, `indent_size`, and `tab_width`. The Prettier config (`.prettierrc`) overrides these when there is a conflict, but in practice the values should align.

### ktlint

ktlint reads `.editorconfig` directly for Kotlin formatting rules. The `ktlint_standard_*` properties in `.editorconfig` control specific ktlint rules without needing a separate ktlint config file.

### ESLint

ESLint does not read `.editorconfig`. Formatting rules come from Prettier (which does read it).

---

## IDE Support

EditorConfig is supported natively or via plugins in all major editors:

| Editor | Support |
|--------|---------|
| VS Code | Built-in (with EditorConfig extension) |
| IntelliJ IDEA | Built-in |
| Vim/Neovim | Plugin: `editorconfig/editorconfig-vim` |
| Sublime Text | Plugin: `EditorConfig` |

---

## Placement

Place `.editorconfig` at the repository root. The `root = true` directive tells editors to stop searching for `.editorconfig` files in parent directories.
