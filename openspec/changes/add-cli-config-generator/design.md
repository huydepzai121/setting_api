## Context

See proposal.md — Why. Constraints that shape the approach:

- Greenfield project. `D:/Dev/www/setting_key` contains only `openspec/`. Not a git repository, and initialising one is the user's call, not this change's.
- Node v24.19.0, npm 11.17.0 available.
- The behaviour contract is derived by reading `viber-router` (`D:/Dev/www/viber-router`), specifically `viber-router-api/src/routes/llm/setup.rs` and the four templates under `viber-router-api/templates/setup/`. That repository is reference material only and is never modified.
- The generated scripts run on the user's own machine with their shell's privileges. Any string the site embeds into a script is executed there, so input handling is a security boundary, not a formatting concern.
- See the four spec files under `specs/cli-config/` for the requirements this design implements.

## Goals / Non-Goals

**Goals:**

- One pure, framework-free generator layer that both the browser and the route handlers call, so the two delivery paths cannot drift apart.
- Validation that rejects rather than repairs, because rejection is what makes the shell and PowerShell literals safe.
- An install footprint limited to the target CLI's own config directory.

**Non-Goals:**

- Multiple saved profiles, import/export of configurations, or any account concept.
- Verifying that the supplied `base_url` or key actually work — the site never calls the endpoint.
- Installing, upgrading or detecting versions of Claude Code or the Codex CLI beyond a presence check for a warning.
- Any part of `viber-router` beyond the setup surface: no proxy, routing, groups, servers, models table, logs, TTFT, uptime, Telegram or admin auth.

## Decisions

### D1. Pure generator core, thin delivery layers

A `src/lib/` module exports pure functions: validation, slot resolution, `settings.json` building, `config.toml` building, `models.json` building, and script rendering. The React page and the two route handlers are thin callers.

*Why:* the spec requires that a client-rendered full script and a server-rendered one-liner be byte-identical for the same input. One shared implementation makes that structurally true instead of a thing to remember. It also makes the whole contract unit-testable without a running server or browser.

*Alternative rejected:* generating only server-side. That forces the key through a network request even for the copy/paste path, which defeats the safer option.

### D2. Reject invalid input; never escape it

`validate_key` and `validate_model` port the charset from `setup.rs` (`ASCII alphanumeric` plus `-`, `_`, `:`, `.`; key ≤ 300 chars) but change the failure mode: `setup.rs` silently filters disallowed characters out of model names and only rejects keys. Here both reject.

*Why:* the rendered POSIX script embeds the key as `API_KEY='{{API_KEY}}'`. That literal is safe precisely because the charset cannot contain `'`. The same value is embedded into PowerShell and into JSON/TOML. Rather than maintain three correct escapers, the design keeps a single narrow input alphabet and refuses anything outside it. Silent filtering is worse than rejection: a user whose key contained a stripped character would get a script that installs a subtly wrong key and fails later with an opaque auth error.

*Trade-off accepted:* a legitimate key containing, say, `+` would be refused. The charset matches what `viber-router` already accepts in production, so this is not a regression, and widening it later is a one-line change plus a test.

### D3. Claude Code settings are merged; Codex config is overwritten

`settings.json` is merged key-by-key into whatever exists. `config.toml` and `models.json` are written whole after a backup.

*Why:* `settings.json` is a file users legitimately hand-edit (permissions, hooks, statusline, model) and clobbering it would destroy unrelated configuration. `config.toml` and `models.json` as generated here fully describe a provider setup; a partial TOML merge would need a TOML parser inside a `sh` script, which is not justifiable. The backup plus an explicit "this file is overwritten" message in the UI covers the difference. `auth.json` is neither merged nor overwritten — it is only created when absent, because it holds login state this tool has no business touching.

*Merge mechanics:* the POSIX script uses `jq`, matching `claudecode-linux.sh.tpl:329-342`, and aborts with install instructions when `jq` is missing. The PowerShell script uses `ConvertFrom-Json` / `ConvertTo-Json`, which needs no extra dependency.

### D4. Backup failure aborts the install

If the backup copy fails, the script exits non-zero without touching the original. Ported from `claudecode-linux.sh.tpl:62-75`.

*Why:* a read-only directory or a full disk is exactly the case where a half-written config would leave the user with no working setup and no copy of the old one.

### D5. One primary model plus optional per-tier overrides

Claude Code has three model tiers (haiku, sonnet, opus) and Codex three (small, medium, large); the user asked to enter "a model name". The form takes one primary name and defaults every tier to it, with an advanced toggle exposing the individual tiers.

`CLAUDE_CODE_SUBAGENT_MODEL` is deliberately NOT a fourth input. It is a pointer to one of the three tiers, so the advanced panel offers a three-way tier choice (default: sonnet) and the generator writes that tier's resolved model name into the key.

*Why:* the common case — one router, one model — is a single field, while the capability of the underlying config is not lost. Modelling the subagent entry as a free-text field would invite a value that names no configured tier, and would let the two drift apart silently; as a tier pointer it cannot.

### D6. Provider identity is an input, not a constant

