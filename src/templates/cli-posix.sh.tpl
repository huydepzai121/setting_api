#!/bin/sh
# Interactive setup CLI (macOS/Linux) — the terminal equivalent of the web UI.
#
# This script collects nothing on its own: it prompts for the same fields the
# web form asks for, then calls the very same `/api/setup/*` route handlers the
# web UI builds one-liners for, and executes the install script they return.
# All validation therefore stays in one place (src/lib/validation.ts) — a bad
# key or model is rejected by the route, and its 400 body (which always names
# the offending field) is printed here verbatim.

set -e

ORIGIN="{{ORIGIN}}"

RED=$(printf '\033[0;31m')
GREEN=$(printf '\033[0;32m')
YELLOW=$(printf '\033[1;33m')
BLUE=$(printf '\033[0;34m')
NC=$(printf '\033[0m')

# Prompts must read from the terminal, not from stdin: users run this both as
# `sh -c "$(curl ...)"` (stdin is the tty) and as `curl ... | sh` (stdin is the
# pipe carrying this script). Reading from /dev/tty makes both forms work.
if [ ! -r /dev/tty ]; then
    echo "${RED}Error: no terminal available to read answers from.${NC}" >&2
    echo "Run this script from an interactive shell." >&2
    exit 1
fi

# $1 = prompt, $2 = default (may be empty). Answer is left in REPLY_VALUE.
ask() {
    a_prompt="$1"
    a_default="$2"
    if [ -n "$a_default" ]; then
        printf '%s [%s]: ' "$a_prompt" "$a_default" > /dev/tty
    else
        printf '%s: ' "$a_prompt" > /dev/tty
    fi
    read -r REPLY_VALUE < /dev/tty || REPLY_VALUE=""
    if [ -z "$REPLY_VALUE" ]; then
        REPLY_VALUE="$a_default"
    fi
}

# Same as `ask`, without echoing what is typed. `read -s` is a bash/zsh
# extension that dash does not have, so echo is disabled with stty instead;
# the trap restores it if the user interrupts mid-prompt.
ask_secret() {
    s_prompt="$1"
    printf '%s: ' "$s_prompt" > /dev/tty
    s_stty=$(stty -g < /dev/tty)
    trap 'stty "$s_stty" < /dev/tty; echo > /dev/tty; exit 1' INT TERM
    stty -echo < /dev/tty
    read -r REPLY_VALUE < /dev/tty || REPLY_VALUE=""
    stty "$s_stty" < /dev/tty
    trap - INT TERM
    echo > /dev/tty
}

require() {
    if [ -z "$1" ]; then
        echo "${RED}Error: $2 must not be empty.${NC}" >&2
        exit 1
    fi
}

# Fetches one install script and runs it. Every argument after the route path
# is passed straight to curl, so callers use --data-urlencode and never have to
# URL-encode anything by hand. A non-200 means validation rejected an answer:
# the body is the route's own message naming the bad field, so it is shown as
# is instead of a generic failure.
run_setup() {
    r_path="$1"
    shift
    r_tmp=$(mktemp)
    r_status=$(curl -sS -G -o "$r_tmp" -w '%{http_code}' "$@" "$ORIGIN$r_path") || {
        rm -f "$r_tmp"
        echo "${RED}Error: could not reach $ORIGIN$r_path${NC}" >&2
        exit 1
    }
    if [ "$r_status" != "200" ]; then
        echo "${RED}Rejected by the server (HTTP $r_status):${NC}" >&2
        cat "$r_tmp" >&2
        echo >&2
        rm -f "$r_tmp"
        exit 1
    fi
    sh "$r_tmp"
    rm -f "$r_tmp"
}

echo "${BLUE}================================${NC}"
echo "${BLUE}  Setting Key — interactive setup${NC}"
echo "${BLUE}================================${NC}"
echo ""

ask "Configure Claude Code?" "Y"
case "$REPLY_VALUE" in
    [Nn]*) WANT_CLAUDECODE=0 ;;
    *) WANT_CLAUDECODE=1 ;;
esac

ask "Configure Codex?" "N"
case "$REPLY_VALUE" in
    [Yy]*) WANT_CODEX=1 ;;
    *) WANT_CODEX=0 ;;
esac

