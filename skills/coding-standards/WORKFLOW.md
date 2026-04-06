# Coding Standards Workflow

## Template Design Philosophy

Templates define the **target standard** -- the patterns new code should aspire to.
They may not match the project's current implementation. This is intentional.

When a project has both template rules and project-specific rules:
- **Template rules** guide new code toward the standard (marked `standard_type: aspirational`)
- **Project-specific rules** document the current implementation
- **Claude Code** loads both when editing files in matching paths

Template rules include a visible "Standard note" callout to make this distinction
clear. When editing existing code, follow the established codebase patterns. When
writing new code, prefer the patterns described in the template rules.

This dual-rule approach allows projects to gradually adopt standards without
receiving contradictory guidance. The aspirational annotation ensures Claude Code
knows which rules describe the target vs. the current state.

---

## Phase 1: Detection

Run the detection script on the target project:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/detect_standards.py <project-root> [--standards-path <path>]
```

### Output Interpretation

| JSON Key | Meaning |
|----------|---------|
| `standards_repo.found` | Whether coding-standards repo was located |
| `devtools_local` | Stored config from `.claude/devtools.local.md` (null if first run) |
| `ecosystems` | Detected project stacks (jvm, node, kmp) |
| `comparison` | Per-file status: match, modified, missing, extra |
| `compliance.score_percent` | Overall compliance percentage |

### Routing Decision

```
standards_repo.found = false?
  → Ask user for path via AskUserQuestion, re-run detector

devtools_local = null AND compliance.total_installed = 0?
  → Route to Bootstrap

devtools_local != null?
  → AskUserQuestion: "Update to latest standards?", "Audit drift?", or "Install source templates?"
    → Update, Audit, or Install Source Templates (Phase 2D)

compliance.total_installed > 0 AND devtools_local = null?
  → AskUserQuestion: "Detected existing rules. Audit first or bootstrap fresh?"
```

---

## Phase 2A: Bootstrap

### Step 1: Confirm Ecosystems

Present detected ecosystems and let user confirm which rule categories to install:

```
AskUserQuestion (multiSelect: true):
  "Which rule categories should we install?"
  Options based on detected ecosystems:
  - "Backend (8 rules)" -- if JVM detected
  - "Frontend (5 rules)" -- if Node.js detected
  - "Mobile (7 rules)" -- if KMP/Android detected
  - "Infrastructure (2 rules)" -- always offered
```

### Step 2: Collect Project Paths

Ask for project-specific paths that replace TODO markers in templates:

```
AskUserQuestion:
  "What is your API/backend directory?" [default from ecosystem detection or "apps/api"]
  "What is your web/frontend directory?" [default from ecosystem detection or "apps/web"]
```

Only ask questions relevant to selected ecosystems:
- JVM selected → ask for API directory
- Node.js selected → ask for web directory
- KMP/Android selected → ask for mobile app directory and shared module directory
- Multiple selected → ask for all relevant directories

### Step 3: Copy Templates

> **Important:** Before writing any file that already exists, use the Read tool to
> read its current content first. This prevents Write tool errors and enables diff
> comparison. Batch-read all existing target files before starting writes.

#### Rules → `.claude/rules/{category}/`

Create directories and copy selected rule files:

```bash
mkdir -p .claude/rules/backend .claude/rules/frontend .claude/rules/mobile .claude/rules/infrastructure
```

Copy each `.md` file from `templates/claude-rules/{category}/` to `.claude/rules/{category}/`.

##### Rule Overlap Detection

Before copying each template rule, check if the project already has a rule file
in the same category directory:

1. List existing `.md` files in `.claude/rules/{category}/`
2. For each existing file, extract the `# Title` heading
3. Compare topic headings against the template being installed
4. If the existing file covers the same domain (e.g., both are about "architecture"
   for the backend category), present options:

```
Overlap detected:
  Template: backend/architecture.md ("Spring Modulith + DDD Architecture")
  Existing: backend/backend-architecture.md ("Backend Architecture")

Options:
  1. Coexist -- install both (template has aspirational note to reduce confusion)
  2. Skip -- don't install template (keep project-specific rule only)
  3. Merge -- add template sections missing from project-specific file
```

AskUserQuestion with these options. Default recommendation: "Coexist" since
template rules now include the aspirational note distinguishing them from
project-specific rules.

##### Rule Path Substitution

