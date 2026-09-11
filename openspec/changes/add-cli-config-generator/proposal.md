## Why

Pointing Claude Code or Codex at a custom Anthropic-compatible endpoint today means hand-editing `~/.claude/settings.json` or `~/.codex/config.toml`, or running the `viber-router` setup script — which only works against the router that served it and additionally rewrites the user's shell startup files (`.bashrc`, `.zshrc`, `.zshenv`, `.profile`) and Windows User/Machine environment variables. Users want a neutral tool where they supply their own `base_url`, API key and model names, and where the configuration lands **only** in the tool's own config file — nothing else on the machine is touched.

## What Changes

- New standalone Next.js + TypeScript website (project root `D:/Dev/www/setting_key`, currently empty apart from `openspec/`). No proxy, no database, no logging/monitoring — this is a configuration generator only.
- A single-page form collecting `base_url`, `api_key`, a primary model name, optional advanced per-tier model overrides, a subagent tier choice, target CLI (Claude Code and/or Codex), and target OS.
- Pure generator layer producing, from that input:
  - Claude Code `settings.json` content (`env.ANTHROPIC_BASE_URL`, `env.ANTHROPIC_AUTH_TOKEN`, `env.ANTHROPIC_DEFAULT_HAIKU_MODEL`, `env.ANTHROPIC_DEFAULT_SONNET_MODEL`, `env.ANTHROPIC_DEFAULT_OPUS_MODEL`, `env.CLAUDE_CODE_SUBAGENT_MODEL`, `disableLoginPrompt`, `includeCoAuthoredBy`). Claude Code has three model tiers — haiku, sonnet, opus — and `CLAUDE_CODE_SUBAGENT_MODEL` is a pointer to one of them, not a fourth model.
  - Codex `config.toml` (`model`, `model_provider`, `model_catalog_json`, `[model_providers.<id>]`, `[features]`) plus a `models.json` catalog with three tiers and an `auth.json` placeholder.
  - Install scripts for POSIX (`sh`) and Windows (`PowerShell`) that write those files with a backup-first, merge-not-clobber strategy.
- Two script delivery paths: a **full script** rendered client-side for copy/paste (no key leaves the browser — the recommended default), and a **one-line installer** served by Next.js route handlers `/api/setup/claudecode` and `/api/setup/codex`.
- Validation ported from `viber-router-api/src/routes/llm/setup.rs`: key and model charset restricted to `[A-Za-z0-9._:-]`, key length ≤ 300. **BREAKING vs. the viber-router behaviour**: invalid characters are **rejected with HTTP 400** instead of being silently stripped, because rejection (not escaping) is what keeps the generated `API_KEY='{{API_KEY}}'` shell literal injection-safe.
- Deliberate removals relative to the `viber-router` setup scripts — the whole point of the change:
  - No writes to `.bashrc` / `.zshrc` / `.bash_profile` / `.zprofile` / `.profile` / `.zshenv`, and no `unset` of legacy variables (`claudecode-linux.sh.tpl` ~385–430).
  - No `[Environment]::SetEnvironmentVariable(..., "User"|"Machine")` (`claudecode-windows.ps1.tpl` 62–122).
  - No `statusline.sh` / `statusline.ps1` install, no `settings.statusLine` key, no `TRACKING_URL` (`claudecode-windows.ps1.tpl` 144–360).
  - No automatic `npm install -g @openai/codex` (`codex-linux.sh.tpl:107`) — the script warns if the CLI is missing and stops there.
  - Instead of unsetting them, the script **warns** when `ANTHROPIC_*` variables are active in the current shell, since they override `settings.json`.
- No server-side persistence of any kind. `localStorage` remembers `base_url`, model names and provider name only; the API key is never persisted anywhere.

## Capabilities

### New Capabilities
- `cli-config/claude-code`: the exact `settings.json` contract for Claude Code and the backup/merge rules an install must follow.
- `cli-config/codex`: the `config.toml`, `models.json` and `auth.json` contract for Codex, including user-supplied provider identity.
- `cli-config/setup-script`: input validation, script rendering for POSIX and Windows, and the two delivery paths (client-side full script, server-side one-liner route handlers).
- `cli-config/web-ui`: the single-page form, its result panel, component states, error handling and accessibility requirements.

### Modified Capabilities
<!-- None: this is a greenfield project with no existing specs. -->

## Impact

- **New project scaffolding**: `package.json`, `tsconfig.json`, Next.js App Router layout, Vitest config, linter config. Node v24.19.0 / npm 11.17.0 are available.
- **Next.js config constraint**: `output: 'export'` cannot be used — the one-line installer requires server-side route handlers.
- **New route handlers**: `/api/setup/claudecode`, `/api/setup/codex`. Both must avoid any request logging that would capture query parameters (the API key travels in the query string on this path).
- **Ported templates**: the four `.tpl` files under `viber-router-api/templates/setup/` and the `models.json` catalog body are the reference for the generated scripts. `viber-router`'s LICENSE is *"Context Engine — Source-Available, Non-Commercial License, Copyright (c) 2026 viber.vn. All rights reserved."* — **this needs the user's explicit confirmation before porting**, and ported files must carry an attribution header. See design.md for the open question.
- **No impact** on `viber-router` itself: it is read-only reference material and is not modified.
