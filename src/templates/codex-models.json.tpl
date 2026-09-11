// Ported from viber-router-api/templates/setup/codex-linux.sh.tpl (lines
// 146-311, the models.json catalog body written inside its heredoc).
// Origin repository: viber-router (D:/Dev/www/viber-router), which is NOT
// part of this project and must never be modified from here.
// Copyright (c) 2026 viber.vn. Licensed under the "Context Engine —
// Source-Available, Non-Commercial License. All rights reserved." Ported
// into this project with the origin repository owner's explicit
// authorization (openspec/changes/add-cli-config-generator/design.md,
// Open Questions).
//
// This is a template, not standalone JSON: `{{SMALL}}` / `{{MEDIUM}}` /
// `{{LARGE}}` are placeholders substituted by buildCodexModelsJson in
// src/lib/codex.ts, which also strips this leading comment block before
// parsing. Every field below other than the three placeholders is the
// Codex-CLI-defined catalog schema, preserved exactly as ported — see
// design.md D7. Do not hand-edit the catalog body; re-port it instead.
{
  "models": [
    {
      "slug": "{{SMALL}}",
      "display_name": "{{SMALL}}",
      "description": "{{SMALL}} via Viber Router (Fast)",
      "default_reasoning_level": "medium",
      "supported_reasoning_levels": [
        {
          "effort": "low",
          "description": "Minimal reasoning"
        },
        {
          "effort": "medium",
          "description": "Balanced reasoning"
        },
        {
          "effort": "high",
          "description": "Deep reasoning"
        },
        {
          "effort": "xhigh",
          "description": "Maximum reasoning"
        }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 1,
      "availability_nux": null,
      "upgrade": null,
      "base_instructions": "",
      "model_messages": null,
      "supports_reasoning_summaries": false,
      "default_reasoning_summary": "auto",
      "support_verbosity": true,
      "default_verbosity": null,
      "apply_patch_tool_type": null,
      "web_search_tool_type": "text",
      "truncation_policy": {
        "mode": "tokens",
        "limit": 400000
      },
      "supports_parallel_tool_calls": true,
      "supports_image_detail_original": false,
      "context_window": 400000,
      "auto_compact_token_limit": null,
      "effective_context_window_percent": 95,
      "experimental_supported_tools": [],
      "input_modalities": [
        "text",
        "image"
      ],
      "supports_search_tool": false
    },
    {
      "slug": "{{MEDIUM}}",
      "display_name": "{{MEDIUM}}",
      "description": "{{MEDIUM}} via Viber Router (Default)",
      "default_reasoning_level": "medium",
      "supported_reasoning_levels": [
        {
          "effort": "low",
          "description": "Minimal reasoning"
        },
        {
          "effort": "medium",
          "description": "Balanced reasoning"
        },
        {
          "effort": "high",
          "description": "Deep reasoning"
        },
        {
          "effort": "xhigh",
          "description": "Maximum reasoning"
        }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 2,
      "availability_nux": null,
      "upgrade": null,
      "base_instructions": "",
      "model_messages": null,
      "supports_reasoning_summaries": false,
      "default_reasoning_summary": "auto",
      "support_verbosity": true,
      "default_verbosity": null,
      "apply_patch_tool_type": null,
      "web_search_tool_type": "text",
      "truncation_policy": {
        "mode": "tokens",
        "limit": 400000
      },
      "supports_parallel_tool_calls": true,
      "supports_image_detail_original": false,
      "context_window": 400000,
      "auto_compact_token_limit": null,
      "effective_context_window_percent": 95,
      "experimental_supported_tools": [],
      "input_modalities": [
        "text",
        "image"
      ],
      "supports_search_tool": false
    },
    {
      "slug": "{{LARGE}}",
      "display_name": "{{LARGE}}",
      "description": "{{LARGE}} via Viber Router (Powerful)",
      "default_reasoning_level": "medium",
      "supported_reasoning_levels": [
        {
          "effort": "low",
          "description": "Minimal reasoning"
        },
        {
          "effort": "medium",
          "description": "Balanced reasoning"
        },
        {
          "effort": "high",
          "description": "Deep reasoning"
        },
        {
          "effort": "xhigh",
          "description": "Maximum reasoning"
        }
      ],
      "shell_type": "shell_command",
      "visibility": "list",
      "supported_in_api": true,
      "priority": 3,
      "availability_nux": null,
      "upgrade": null,
      "base_instructions": "",
      "model_messages": null,
      "supports_reasoning_summaries": false,
      "default_reasoning_summary": "auto",
      "support_verbosity": true,
      "default_verbosity": null,
      "apply_patch_tool_type": null,
      "web_search_tool_type": "text",
      "truncation_policy": {
        "mode": "tokens",
        "limit": 400000
      },
      "supports_parallel_tool_calls": true,
      "supports_image_detail_original": false,
      "context_window": 400000,
      "auto_compact_token_limit": null,
      "effective_context_window_percent": 95,
      "experimental_supported_tools": [],
      "input_modalities": [
        "text",
        "image"
      ],
      "supports_search_tool": false
    }
  ]
}
