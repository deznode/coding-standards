# Coding Standards Troubleshooting

## Standards Repo Not Found

**Symptom**: `standards_repo.found` is false in detection output.

**Causes**:
- Coding-standards repo not cloned locally
- Repo in unexpected location

**Fix**: Provide the path explicitly:
```bash
python3 detect_standards.py . --standards-path /path/to/coding-standards
```

Or set the path interactively when prompted by the skill. The path is stored in `.claude/devtools.local.md` for future runs.

**Search order**: The script looks in these locations (in order):
1. `--standards-path` CLI argument
2. `.claude/devtools.local.md` `coding_standards_path` value
3. Walk up from project root looking for `internal-repos/deznode/coding-standards/`
4. `../coding-standards` (sibling directory)

---

## Ecosystem Not Detected

**Symptom**: `ecosystems` array is empty.

**Causes**:
- Running from wrong directory (not project root)
- Build files deeply nested (more than 2 levels)
- Non-standard project structure

**Fix**:
- Run from the project root directory
- The script checks root, one level deep, and two levels deep under monorepo containers (`apps/`, `packages/`, `libs/`, `services/`, `modules/`)
- For non-standard structures, manually select rule categories when prompted

---

## TODO Markers Not Replaced

**Symptom**: Config files still contain `apps/web` or `apps/api` after bootstrap.

**Causes**:
- Custom project structure uses different directory names
- Path provided during bootstrap didn't match the template defaults

**Fix**: The replacement uses simple string substitution (`apps/web` → user path). If your directories differ, provide the exact directory name during the bootstrap path collection step. You can also manually edit the files after bootstrap.

---

## Lefthook Install Fails

**Symptom**: `lefthook install` command fails or lefthook not found.

**Causes**:
- Lefthook not installed
- Wrong directory

**Fix**:
```bash
# macOS
brew install lefthook

# Linux
curl -fsSL https://get.lefthook.dev | sh

# After install
lefthook install
```

The bootstrap will still complete even if lefthook isn't installed — it just skips the hook installation step.

---

## Hook Not Executable

**Symptom**: Claude hooks don't run after bootstrap.

**Fix**:
```bash
chmod +x .claude/hooks/auto-lint.sh
```

The bootstrap should do this automatically. If it was missed, run manually.

---

## Settings.json Merge Conflicts

**Symptom**: Existing `.claude/settings.json` hooks overwritten.

**Causes**:
- Project already had custom hooks configured

**Fix**: The bootstrap should merge hook entries rather than replace the entire file. If hooks were lost, check the template at `templates/claude-hooks/settings.json` and manually add the entries to your existing `.claude/settings.json`.

---

## devtools.local.md Parsing Errors

**Symptom**: Detection script can't read stored configuration.

**Causes**:
- Malformed YAML frontmatter
- Missing `---` delimiters

**Fix**: Ensure the file follows this format:
```yaml
---
coding_standards_path: /absolute/path/to/coding-standards
last_bootstrap: 2026-04-04
ecosystems: [jvm, nodejs]
project_paths:
  api_dir: apps/api
  web_dir: apps/web
accepted_deviations:
  - lefthook.yml
  - Taskfile.yml
---
```

The `---` delimiters on lines 1 and last are required. Keys must be at indent 0, nested keys at indent 2.

---

## KMP/Android Ecosystem Not Detected

**Symptom**: Project uses Kotlin Multiplatform but `kmp` not in `ecosystems` array.

**Causes**:
- No `shared/src/commonMain/` directory at expected location
- `build.gradle.kts` doesn't contain `multiplatform` or `com.android.application` plugin reference
- Running from wrong directory (not project root)
- Shared module uses a non-standard name (not `shared/`)

**Fix**:
- Ensure the project has a `shared/src/commonMain/` directory structure, or that the root `build.gradle.kts` references the multiplatform plugin
- Run from the project root directory
- For non-standard structures, manually select "Mobile (7 rules)" when prompted during bootstrap
- The detection checks root, one level deep, and monorepo containers (`apps/`, `packages/`, etc.)

---

## Audit Shows "Modified" for Expected Customizations

**Symptom**: Configs like `lefthook.yml` and `Taskfile.yml` show as "modified" in audit even though they're correct.

**Explanation**: This is expected. During bootstrap, TODO markers in templates are replaced with project-specific paths (e.g., `apps/api` → your directory). The MD5 hash will differ from the template.

**How to interpret**:
- **Rules**: "Modified" is normal for rules whose `paths:` frontmatter was customized
  during bootstrap (e.g., `apps/api` replaced with `apps/backend`). If ALL rules show
  "match" in a project with non-default paths, that means path substitution was missed
  and the rules may be inert.
- **Configs**: "Modified" is normal for `lefthook.yml`, `Taskfile.yml`, `eslint.config.mjs`,
  `auto-lint.sh` -- these are customized during bootstrap
- **Hooks**: `settings.json` is checked at `.claude/settings.json` (not `.claude/hooks/`).
  `auto-lint.sh` is checked at `.claude/hooks/auto-lint.sh`.
- **Missing**: These need attention -- the file was never installed or was intentionally
  skipped. Check `devtools.local.md` for `accepted_deviations` list.
