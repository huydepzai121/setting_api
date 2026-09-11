## 1. Project scaffolding

- [x] 1.1 Create `package.json` with Next.js (App Router), React, TypeScript, Vitest and a linter; do not run `git init`
- [x] 1.2 Create `tsconfig.json` in strict mode with a `@/*` path alias to `src/`
- [x] 1.3 Create `next.config.ts` without `output: 'export'`, since `/api/setup/*` must run per request
- [x] 1.4 Create `vitest.config.ts` covering `src/lib/**/*.test.ts` and resolving the `@/*` alias
- [x] 1.5 Create the App Router shell: `src/app/layout.tsx` and `src/app/globals.css`
- [x] 1.6 Create `.gitignore` (`node_modules`, `.next`, build output) and a `README.md` stating the project's purpose and how to run it
- [x] 1.7 Verify `npm install`, `npx tsc --noEmit` and `npx vitest run` all execute cleanly on the empty scaffold ← (verify: toolchain runs end to end before any feature code exists)

## 2. Validation layer

- [x] 2.1 Implement `validateApiKey` in `src/lib/validation.ts` — non-empty, ≤ 300 chars, charset `[A-Za-z0-9._:-]`; reject, never strip (design.md D2)
- [x] 2.2 Implement `validateModelName` — non-empty, same charset; reject, never filter
- [x] 2.3 Implement `normalizeBaseUrl` — parse with `URL`, accept only `http`/`https`, strip every trailing `/`, reject otherwise
- [x] 2.4 Implement `deriveProviderId` / `deriveProviderName` from the `base_url` hostname, and `validateProviderId` against `^[a-z0-9][a-z0-9_-]*$`
- [x] 2.5 Implement `resolveModelTiers` — primary model fills every unset tier (Claude Code: haiku/sonnet/opus; Codex: small/medium/large), and `resolveSubagentModel` returns the selected tier's resolved model (default tier: sonnet) (design.md D5)
- [x] 2.6 Validate every resolved tier override with `validateModelName`, and reject an empty or malformed one instead of emitting it into a config file
- [x] 2.7 Define the validation result type so every failure names the offending field, and write `src/lib/validation.test.ts` covering: valid key; key containing space, `'`, `"`, `$`, backtick, `;`, `|`, `&`, `\` and newline; empty key; 301-char key; model with a space; empty primary model; trailing-slash and multi-trailing-slash base URLs; `file://` and `ftp://` schemes; unparsable base URL; hostname-derived provider id; invalid provider id; tier resolution with no overrides and with partial overrides; a cleared tier override rejected; subagent tier resolution for each of the three tiers ← (verify: every rejection case in specs/cli-config/setup-script is asserted, and rejection — not sanitisation — is what the tests assert)

## 3. Claude Code config generator

- [x] 3.1 Implement `buildClaudeSettings` in `src/lib/claude-code.ts` producing exactly the key set in specs/cli-config/claude-code (`env` with six entries, `disableLoginPrompt`, `includeCoAuthoredBy`) and nothing more
- [x] 3.2 Implement `mergeClaudeSettings(existing, generated)` preserving every unowned top-level key and every unowned `env.*` entry
- [x] 3.3 Write `src/lib/claude-code.test.ts` covering: exact top-level and `env` key sets; values carried verbatim; no-override and partial-override tier results; `CLAUDE_CODE_SUBAGENT_MODEL` equal to the selected tier's value for each of haiku/sonnet/opus; unrelated top-level keys preserved; unrelated `env` entries preserved ← (verify: generated object has exactly the specified keys and merge loses nothing)

## 4. Codex config generator

