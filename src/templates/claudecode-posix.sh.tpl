#!/bin/sh
# Derived from viber-router (viber-router-api/templates/setup/claudecode-linux.sh.tpl).
# Source project license: "Context Engine — Source-Available, Non-Commercial License,
# Copyright (c) 2026 viber.vn. All rights reserved." Ported and adapted for setting_key.
#
# Claude Code Setup Script (macOS/Linux)
# Auto-generated — configures Claude Code to use your endpoint and API key.
# This script only ever creates or modifies files under ~/.claude — it never
# touches shell startup files and never installs any package.

set -e

ENDPOINT_URL="{{ENDPOINT_URL}}"
API_KEY='{{API_KEY}}'
HAIKU_MODEL="{{HAIKU}}"
SONNET_MODEL="{{SONNET}}"
OPUS_MODEL="{{OPUS}}"
SUBAGENT_MODEL="{{SUBAGENT}}"

RED=$(printf '\033[0;31m')
GREEN=$(printf '\033[0;32m')
YELLOW=$(printf '\033[1;33m')
BLUE=$(printf '\033[0;34m')
NC=$(printf '\033[0m')

echo "${BLUE}================================${NC}"
echo "${BLUE}  Claude Code Setup${NC}"
echo "${BLUE}================================${NC}"
echo ""

if [ -z "$ENDPOINT_URL" ]; then
    echo "${RED}Error: Endpoint URL not configured${NC}"
    exit 1
fi
if [ -z "$API_KEY" ]; then
    echo "${RED}Error: API key not configured${NC}"
    exit 1
fi

MASKED_KEY=$(echo "$API_KEY" | cut -c 1-10)
echo "Endpoint URL: ${GREEN}$ENDPOINT_URL${NC}"
echo "API Key:      ${GREEN}${MASKED_KEY}...${NC}"
echo ""

# Returns non-zero when the file exists but could not be copied (read-only dir,
# disk full, ...). Callers must never modify a file after a failed backup.
backup_file() {
    f_path="$1"
    if [ -f "$f_path" ]; then
        f_backup="${f_path}.backup.$(date +%Y%m%d%H%M%S)"
        if ! cp "$f_path" "$f_backup"; then
            echo "${RED}  Error: could not back up $f_path${NC}"
            return 1
        fi
        echo "${YELLOW}  Backed up: $f_path -> $f_backup${NC}"
    fi
    return 0
}

# Claude Code reads ANTHROPIC_* and CLAUDE_CODE_SUBAGENT_MODEL from the current
# process environment, and those take precedence over ~/.claude/settings.json.
# This script never unsets or modifies them — it only warns, because doing
# anything else would mean writing to files outside ~/.claude.
# Passing "${VAR+x}" (rather than checking the value) means a variable set to
# an empty string still counts as "set", matching Claude Code's own behavior.
ACTIVE_VARS=""
note_active_var() {
    if [ -n "$2" ]; then
        ACTIVE_VARS="$ACTIVE_VARS $1"
    fi
}

note_active_var ANTHROPIC_BASE_URL "${ANTHROPIC_BASE_URL+x}"
note_active_var ANTHROPIC_AUTH_TOKEN "${ANTHROPIC_AUTH_TOKEN+x}"
note_active_var ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY+x}"
note_active_var ANTHROPIC_DEFAULT_HAIKU_MODEL "${ANTHROPIC_DEFAULT_HAIKU_MODEL+x}"
note_active_var ANTHROPIC_DEFAULT_SONNET_MODEL "${ANTHROPIC_DEFAULT_SONNET_MODEL+x}"
note_active_var ANTHROPIC_DEFAULT_OPUS_MODEL "${ANTHROPIC_DEFAULT_OPUS_MODEL+x}"
note_active_var CLAUDE_CODE_SUBAGENT_MODEL "${CLAUDE_CODE_SUBAGENT_MODEL+x}"

if [ -n "$ACTIVE_VARS" ]; then
    echo "${YELLOW}Warning: these variables are set in your current environment:${NC}"
    for var_name in $ACTIVE_VARS; do
        echo "${YELLOW}  - $var_name${NC}"
    done
    echo "${YELLOW}They override ~/.claude/settings.json for any Claude Code process that inherits them.${NC}"
    echo "${YELLOW}To remove them for future sessions, delete the lines that export them from${NC}"
    echo "${YELLOW}wherever your shell sets environment variables on startup, then open a new terminal.${NC}"
    echo "${YELLOW}To clear them in this session only, run: unset$ACTIVE_VARS${NC}"
    echo ""