if [ "$WANT_CLAUDECODE" = "0" ] && [ "$WANT_CODEX" = "0" ]; then
    echo "${YELLOW}Nothing selected — exiting.${NC}"
    exit 0
fi

echo ""
ask "Base URL" ""
BASE_URL="$REPLY_VALUE"
require "$BASE_URL" "Base URL"

ask_secret "API key"
API_KEY="$REPLY_VALUE"
require "$API_KEY" "API key"

# One primary model fills every tier, exactly like the web form's "Primary
# model" field; the override prompts below replace individual tiers.
ask "Primary model" ""
PRIMARY_MODEL="$REPLY_VALUE"
require "$PRIMARY_MODEL" "Primary model"

ask "Override individual model tiers?" "N"
case "$REPLY_VALUE" in
    [Yy]*) WANT_OVERRIDES=1 ;;
    *) WANT_OVERRIDES=0 ;;
esac

if [ "$WANT_CLAUDECODE" = "1" ]; then
    CC_HAIKU="$PRIMARY_MODEL"
    CC_SONNET="$PRIMARY_MODEL"
    CC_OPUS="$PRIMARY_MODEL"
    if [ "$WANT_OVERRIDES" = "1" ]; then
        echo ""
        echo "${BLUE}Claude Code model tiers${NC}"
        ask "  haiku" "$CC_HAIKU"
        CC_HAIKU="$REPLY_VALUE"
        ask "  sonnet" "$CC_SONNET"
        CC_SONNET="$REPLY_VALUE"
        ask "  opus" "$CC_OPUS"
        CC_OPUS="$REPLY_VALUE"
    fi
fi

if [ "$WANT_CODEX" = "1" ]; then
    CX_SMALL="$PRIMARY_MODEL"
    CX_MEDIUM="$PRIMARY_MODEL"
    CX_LARGE="$PRIMARY_MODEL"
    if [ "$WANT_OVERRIDES" = "1" ]; then
        echo ""
        echo "${BLUE}Codex model tiers${NC}"
        ask "  small" "$CX_SMALL"
        CX_SMALL="$REPLY_VALUE"
        ask "  medium" "$CX_MEDIUM"
        CX_MEDIUM="$REPLY_VALUE"
        ask "  large" "$CX_LARGE"
        CX_LARGE="$REPLY_VALUE"
    fi

    # Codex needs a provider id/name. The defaults offered here are derived
    # from the Base URL's hostname in the same spirit as the web UI's derived
    # placeholders; they are suggestions the user can replace, not a
    # re-implementation of deriveProviderId/deriveProviderName.
    CX_HOST=$(echo "$BASE_URL" | sed -e 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##' -e 's#[:/].*$##')
    CX_DEFAULT_ID=$(echo "$CX_HOST" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9' '-' | sed -e 's/^-*//' -e 's/-*$//')
    echo ""
    echo "${BLUE}Codex provider${NC}"
    ask "  provider id" "$CX_DEFAULT_ID"
    CX_PROVIDER_ID="$REPLY_VALUE"
    require "$CX_PROVIDER_ID" "provider id"
    ask "  provider name" "$CX_HOST"
    CX_PROVIDER_NAME="$REPLY_VALUE"
    require "$CX_PROVIDER_NAME" "provider name"
fi

if [ "$WANT_CLAUDECODE" = "1" ]; then
    echo ""
    run_setup "/api/setup/claudecode" \
        --data-urlencode "key=$API_KEY" \
        --data-urlencode "base_url=$BASE_URL" \
        --data-urlencode "haiku=$CC_HAIKU" \
        --data-urlencode "sonnet=$CC_SONNET" \
        --data-urlencode "opus=$CC_OPUS"
fi

if [ "$WANT_CODEX" = "1" ]; then
    echo ""
    run_setup "/api/setup/codex" \
        --data-urlencode "key=$API_KEY" \
        --data-urlencode "base_url=$BASE_URL" \
        --data-urlencode "small=$CX_SMALL" \
        --data-urlencode "medium=$CX_MEDIUM" \
        --data-urlencode "large=$CX_LARGE" \
        --data-urlencode "provider_id=$CX_PROVIDER_ID" \
        --data-urlencode "provider_name=$CX_PROVIDER_NAME"
fi

echo ""
echo "${GREEN}Done.${NC}"
