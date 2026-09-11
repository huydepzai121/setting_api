/**
 * Pure Codex `~/.codex/config.toml` and `~/.codex/models.json` generators,
 * shared by the browser UI and the `/api/setup/codex` route handler
 * (design.md D1).
 *
 * No I/O, no React, no Next.js imports — this module must stay usable from
 * both a browser bundle and a Node route handler with byte-identical
 * results. In particular the `models.json` catalog template is embedded
 * below as a module-level string constant rather than read from disk with
 * `fs.readFileSync`, because that would work in the route handler but not
 * in a browser bundle. The canonical, human-editable copy of that template
 * lives at `src/templates/codex-models.json.tpl`; the constant below is a
 * byte-for-byte copy of that file's contents (attribution header
 * included), embedded via `JSON.stringify` so no escaping was hand-typed.
 * If the `.tpl` file is ever re-ported upstream, regenerate this constant
 * from it in the same way.
 *
 * Callers MUST resolve and validate tiers before calling either builder
 * below: run `resolveModelTiers` then `validateResolvedTiers` (see
 * src/lib/validation.ts) so a deliberately cleared override is rejected
 * instead of silently emitted into `config.toml` or `models.json`.
 * Likewise `provider_id` must already be validated with
 * `validateProviderId`, and `base_url` / `api_key` with
 * `normalizeBaseUrl` / `validateApiKey`.
 */

import type { CodexModelTier, ResolvedTiers } from "./validation";

/**
 * Ported, byte-for-byte, from `src/templates/codex-models.json.tpl`, which
 * is itself ported from viber-router-api/templates/setup/codex-linux.sh.tpl
 * (lines 146-311) under viber-router's Source-Available, Non-Commercial
 * License — see the attribution header at the top of that `.tpl` file for
 * the full notice. Do not hand-edit this constant; regenerate it from the
 * `.tpl` file instead.
 */