Rules require path substitution in their YAML frontmatter `paths:` field and
sometimes in body content. The default paths match the template directory names
(`apps/api`, `apps/web`, `apps/mobile`, `shared/`, `build-logic/`). During
bootstrap, replace these with the user's actual directory paths (collected in Step 2).

See the **Rule Path Substitution** table in Step 4 (Phase 2A) below for the full mapping.

If a file already exists, use AskUserQuestion:
- "Replace" -- overwrite with template
- "Skip" -- keep existing
- "Show diff" -- display differences before deciding

#### Configs → project root

Copy from `templates/configs/` to project root. For each config:

1. Read template content
2. Apply path substitutions (see TODO Marker Map below)
3. If file exists: offer merge/replace/skip
4. Write file

##### Monorepo Config Deduplication

Before copying Node.js configs (`.prettierrc`, `eslint.config.mjs`) to the project root,
check if the user's web directory already has its own version:

```python
for config in [".prettierrc", "eslint.config.mjs"]:
    app_level = Path(user_web_dir) / config
    if app_level.exists():
        # Skip root-level copy -- app-level config takes precedence
        skip_with_note(config, f"Skipped {config} -- already exists at {user_web_dir}/{config}")
```

Rationale: In a monorepo, lefthook hooks specify `root: "{web_dir}/"` which makes
ESLint/Prettier resolve configs from the app directory. A root-level config is
redundant at best and conflicting at worst (different import resolution, different
`printWidth`, etc.).

#### Hooks → `.claude/hooks/`

```bash
mkdir -p .claude/hooks
```

Copy `auto-lint.sh` and `settings.json` from `templates/claude-hooks/`.

Apply path substitution to `auto-lint.sh`.

If `.claude/settings.json` already exists, MERGE the hooks section rather than replacing. Read existing settings, add the hook entries from the template, write back.

### Step 4: TODO Marker Replacement

When copying config files, apply these substitutions:

| File | Default Value | Replace With |
|------|---------------|-------------|
| `lefthook.yml` | `apps/web` (all occurrences) | User's web directory |
| `lefthook.yml` | `apps/api` (all occurrences) | User's API directory |
| `Taskfile.yml` | `API_DIR: apps/api` | `API_DIR: {user_api_dir}` |
| `Taskfile.yml` | `WEB_DIR: apps/web` | `WEB_DIR: {user_web_dir}` |
| `eslint.config.mjs` | `internalPattern: ["^@/.+"]` | User's import pattern (or keep default) |
| `auto-lint.sh` | `*/apps/web/*.ts\|*/apps/web/*.tsx` | User's web directory |

Use simple string replacement -- the defaults are literal strings:

```python
content = template_content.replace("apps/web", user_web_dir)
content = content.replace("apps/api", user_api_dir)
```

#### Rule Path Substitution

When copying rule files, apply path substitutions to both `paths:` frontmatter
and rule body content. Use simple string replacement after reading the template:

