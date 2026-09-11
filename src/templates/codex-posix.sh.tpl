#!/bin/sh
# Derived from viber-router (viber-router-api/templates/setup/codex-linux.sh.tpl).
# Source project license: "Context Engine — Source-Available, Non-Commercial License,
# Copyright (c) 2026 viber.vn. All rights reserved." Ported and adapted for setting_key.
#
# Codex CLI Setup Script (macOS/Linux)
# Auto-generated — configures the Codex CLI to use your endpoint and API key.
# This script only ever creates or modifies files under ~/.codex — it never
# installs, upgrades or removes the Codex CLI or any package.

set -e

ENDPOINT_URL="{{ENDPOINT_URL}}"
API_KEY='{{API_KEY}}'
CODEX_SMALL="{{SMALL}}"
CODEX_MEDIUM="{{MEDIUM}}"
CODEX_LARGE="{{LARGE}}"
PROVIDER_ID="{{PROVIDER_ID}}"
PROVIDER_NAME="{{PROVIDER_NAME}}"

RED=$(printf '\033[0;31m')
GREEN=$(printf '\033[0;32m')
YELLOW=$(printf '\033[1;33m')
BLUE=$(printf '\033[0;34m')
NC=$(printf '\033[0m')

echo "${BLUE}================================${NC}"
echo "${BLUE}  Codex CLI Setup${NC}"
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
if [ -z "$CODEX_SMALL" ] || [ -z "$CODEX_MEDIUM" ] || [ -z "$CODEX_LARGE" ]; then
    echo "${RED}Error: model tiers not configured${NC}"
    exit 1
fi
if [ -z "$PROVIDER_ID" ]; then
    echo "${RED}Error: provider id not configured${NC}"
    exit 1
fi

MASKED_KEY=$(echo "$API_KEY" | cut -c 1-10)
echo "Endpoint URL:      ${GREEN}$ENDPOINT_URL${NC}"
echo "API Key:           ${GREEN}${MASKED_KEY}...${NC}"
echo "Small (Fast):      ${GREEN}$CODEX_SMALL${NC}"
echo "Medium (Default):  ${GREEN}$CODEX_MEDIUM${NC}"
echo "Large (Powerful):  ${GREEN}$CODEX_LARGE${NC}"
echo ""

if ! command -v codex >/dev/null 2>&1; then
    echo "${YELLOW}Warning: the Codex CLI was not found on PATH.${NC}"
    echo "${YELLOW}Configuration files will still be written; install the Codex CLI separately when ready.${NC}"
    echo ""
fi

CODEX_DIR="$HOME/.codex"
mkdir -p "$CODEX_DIR"

echo "${BLUE}Configuring Codex CLI...${NC}"

# config.toml and models.json fully describe the provider setup, so they are
# backed up and written whole rather than merged.
if [ -f "$CODEX_DIR/config.toml" ]; then
    CONFIG_BACKUP="$CODEX_DIR/config.toml.backup.$(date +%Y%m%d%H%M%S)"
    if ! cp "$CODEX_DIR/config.toml" "$CONFIG_BACKUP"; then
        echo "${RED}  Error: could not back up $CODEX_DIR/config.toml${NC}"
        exit 1
    fi
    echo "${YELLOW}  Backed up: $CODEX_DIR/config.toml -> $CONFIG_BACKUP${NC}"
fi

cat > "$CODEX_DIR/config.toml" << TOML_EOF
model = "$CODEX_MEDIUM"
model_provider = "$PROVIDER_ID"
model_catalog_json = "~/.codex/models.json"

[model_providers.$PROVIDER_ID]
name = "$PROVIDER_NAME"
base_url = "$ENDPOINT_URL"
experimental_bearer_token = "$API_KEY"
wire_api = "responses"

[features]
apps = false
TOML_EOF
echo "  ${GREEN}✓ Written ~/.codex/config.toml${NC}"

# models.json content is rendered server-side from a template with the
# {{SMALL}}/{{MEDIUM}}/{{LARGE}} slots already substituted; it is embedded
# here as static JSON.
cat > "$CODEX_DIR/models.json" << 'MODELS_EOF'
{{MODELS_JSON}}
MODELS_EOF
echo "  ${GREEN}✓ Written ~/.codex/models.json${NC}"

# auth.json holds Codex login state this tool has no business touching, so it
# is written only when missing or empty.
if [ ! -f "$CODEX_DIR/auth.json" ] || [ ! -s "$CODEX_DIR/auth.json" ]; then
    echo '{}' > "$CODEX_DIR/auth.json"
    echo "  ${GREEN}✓ Written ~/.codex/auth.json${NC}"
else
    echo "  ${GREEN}✓ Kept existing ~/.codex/auth.json${NC}"
fi

# models_cache.json is Codex's own cache of the previous model catalog; if left
# behind it can shadow the models.json just written, so remove it when present.
if [ -f "$CODEX_DIR/models_cache.json" ]; then
    rm -f "$CODEX_DIR/models_cache.json"
    echo "  ${GREEN}✓ Removed ~/.codex/models_cache.json${NC}"
fi

echo ""
echo "${GREEN}================================${NC}"
echo "${GREEN}  Configuration Complete!${NC}"
echo "${GREEN}================================${NC}"
echo ""
echo "Codex CLI is now configured:"
echo "  Endpoint:          ${BLUE}$ENDPOINT_URL${NC}"
echo "  API Key:           ${BLUE}${MASKED_KEY}...${NC}"
echo "  Small (Fast):      ${BLUE}$CODEX_SMALL${NC}"
echo "  Medium (Default):  ${BLUE}$CODEX_MEDIUM${NC}"
echo "  Large (Powerful):  ${BLUE}$CODEX_LARGE${NC}"
echo ""
echo "${YELLOW}Next steps:${NC}"
echo "  Run: ${BLUE}codex${NC}"
echo ""
