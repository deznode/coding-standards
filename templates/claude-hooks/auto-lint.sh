#!/bin/bash
# --------------------------------------------------------------------------
# Claude Code auto-lint hook
#
# Runs ESLint --fix automatically after Claude edits or writes a TypeScript
# file inside the frontend app directory. Paired with settings.json which
# registers this script as a PostToolUse hook for Edit and Write tools.
#
# Setup:
#   1. Copy this file to .claude/hooks/auto-lint.sh
#   2. Copy settings.json to .claude/settings.json
#   3. chmod +x .claude/hooks/auto-lint.sh
#
# Customization:
#   - Adjust the case pattern below to match your frontend directory
#   - Add additional file types or directories as needed
# --------------------------------------------------------------------------

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# Only lint frontend TypeScript files
# TODO: Adjust "apps/web" to match your frontend directory path
case "$FILE_PATH" in
  */apps/web/*.ts|*/apps/web/*.tsx)
    npx eslint --fix "$FILE_PATH" 2>/dev/null || true
    ;;
esac
exit 0