- [x] 4.1 Confirm with the user whether the `viber-router` templates may be ported under its Source-Available Non-Commercial licence (design.md — Open Questions); port with an attribution header naming the origin — pre-resolved by the user: `viber-router`'s LICENSE is "Context Engine — Source-Available, Non-Commercial License, Copyright (c) 2026 viber.vn. All rights reserved."; porting into this project was explicitly authorized. Attribution header added at the top of `src/templates/codex-models.json.tpl` naming the origin file (`codex-linux.sh.tpl` lines 146-311) and the copyright/license line.
- [x] 4.2 Port the Codex model catalog body to `src/templates/codex-models.json.tpl` with `{{SMALL}}` / `{{MEDIUM}}` / `{{LARGE}}` placeholders, from `viber-router-api/templates/setup/codex-linux.sh.tpl` lines 148-310 — copy it, do not hand-author it (design.md D7). Extracted with `sed -n '148,310p'` (source already used `{{SMALL}}`/`{{MEDIUM}}`/`{{LARGE}}` placeholders, no hand-editing of the catalog body needed). Verified the extracted file, with the attribution header stripped and placeholders substituted, parses as valid JSON with 3 ordered entries.
- [x] 4.3 Implement `buildCodexConfigToml` in `src/lib/codex.ts` — `model`, `model_provider`, `model_catalog_json`, `[model_providers.<id>]` with `name`/`base_url`/`experimental_bearer_token`/`wire_api="responses"`, `[features] apps=false`
- [x] 4.4 Implement `buildCodexModelsJson` rendering the template into exactly three ordered entries for the small, medium and large slots
- [x] 4.5 Write `src/lib/codex.test.ts` covering: TOML parses and the provider table has exactly the four keys; `wire_api` is `responses`; `model` equals the medium slot; catalog has three slugs in order; identical slot values still yield three entries; each entry exposes the `low`/`medium`/`high`/`xhigh` reasoning levels; `provider_id` derivation and rejection ← (verify: parse the generated TOML and JSON rather than string-matching, so a malformed document fails the test). 15 tests, using `smol-toml`'s `parse` (added as a devDependency) and `JSON.parse` — no string-matching assertions.

## 5. Script templates

- [x] 5.1 Port `claudecode-posix.sh.tpl` from `claudecode-linux.sh.tpl`, dropping the shell-startup-file cleanup and `unset` block (~lines 385–430) and all statusline and `TRACKING_URL` handling; keep the `jq` presence check, the backup helper and the merge
- [x] 5.2 Port `claudecode-windows.ps1.tpl`, dropping `[Environment]::SetEnvironmentVariable` (lines 62–122) and the statusline install (lines 144–360); merge via `ConvertFrom-Json` / `ConvertTo-Json`
- [x] 5.3 Add the environment-variable warning block to both Claude Code templates: detect the seven `ANTHROPIC_*` / `CLAUDE_CODE_SUBAGENT_MODEL` variables, treat an empty string as set, print which ones override `settings.json` and how to remove them — warn only, never unset
- [x] 5.4 Port `codex-posix.sh.tpl` and `codex-windows.ps1.tpl`, removing the `npm install -g @openai/codex` step; warn when `codex` is absent and still write the config files
- [x] 5.5 Ensure every template backs up before writing and aborts non-zero on backup failure, and that Codex `auth.json` is written only when missing or empty
- [x] 5.6 Confirm by reading each finished template that it writes nothing outside `~/.claude` or `~/.codex` — no shell startup file, no Windows User/Machine environment variable, no statusline file, no package install ← (verify: grep each template for `bashrc`, `zshrc`, `zshenv`, `profile`, `SetEnvironmentVariable`, `setx`, `statusline`, `npm install` and confirm zero matches)

## 6. Script renderer

- [x] 6.1 Implement `renderScript` in `src/lib/script.ts` — `{{VAR}}` substitution plus `isWindows(os)` matching `windows`/`win` case-insensitively, POSIX otherwise
- [x] 6.2 Wire the validated input through to template variables so a single call produces the finished script for one target and OS, and compose the selected targets into the combined script and one-line output — a deselected target must contribute nothing
- [x] 6.3 Write `src/lib/script.test.ts` covering: Windows selected by `Windows`/`win`/`WIN`; POSIX for `linux`, `macos`, an unknown value and an absent value; all supplied values present in the rendered output; no unreplaced `{{...}}` placeholder remains in any of the four templates ← (verify: the leftover-placeholder assertion runs against every template, so a renamed variable fails loudly)

## 7. Installer route handlers