export const CODEX_MODELS_TEMPLATE: string =
  "// Ported from viber-router-api/templates/setup/codex-linux.sh.tpl (lines\n// 146-311, the models.json catalog body written inside its heredoc).\n// Origin repository: viber-router (D:/Dev/www/viber-router), which is NOT\n// part of this project and must never be modified from here.\n// Copyright (c) 2026 viber.vn. Licensed under the \"Context Engine —\n// Source-Available, Non-Commercial License. All rights reserved.\" Ported\n// into this project with the origin repository owner's explicit\n// authorization (openspec/changes/add-cli-config-generator/design.md,\n// Open Questions).\n//\n// This is a template, not standalone JSON: `{{SMALL}}` / `{{MEDIUM}}` /\n// `{{LARGE}}` are placeholders substituted by buildCodexModelsJson in\n// src/lib/codex.ts, which also strips this leading comment block before\n// parsing. Every field below other than the three placeholders is the\n// Codex-CLI-defined catalog schema, preserved exactly as ported — see\n// design.md D7. Do not hand-edit the catalog body; re-port it instead.\n{\n  \"models\": [\n    {\n      \"slug\": \"{{SMALL}}\",\n      \"display_name\": \"{{SMALL}}\",\n      \"description\": \"{{SMALL}} via Viber Router (Fast)\",\n      \"default_reasoning_level\": \"medium\",\n      \"supported_reasoning_levels\": [\n        {\n          \"effort\": \"low\",\n          \"description\": \"Minimal reasoning\"\n        },\n        {\n          \"effort\": \"medium\",\n          \"description\": \"Balanced reasoning\"\n        },\n        {\n          \"effort\": \"high\",\n          \"description\": \"Deep reasoning\"\n        },\n        {\n          \"effort\": \"xhigh\",\n          \"description\": \"Maximum reasoning\"\n        }\n      ],\n      \"shell_type\": \"shell_command\",\n      \"visibility\": \"list\",\n      \"supported_in_api\": true,\n      \"priority\": 1,\n      \"availability_nux\": null,\n      \"upgrade\": null,\n      \"base_instructions\": \"\",\n      \"model_messages\": null,\n      \"supports_reasoning_summaries\": false,\n      \"default_reasoning_summary\": \"auto\",\n      \"support_verbosity\": true,\n      \"default_verbosity\": null,\n      \"apply_patch_tool_type\": null,\n      \"web_search_tool_type\": \"text\",\n      \"truncation_policy\": {\n        \"mode\": \"tokens\",\n        \"limit\": 400000\n      },\n      \"supports_parallel_tool_calls\": true,\n      \"supports_image_detail_original\": false,\n      \"context_window\": 400000,\n      \"auto_compact_token_limit\": null,\n      \"effective_context_window_percent\": 95,\n      \"experimental_supported_tools\": [],\n      \"input_modalities\": [\n        \"text\",\n        \"image\"\n      ],\n      \"supports_search_tool\": false\n    },\n    {\n      \"slug\": \"{{MEDIUM}}\",\n      \"display_name\": \"{{MEDIUM}}\",\n      \"description\": \"{{MEDIUM}} via Viber Router (Default)\",\n      \"default_reasoning_level\": \"medium\",\n      \"supported_reasoning_levels\": [\n        {\n          \"effort\": \"low\",\n          \"description\": \"Minimal reasoning\"\n        },\n        {\n          \"effort\": \"medium\",\n          \"description\": \"Balanced reasoning\"\n        },\n        {\n          \"effort\": \"high\",\n          \"description\": \"Deep reasoning\"\n        },\n        {\n          \"effort\": \"xhigh\",\n          \"description\": \"Maximum reasoning\"\n        }\n      ],\n      \"shell_type\": \"shell_command\",\n      \"visibility\": \"list\",\n      \"supported_in_api\": true,\n      \"priority\": 2,\n      \"availability_nux\": null,\n      \"upgrade\": null,\n      \"base_instructions\": \"\",\n      \"model_messages\": null,\n      \"supports_reasoning_summaries\": false,\n      \"default_reasoning_summary\": \"auto\",\n      \"support_verbosity\": true,\n      \"default_verbosity\": null,\n      \"apply_patch_tool_type\": null,\n      \"web_search_tool_type\": \"text\",\n      \"truncation_policy\": {\n        \"mode\": \"tokens\",\n        \"limit\": 400000\n      },\n      \"supports_parallel_tool_calls\": true,\n      \"supports_image_detail_original\": false,\n      \"context_window\": 400000,\n      \"auto_compact_token_limit\": null,\n      \"effective_context_window_percent\": 95,\n      \"experimental_supported_tools\": [],\n      \"input_modalities\": [\n        \"text\",\n        \"image\"\n      ],\n      \"supports_search_tool\": false\n    },\n    {\n      \"slug\": \"{{LARGE}}\",\n      \"display_name\": \"{{LARGE}}\",\n      \"description\": \"{{LARGE}} via Viber Router (Powerful)\",\n      \"default_reasoning_level\": \"medium\",\n      \"supported_reasoning_levels\": [\n        {\n          \"effort\": \"low\",\n          \"description\": \"Minimal reasoning\"\n        },\n        {\n          \"effort\": \"medium\",\n          \"description\": \"Balanced reasoning\"\n        },\n        {\n          \"effort\": \"high\",\n          \"description\": \"Deep reasoning\"\n        },\n        {\n          \"effort\": \"xhigh\",\n          \"description\": \"Maximum reasoning\"\n        }\n      ],\n      \"shell_type\": \"shell_command\",\n      \"visibility\": \"list\",\n      \"supported_in_api\": true,\n      \"priority\": 3,\n      \"availability_nux\": null,\n      \"upgrade\": null,\n      \"base_instructions\": \"\",\n      \"model_messages\": null,\n      \"supports_reasoning_summaries\": false,\n      \"default_reasoning_summary\": \"auto\",\n      \"support_verbosity\": true,\n      \"default_verbosity\": null,\n      \"apply_patch_tool_type\": null,\n      \"web_search_tool_type\": \"text\",\n      \"truncation_policy\": {\n        \"mode\": \"tokens\",\n        \"limit\": 400000\n      },\n      \"supports_parallel_tool_calls\": true,\n      \"supports_image_detail_original\": false,\n      \"context_window\": 400000,\n      \"auto_compact_token_limit\": null,\n      \"effective_context_window_percent\": 95,\n      \"experimental_supported_tools\": [],\n      \"input_modalities\": [\n        \"text\",\n        \"image\"\n      ],\n      \"supports_search_tool\": false\n    }\n  ]\n}\n";

/** Strips the leading `//`-comment attribution block from the template. */
function stripLeadingCommentBlock(template: string): string {
  const lines = template.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim().startsWith("//")) {
    i++;
  }
  return lines.slice(i).join("\n");
}