`viber-router` hard-codes the Codex provider as id `viberrouter`, name `Viber Router` (`codex-linux.sh.tpl:130-140`). Here `provider_id` defaults to the `base_url` hostname slugified and `provider_name` to the hostname, both editable.

*Why:* the endpoint is now arbitrary, so a fixed vendor identity would be wrong in `config.toml` and would collide if a user configured two different endpoints. `provider_id` is constrained to `^[a-z0-9][a-z0-9_-]*$` because it is a TOML bare key inside `[model_providers.<id>]`; anything else would produce invalid TOML, so it is validated rather than quoted.

### D7. `models.json` is a template file, not inline code

The catalog body is stored as a template file with `{{SMALL}}` / `{{MEDIUM}}` / `{{LARGE}}` placeholders, ported from `codex-linux.sh.tpl:146+`, and rendered by substitution.

*Why:* the catalog is Codex-defined schema (~5KB, 163 lines, three entries). Hand-authoring or code-generating it invites transcription errors in fields this project has no opinion about, and makes future upstream changes a diff instead of a rewrite.

### D8. Next.js runs as a server; the safer path does not need it

`output: 'export'` is not used, because `/api/setup/*` must execute per request. The client-side full script is presented as the recommended option and the one-liner carries a visible "your key is in this URL" notice.

*Why:* the one-liner is the convenience `viber-router` users expect, and dropping it would remove requested scope. But a key in a URL is visible in shell history, in any proxy in between, and in server access logs. Offering both, defaulting to the safe one, and labelling the other is the honest resolution. The route handlers additionally add no request logging of their own; nothing in the app writes the request URL or query string anywhere.

### D9. `localStorage` holds everything except the key

Non-secret fields are restored on the next visit; the key is not stored anywhere and every access is wrapped so a throwing or absent `localStorage` degrades to empty defaults.

*Why:* re-typing an endpoint and model names each visit is friction with no security value, while a key persisted in browser storage is a real exposure on a shared machine.

### D10. Test strategy: unit tests on the generator, plus route-handler tests

Vitest covers the pure layer — JSON/TOML parse-ability and exact key sets, merge preservation, slot resolution, the rejection cases in D2, base URL normalization, provider id derivation, the three-slot catalog, and byte-identical client/server script output. Route handler tests cover status codes and `Content-Type` per `os`. `tsc --noEmit` and the linter must be clean.

*Why:* the entire contract lives in pure functions by D1, so unit tests reach nearly all of it without browser or server orchestration. No E2E layer is proposed: the remaining surface is a single form, and an E2E harness would cost more than the coverage it adds at this size.

*Not covered by automated tests:* the install scripts' own filesystem behaviour (backup, merge, abort-on-failure). Those are asserted by the specs and must be checked by hand on both a POSIX shell and PowerShell before the change is archived — this is called out as a manual verification task rather than left implicit.

## Risks / Trade-offs

- **API key travels in the URL on the one-liner path** → The client-side full script is the default and the recommended option; the one-liner carries a visible notice; no server-side logging captures the query string. Ported unchanged from `viber-router`'s existing behaviour, so no new exposure is introduced relative to what the user already runs.
- **A generated script runs with the user's privileges** → Input alphabet is narrow and enforced by rejection (D2); the scripts write only inside `~/.claude` or `~/.codex`; no `sudo`, no package installs, no network fetches beyond the one-liner's own retrieval.
- **Charset rejection may refuse a legitimate key or model name** → Matches `viber-router`'s production charset. The error message names the field and the allowed characters so the user is not left guessing. Widening is a localized change.
- **`jq` is required for the POSIX merge** → The script checks for it up front and prints per-distribution install commands before exiting, as `claudecode-linux.sh.tpl:330-341` already does. PowerShell needs nothing extra.
- **`config.toml` is overwritten, not merged** → Backed up first, abort on backup failure, and the UI states plainly that the file is replaced.
- **Ported template code carries a restrictive licence** → See Open Questions; blocking on it before porting.
- **Codex `models.json` schema is defined upstream and may drift** → Kept as a standalone template file so an upstream change is a file replacement, and the three slot placeholders are the only thing this project owns inside it.

## Migration Plan

Not applicable in the usual sense — greenfield project, nothing deployed, no data to migrate. Two notes that stand in for it:

- The project is not a git repository. Initialising one and choosing a remote is left to the user; this change does not run `git init`.
- For a user migrating off the `viber-router` setup script: that script exported `ANTHROPIC_*` variables into shell startup files. This tool does not remove them, and they override `settings.json`. The generated script therefore warns and prints the exact lines to remove, leaving the removal to the user. That is a deliberate consequence of the "touch only the config file" requirement.

## Open Questions

- **Licence for the ported templates.** `viber-router/LICENSE` is *"Context Engine — Source-Available, Non-Commercial License, Copyright (c) 2026 viber.vn. All rights reserved."* The four `.tpl` files and the `models.json` catalog body are the source for this project's script templates. The user appears to own that repository, but ownership cannot be assumed from a local path. **The user must confirm** whether these files may be ported, and under what attribution, before the porting tasks run. Until then the ported files carry an attribution header naming the origin. This does not change the specs or the approach — only whether the templates are copied or re-derived — so it is deferrable past design but must be answered before the change is archived.