- [x] 7.1 Implement `GET /api/setup/claudecode` in `src/app/api/setup/claudecode/route.ts` — accept `key`, `base_url`, `os`, the three model tiers and `subagent` (the resolved subagent model), validate, render
- [x] 7.2 Implement `GET /api/setup/codex` in `src/app/api/setup/codex/route.ts` — accept `key`, `base_url`, `os`, the three model tiers, `provider_id` and `provider_name`
- [x] 7.3 Set `Content-Type` to `text/plain; charset=utf-8` for Windows and `text/x-shellscript; charset=utf-8` otherwise
- [x] 7.4 Return HTTP 400 with a plain-text body naming the offending field on any validation failure, emitting no partial script
- [x] 7.5 Confirm neither handler — nor any middleware or instrumentation in the project — logs the request URL, query string or key (design.md D8). Audited: grepped the whole project (excluding node_modules/.next) for `middleware.*`, `proxy.*`, `instrumentation.*` — none exist, at either project root or under `src/`. Grepped `src/` for `console.`, `logger.`, `winston`, `pino`, `morgan` — the only hits are this file's and the Codex route's own doc comments stating they do NOT log; no executable logging call exists anywhere in `src/`. `next.config.ts` sets no `logging` option. Residual caveat (not something this app's code does): `next dev`'s built-in dev server prints a per-request line (`GET /api/setup/... 200 in Xms`) to the terminal, which includes the query string; this is Next's own dev-only console output, not application code, and does not occur under `next start`/production. No workaround was applied per design.md D8's instruction to report rather than silently route around framework defaults.
- [x] 7.6 Write route handler tests covering both content types, a key containing a space returning 400 with no script content, and a missing `base_url` returning 400 ← (verify: status, `Content-Type` and body all asserted; a 400 body must not contain script text). 16 tests added in `src/app/api/setup/setup-routes.test.ts`, calling the exported `GET` functions directly with a constructed `Request`.

## 8. Web UI

- [x] 8.1 Build the form in `src/app/page.tsx` plus components: `base_url`, masked `api_key` with reveal toggle, primary model, advanced per-tier overrides grouped per target (hidden by default, pre-filled from the primary model), a three-way subagent tier choice defaulting to sonnet, target selector for Claude Code and Codex, OS selector, and `provider_id` / `provider_name` shown only when Codex is selected
- [x] 8.2 Build the tabbed result panel — `settings.json`, `config.toml`, `models.json`, `auth.json`, `One-line install`, `Full script` — gated by the selected targets, each with copy and download actions using the artifact's real filename
- [x] 8.3 Implement the idle, invalid, valid and copied states, with copy and download disabled while idle or invalid
- [x] 8.4 Implement inline per-field validation errors that persist until corrected, with no navigation, no modal and no auto-dismissing notification
- [x] 8.5 Generate the full script client-side from the same `src/lib` functions the route handlers use, present it as the recommended path, and attach a visible notice to the one-liner that the key travels in the URL
- [x] 8.6 Persist `base_url`, model names, provider fields, target and OS selections to `localStorage`; never persist the key; wrap every access in try/catch so a throwing or absent store degrades to empty defaults
- [x] 8.7 Apply accessibility: label-input association, `aria-invalid` and `aria-describedby` on errored fields, a live region for copy confirmations, visible focus indicators, WCAG 2.1 AA contrast, and full keyboard operation of inputs, toggles, tabs and actions
- [x] 8.8 Make the layout usable at 400px width — single-column stacking, no horizontal body scroll
- [x] 8.9 Confirm the one-line installer carries every tier override and the resolved subagent model, so it produces the same configuration as the full script
- [x] 8.10 Confirm the client-rendered full script is byte-identical to the matching route handler's output for the same input and OS ← (verify: assert equality in a test that calls both paths, so the two delivery paths cannot drift)

## 9. Verification

- [x] 9.1 Run `npx tsc --noEmit` and the linter; both must be clean
- [x] 9.2 Run `npx vitest run`; all tests must pass
- [x] 9.3 Manually exercise the POSIX script in a shell: fresh install creates `settings.json`; re-run backs up and preserves an unrelated `permissions` key and an unrelated `env` entry; a read-only `~/.claude` aborts non-zero and leaves the file unchanged; an exported `ANTHROPIC_BASE_URL` produces a warning and is still set afterwards ← (verify: the filesystem behaviours in specs/cli-config/claude-code that unit tests cannot reach)
- [x] 9.4 Manually exercise the Windows PowerShell script for the same cases, plus Codex: existing non-empty `auth.json` untouched, `config.toml` backed up before overwrite, and no User or Machine environment variable created or changed ← (verify: specs/cli-config/codex install requirements on the platform that has its own merge implementation)