/** Returns `value` as it would appear inside a JSON string literal, without the surrounding quotes. */
function jsonStringContent(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/**
 * Escapes `value` for embedding inside a TOML basic string (a
 * double-quoted string literal), per the TOML v1.0 spec: backslash and
 * `"` are escaped, and every control character is escaped as one of the
 * named short escapes or a `\uXXXX` escape. The narrow validated charset
 * used elsewhere in this project (`[A-Za-z0-9._:-]`) never needs any of
 * this, but `provider_name` has no such restriction, so this function
 * makes every string value embedded into `config.toml` safe regardless.
 */
function escapeTomlBasicString(value: string): string {
  let out = "";
  for (const ch of value) {
    switch (ch) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\b":
        out += "\\b";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\r":
        out += "\\r";
        break;
      default: {
        const code = ch.codePointAt(0)!;
        if (code < 0x20 || code === 0x7f) {
          out += `\\u${code.toString(16).padStart(4, "0")}`;
        } else {
          out += ch;
        }
      }
    }
  }
  return out;
}

/** Input to {@link buildCodexConfigToml}. */
export interface BuildCodexConfigTomlInput {
  /** Normalized `base_url` (see `normalizeBaseUrl`). */
  baseUrl: string;
  /** Validated API key (see `validateApiKey`). */
  apiKey: string;
  /**
   * Validated Codex provider id (see `validateProviderId`), used both as
   * the `model_provider` value and as the `[model_providers.<id>]` TOML
   * table's bare key. Because it is already constrained to
   * `^[a-z0-9][a-z0-9_-]*$`, it never needs TOML key quoting or escaping
   * (design.md D6).
   */
  providerId: string;
  /** Provider display name, embedded as the table's `name` string value. */
  providerName: string;
  /**
   * The fully resolved and validated small/medium/large tiers — the
   * result of `validateResolvedTiers(resolveModelTiers(...))`, never the
   * raw output of `resolveModelTiers` alone.
   */
  resolvedTiers: ResolvedTiers<CodexModelTier>;
}

/**
 * Builds the Codex `config.toml` text. The result has exactly the
 * top-level keys `model`, `model_provider` and `model_catalog_json`, a
 * `[model_providers.<provider_id>]` table with exactly the keys `name`,
 * `base_url`, `experimental_bearer_token` and `wire_api`, and a
 * `[features]` table with exactly the key `apps` (specs/cli-config/codex,
 * "Codex config.toml content"). `model` is the medium tier, `wire_api` is
 * always `"responses"` and `features.apps` is always `false`.
 */
export function buildCodexConfigToml(input: BuildCodexConfigTomlInput): string {
  const { baseUrl, apiKey, providerId, providerName, resolvedTiers } = input;

  const lines = [
    `model = "${escapeTomlBasicString(resolvedTiers.medium)}"`,
    `model_provider = "${escapeTomlBasicString(providerId)}"`,
    `model_catalog_json = "~/.codex/models.json"`,
    "",
    `[model_providers.${providerId}]`,
    `name = "${escapeTomlBasicString(providerName)}"`,
    `base_url = "${escapeTomlBasicString(baseUrl)}"`,
    `experimental_bearer_token = "${escapeTomlBasicString(apiKey)}"`,
    `wire_api = "responses"`,
    "",
    `[features]`,
    `apps = false`,
    "",
  ];

  return lines.join("\n");
}

/** Input to {@link buildCodexModelsJson}. */
export interface BuildCodexModelsJsonInput {
  /**
   * The fully resolved and validated small/medium/large tiers — the
   * result of `validateResolvedTiers(resolveModelTiers(...))`, never the
   * raw output of `resolveModelTiers` alone.
   */
  resolvedTiers: ResolvedTiers<CodexModelTier>;
}

/**
 * Renders the Codex `models.json` catalog by substituting the small,
 * medium and large tiers' model names into the `{{SMALL}}` / `{{MEDIUM}}`
 * / `{{LARGE}}` placeholders of the ported template. The result always
 * has exactly three entries, in small/medium/large order — even when two
 * or three tiers resolve to the same model name (specs/cli-config/codex,
 * "Codex models.json catalog"). Every field other than `slug`,
 * `display_name` and the model name inside `description` is preserved
 * exactly as ported (design.md D7).
 */
export function buildCodexModelsJson(input: BuildCodexModelsJsonInput): string {
  const { resolvedTiers } = input;
  const body = stripLeadingCommentBlock(CODEX_MODELS_TEMPLATE);

  const rendered = body
    .replaceAll("{{SMALL}}", jsonStringContent(resolvedTiers.small))
    .replaceAll("{{MEDIUM}}", jsonStringContent(resolvedTiers.medium))
    .replaceAll("{{LARGE}}", jsonStringContent(resolvedTiers.large));

  // Sanity check only: a failure here means the embedded template was
  // corrupted, not that the caller supplied bad input (resolvedTiers is
  // already validated by the caller via validateResolvedTiers).
  JSON.parse(rendered);

  return rendered;
}