| Rule Category | Default Value | Replace With |
|---------------|---------------|--------------|
| backend/*.md | `apps/api` | User's API directory |
| frontend/*.md | `apps/web` | User's web directory |
| mobile/*.md | `apps/mobile` | User's mobile directory |
| mobile/*.md | `  - shared/` | `  - {mobile_dir}/shared/` |
| mobile/*.md | `  - build-logic/` | `  - {mobile_dir}/build-logic/` |
| infrastructure/tooling.md | `apps/api` (in body) | User's API directory |
| infrastructure/tooling.md | `apps/web` (in body) | User's web directory |

```python
# Backend rules: path in frontmatter + no body paths
content = content.replace("apps/api", user_api_dir)

# Frontend rules: path in frontmatter + no body paths
content = content.replace("apps/web", user_web_dir)

# Mobile rules: multi-path frontmatter + body references
content = content.replace("apps/mobile", user_mobile_dir)
content = content.replace("  - shared/", f"  - {user_mobile_dir}/shared/")
content = content.replace("  - build-logic/", f"  - {user_mobile_dir}/build-logic/")

# Infrastructure tooling.md: body content has apps/api and apps/web references
content = content.replace("apps/api", user_api_dir)
content = content.replace("apps/web", user_web_dir)
```

**Note:** Even if the user's directory matches the default (e.g., `apps/web`), always
run the replacement -- it's a no-op when paths match and prevents silent failures when
they don't.

#### Ecosystem-Selective Stripping

If only JVM is selected (no Node.js):
- Skip copying: `.prettierrc`, `eslint.config.mjs`, `auto-lint.sh`, `settings.json`
- In `lefthook.yml`: remove eslint and prettier hook sections
- In `Taskfile.yml`: remove web-related tasks (setup:web, dev:web, test:web, lint:web, build:web)

If only Node.js is selected (no JVM):
- In `lefthook.yml`: remove ktlint and detekt hook sections
- In `Taskfile.yml`: remove api-related tasks (setup:api, dev:api, test:api, lint:api, build:api)

Claude handles this stripping during the copy phase by reading the template, removing irrelevant sections, then writing.

### Step 4.5: Aspirational Pattern Compatibility Check

After copying and customizing rules, scan the codebase for key patterns referenced in
the installed rules. This identifies which rules describe patterns the project already
uses vs. patterns it should aspire to.

#### Patterns to Check

| Rule File | Pattern | How to Check |
|-----------|---------|-------------|
| backend/api-patterns.md | `ApiResult<T>` | grep for `ApiResult` in `{api_dir}/**/*.kt` |
| backend/api-patterns.md | `/api/v1/` URL prefix | grep for `/api/v1/` in `{api_dir}/**/*.kt` |
| backend/error-handling.md | `ProblemDetail` (RFC 9457) | grep for `ProblemDetail` in `{api_dir}/**/*.kt` |
| frontend/state-management.md | Zustand | check `{web_dir}/package.json` for `"zustand"` |
| frontend/component-patterns.md | clsx | check `{web_dir}/package.json` for `"clsx"` |

#### Presenting Results

```
## Aspirational Pattern Compatibility

| Rule | Pattern | Status |
|------|---------|--------|
| api-patterns.md | ApiResult<T> | NOT FOUND -- project uses ResponseEntity |
| api-patterns.md | /api/v1/ prefix | NOT FOUND -- project uses /api/{module} |
| error-handling.md | ProblemDetail | NOT FOUND -- project uses ErrorResponse |
| state-management.md | Zustand | NOT FOUND -- not in package.json |
| component-patterns.md | clsx | FOUND in package.json |

Rules marked NOT FOUND describe aspirational patterns. They include a
"Standard note" indicating this. No action needed unless you want to:
  1. Keep as-is (aspirational -- guides new code toward the standard)
  2. Adapt the rule content to match your current patterns
  3. Remove the rule for now
```

AskUserQuestion: For each NOT FOUND pattern, let user choose: Keep (aspirational),
Adapt (user will edit), or Remove.

If user chooses "Remove" for any rule, delete the copied file. If "Adapt", leave
the file and note it for manual editing.

### Step 4.6: Source File Installation

When key patterns are NOT FOUND and the user chose "Keep (aspirational)", proactively
offer to install source template files that implement the pattern:

```
AskUserQuestion:
  "ApiResult.kt is available as a source template. Want to install it into
   your project at {api_dir}/shared/api/ApiResult.kt?"
  Options: Install / Skip