fi

CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

update_settings_json() {
    mkdir -p "$CLAUDE_DIR"

    if ! command -v jq >/dev/null 2>&1; then
        echo ""
        echo "${RED}Error: jq is required but not installed.${NC}"
        echo ""
        echo "Please install jq first:"
        echo "  ${BLUE}macOS:${NC}         brew install jq"
        echo "  ${BLUE}Ubuntu/Debian:${NC} sudo apt-get install -y jq"
        echo "  ${BLUE}Fedora/RHEL:${NC}   sudo dnf install -y jq"
        echo "  ${BLUE}Arch Linux:${NC}    sudo pacman -S jq"
        echo ""
        echo "Then run this script again."
        exit 1
    fi

    merge_base="$SETTINGS_FILE"
    merge_base_is_temp=0

    if [ -f "$SETTINGS_FILE" ]; then
        if ! backup_file "$SETTINGS_FILE"; then
            exit 1
        fi

        if [ ! -s "$SETTINGS_FILE" ] || ! jq empty "$SETTINGS_FILE" >/dev/null 2>&1; then
            f_backup=$(ls -t "${SETTINGS_FILE}.backup."* 2>/dev/null | head -n 1)
            echo "${YELLOW}  Warning: existing settings.json could not be parsed as JSON.${NC}"
            echo "${YELLOW}  Previous content preserved at: $f_backup${NC}"
            echo "${YELLOW}  Writing a fresh settings.json with only the generated keys.${NC}"
            merge_base=$(mktemp)
            merge_base_is_temp=1
            echo '{}' > "$merge_base"
        fi
    else
        echo '{}' > "$SETTINGS_FILE"
    fi

    tmp_file=$(mktemp)
    if ! jq --arg url "$ENDPOINT_URL" --arg key "$API_KEY" \
       --arg haiku "$HAIKU_MODEL" --arg sonnet "$SONNET_MODEL" --arg opus "$OPUS_MODEL" \
       --arg subagent "$SUBAGENT_MODEL" '
        .env.ANTHROPIC_BASE_URL = $url |
        .env.ANTHROPIC_AUTH_TOKEN = $key |
        .env.ANTHROPIC_DEFAULT_HAIKU_MODEL = $haiku |
        .env.ANTHROPIC_DEFAULT_SONNET_MODEL = $sonnet |
        .env.ANTHROPIC_DEFAULT_OPUS_MODEL = $opus |
        .env.CLAUDE_CODE_SUBAGENT_MODEL = $subagent |
        .disableLoginPrompt = true |
        .includeCoAuthoredBy = false
    ' "$merge_base" > "$tmp_file"; then
        echo "${RED}  Error: failed to generate settings.json${NC}"
        rm -f "$tmp_file"
        if [ "$merge_base_is_temp" = "1" ]; then
            rm -f "$merge_base"
        fi
        exit 1
    fi
    mv "$tmp_file" "$SETTINGS_FILE"
    if [ "$merge_base_is_temp" = "1" ]; then
        rm -f "$merge_base"
    fi
}

echo "${BLUE}Configuring Claude Code settings...${NC}"
update_settings_json
echo "  ${GREEN}✓ Updated ~/.claude/settings.json${NC}"

echo ""
echo "${GREEN}================================${NC}"
echo "${GREEN}  Configuration Complete!${NC}"
echo "${GREEN}================================${NC}"
echo ""
echo "Claude Code is now configured:"
echo "  Endpoint: ${BLUE}$ENDPOINT_URL${NC}"
echo "  API Key:  ${BLUE}${MASKED_KEY}...${NC}"
echo "  Config:   ${BLUE}~/.claude/settings.json${NC}"
echo ""
if [ -n "$ACTIVE_VARS" ]; then
    echo "${YELLOW}Reminder: variables set in this environment still override settings.json — see warning above.${NC}"
    echo ""
fi
echo "${YELLOW}Next steps:${NC}"
echo "  1. Open a new terminal if you changed any environment variables"
echo "  2. Run: ${BLUE}claude${NC}"
echo ""