```

Available source templates:

| Source Template | Pattern It Implements | Install Location |
|----------------|----------------------|-----------------|
| `templates/source-files/backend/ApiResult.kt` | `ApiResult<T>`, `PagedApiResult<T>` | `{api_dir}/{base_package}/shared/api/ApiResult.kt` |

When installing source files:
1. Read the template from `templates/source-files/`
2. Replace `{{API_PACKAGE}}` with the project's base package (detect from existing
   `.kt` files using `package` declaration, or ask via AskUserQuestion)
3. Write to the appropriate location in the project
4. Note: `ApiResult.kt` provides response wrappers only. Error handling uses
   `ProblemDetail` (RFC 9457) -- see `error-handling.md` rule.

### Step 5: Post-Bootstrap

1. Make hooks executable:
   ```bash
   chmod +x .claude/hooks/auto-lint.sh
   ```

2. Install git hooks (if lefthook is available):
   ```bash
   lefthook install
   ```

3. Write `.claude/devtools.local.md`:
   ```yaml
   ---
   coding_standards_path: /absolute/path/to/coding-standards
   last_bootstrap: 2026-04-04
   ecosystems: [jvm, nodejs, kmp]
   project_paths:
     api_dir: apps/api
     web_dir: apps/web
     mobile_dir: apps/mobile
     shared_dir: shared
   accepted_deviations:
     - lefthook.yml
     - Taskfile.yml
   ---

   # Devtools Local Configuration

   Stores local configuration for the devtools plugin coding-standards skill.
   This file contains machine-local paths -- do not commit to version control.
   ```

   Record any configs the user chose to "skip" or that are expected to differ
   (path-customized configs) as accepted deviations. These are counted as "pass"
   in compliance scoring.

4. Add `.claude/devtools.local.md` to `.gitignore` if not already present.

5. Re-run detector and present verification summary:
   ```
   ## Bootstrap Complete

   | Category | Installed | Total |
   |----------|-----------|-------|
   | Rules | 14 | 14 |
   | Configs | 5 | 5 |
   | Hooks | 2 | 2 |

   Compliance: 100% (scoped to active ecosystems)
   ```

6. Validate rule paths point to existing directories:

   The detection script includes `rule_path_warnings` in its output.
   If any warnings exist, present them:

   ```
   ⚠ Rule path warnings:
   | Rule | Path Pattern | Base Dir | Exists? |
   |------|-------------|----------|---------|
   | backend/architecture.md | apps/backend/** | apps/backend | No |
   ```

   If warnings found, offer to fix paths interactively via AskUserQuestion.

---

## Phase 2B: Update

### Step 1: Load Configuration

Read `.claude/devtools.local.md` for:
- `coding_standards_path` -- where to find templates
- `project_paths` -- for TODO marker replacement on new files
- `ecosystems` -- which categories are relevant

### Step 2: Show Comparison

Present the `comparison` section from detector output grouped by action needed:

```
## Standards Update Available

### New Files (in standards but not installed)
| File | Category |
|------|----------|
| backend/error-handling.md | rules |

### Modified (template changed since install)
| File | Category |
|------|----------|
| backend/testing-patterns.md | rules |
| lefthook.yml | configs |

### Your project matches the latest standards for all other files.
```

For "modified" configs, note that differences may be due to expected customization (TODO replacements). Show the actual diff before asking.

### Step 3: User Selection

```
AskUserQuestion (multiSelect: true):
  "Which updates should we apply?"
  - "Add backend/error-handling.md (new rule)"
  - "Update backend/testing-patterns.md (show diff first)"
  - "Skip all"
```

For modified files, use Read tool to show both versions before user decides.

### Step 3.5: Rule Overlap Detection (same as Bootstrap Step 3)

When installing new or updated rules, check for existing project-specific rules
in the same category. Apply the same overlap detection logic from Bootstrap Step 3:

- If an existing project-specific rule covers the same domain, present options:
  Coexist / Skip / Merge
- This is especially important during major template upgrades (e.g., v1 to v2)
  where many rules change at once

### Step 4: Apply Updates

- New files: copy with TODO replacement using stored project_paths
- Modified files: replace with new template content (user confirmed after seeing diff)
- Apply same TODO marker substitutions as bootstrap (both config and rule path substitution)
- Apply monorepo config deduplication checks (same as Bootstrap Step 3 Configs section)
- Respect `accepted_deviations` from `devtools.local.md` -- don't flag these as needing update

### Step 4.5: Aspirational Pattern Check + Source File Install

Run the same aspirational pattern compatibility check as Bootstrap Step 4.5:

1. Scan the codebase for key patterns referenced in installed/updated rules
2. Present the compatibility report
3. For NOT FOUND patterns, offer: Keep (aspirational) / Adapt / Remove
4. If ApiResult.kt pattern is NOT FOUND, offer to install source template

This step is important when updating from templates that didn't have
`standard_type: aspirational` to ones that do -- it gives the user a chance to
understand and act on the aspiration vs. reality gap.

### Step 5: Post-Update

1. Update `.claude/devtools.local.md` frontmatter:
   ```yaml
   last_update: 2026-04-04
   ```

2. Add `accepted_deviations` to `devtools.local.md` if not already present:
   ```yaml
   accepted_deviations:
     - lefthook.yml
     - Taskfile.yml
   ```
   Record any configs the user chose to skip during this update.

3. Validate rule paths (same as Bootstrap Step 5.6):
   Check `rule_path_warnings` from detector output. If warnings found,
   offer to fix paths interactively.

---

## Phase 2C: Audit

### Step 1: Run Detection (Read-Only)

Use the `comparison` and `compliance` sections from detector output. No files are modified.

### Step 2: Present Compliance Report

```
## Coding Standards Audit

Compliance: 12/14 rules, 3/5 configs, 1/2 hooks -- 76%
(Scoped to active ecosystems: jvm, node. 7 mobile rules excluded.
 Accepted deviations: lefthook.yml, Taskfile.yml counted as pass.)

### Rules
| File | Category | Status |
|------|----------|--------|
| architecture.md | backend | Match |
| api-patterns.md | backend | Match |
| error-handling.md | backend | MISSING |
| testing-patterns.md | backend | Modified |
| ... | ... | ... |

### Configs
| File | Status | Notes |
|------|--------|-------|
| .editorconfig | Match | |
| lefthook.yml | Modified | Expected (paths customized) |
| Taskfile.yml | Modified | Expected (paths customized) |
| eslint.config.mjs | Match | |
| .prettierrc | MISSING | |

### Hooks
| File | Status |
|------|--------|
| auto-lint.sh | Installed, executable |
| settings.json | MISSING |
```

### Step 3: Offer Resolution

```
AskUserQuestion:
  "Would you like to fix missing/outdated items?"
  - "Yes, start Update workflow"
  - "Install source templates (e.g., ApiResult.kt)"
  - "No, audit only"
```

If user chooses Update, transition to Phase 2B with the comparison data already loaded.
If user chooses Install source templates, transition to Phase 2D.

---

## Phase 2D: Install Source Templates

Standalone operation for installing source template files into the project.
Can be reached from:
- Top-level routing (when devtools_local exists)
- Audit Step 3 resolution
- Direct user request (e.g., "install ApiResult")

### Step 1: List Available Source Templates

Scan `templates/source-files/` in the standards repo for available templates:

| Template | Category | Description |
|----------|----------|-------------|
| `backend/ApiResult.kt` | Backend | API response wrappers (`ApiResult<T>`, `PagedApiResult<T>`, `PageableInfo`) |

### Step 2: Check Installation Status

For each template, check if the pattern already exists in the project:

| Template | Pattern to Check | How |
|----------|-----------------|-----|
| `ApiResult.kt` | `ApiResult` class | grep for `class ApiResult` in `{api_dir}/**/*.kt` |

Present results:

```
## Source Templates

| Template | Status |
|----------|--------|
| ApiResult.kt | NOT INSTALLED -- ApiResult class not found in codebase |
```

If all templates are already installed, inform the user and exit.

### Step 3: Install Selected Templates

```
AskUserQuestion (multiSelect: true):
  "Which source templates should we install?"
  - "ApiResult.kt -- API response wrappers (ApiResult<T>, PagedApiResult<T>)"
```

For each selected template:

1. Read the template from `templates/source-files/{category}/{file}`
2. Detect the project's base package:
   - Grep for the first `package` declaration in `{api_dir}/**/*.kt`
   - Extract the root package (e.g., `com.example.myapp`)
   - If not found, ask via AskUserQuestion: "What is your project's base package?"
3. Replace `{{API_PACKAGE}}` with the detected/provided package
4. Determine install path:
   - Convert package to path: `com.example.myapp` -> `com/example/myapp`
   - Full path: `{api_dir}/src/main/kotlin/{package_path}/shared/api/{file}`
5. Create parent directories if needed
6. Write the file
7. Confirm: "Installed ApiResult.kt at {path}"

### Step 4: Post-Install Notes

After installing source templates, inform the user:

```
## Source Templates Installed

- ApiResult.kt installed at {path}
- The `api-patterns.md` rule now describes patterns that exist in your codebase
- Existing controllers can be migrated from ResponseEntity<T> to ApiResult<T>
- Error handling uses ProblemDetail (RFC 9457) -- see error-handling.md rule
```

---

## Ecosystem-to-Template Mapping

| Detected Ecosystem | Rules | Configs | Hooks |
|-------------------|-------|---------|-------|
| JVM only | backend + infrastructure | .editorconfig, lefthook.yml, Taskfile.yml | none |
| Node.js only | frontend + infrastructure | all 5 | both |
| KMP/Android only | mobile + infrastructure | .editorconfig, lefthook.yml, Taskfile.yml | none |
| JVM + Node.js | backend + frontend + infrastructure | all 5 | both |
| JVM + KMP | backend + mobile + infrastructure | .editorconfig, lefthook.yml, Taskfile.yml | none |
| Full stack (all) | backend + frontend + mobile + infrastructure | all 5 | both |
| Neither | infrastructure only | .editorconfig, Taskfile.yml | none |

Infrastructure rules are always included regardless of ecosystem.
