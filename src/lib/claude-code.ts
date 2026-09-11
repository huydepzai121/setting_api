/**
 * Pure Claude Code `~/.claude/settings.json` generator, shared by the
 * browser UI and the `/api/setup/claudecode` route handler (design.md D1).
 *
 * No I/O, no React, no Next.js imports — this module must stay usable from
 * both a browser bundle and a Node route handler with byte-identical
 * results.
 *
 * Callers MUST resolve and validate tiers before calling
 * {@link buildClaudeSettings}: run `resolveModelTiers` then
 * `validateResolvedTiers` (see src/lib/validation.ts) so a deliberately
 * cleared override is rejected instead of silently emitted as `""`.
 */

import type { ClaudeCodeModelTier, ResolvedTiers } from "./validation";

/** The six `env.*` keys this tool owns inside `settings.json`. */
export interface ClaudeSettingsEnv {
  ANTHROPIC_BASE_URL: string;
  ANTHROPIC_AUTH_TOKEN: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL: string;
  CLAUDE_CODE_SUBAGENT_MODEL: string;
}

/** The exact `settings.json` shape this tool generates — nothing more. */
export interface ClaudeSettings {
  env: ClaudeSettingsEnv;
  disableLoginPrompt: true;
  includeCoAuthoredBy: false;
}

/** Input to {@link buildClaudeSettings}. */
export interface BuildClaudeSettingsInput {
  /** Normalized `base_url` (see `normalizeBaseUrl`). */
  baseUrl: string;
  /** Validated API key (see `validateApiKey`). */
  apiKey: string;
  /**
   * The fully resolved and validated haiku/sonnet/opus tiers — the result
   * of `validateResolvedTiers(resolveModelTiers(...))`, never the raw
   * output of `resolveModelTiers` alone.
   */
  resolvedTiers: ResolvedTiers<ClaudeCodeModelTier>;
  /**
   * The model to write into `CLAUDE_CODE_SUBAGENT_MODEL`. This is not a
   * free-text fourth model — callers must derive it with
   * `resolveSubagentModel(resolvedTiers, subagentTier)` so the value is
   * always identical to one of the three `ANTHROPIC_DEFAULT_*_MODEL`
   * entries above (design.md D5, spec: "Subagent tier selection").
   */
  subagentModel: string;
}

/**
 * Builds the Claude Code `settings.json` object. The result has exactly the
 * top-level keys `env`, `disableLoginPrompt` and `includeCoAuthoredBy`, and
 * `env` has exactly the six keys listed in specs/cli-config/claude-code —
 * nothing more, nothing less.
 */
export function buildClaudeSettings(
  input: BuildClaudeSettingsInput,
): ClaudeSettings {
  const { baseUrl, apiKey, resolvedTiers, subagentModel } = input;
  return {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: resolvedTiers.haiku,
      ANTHROPIC_DEFAULT_SONNET_MODEL: resolvedTiers.sonnet,
      ANTHROPIC_DEFAULT_OPUS_MODEL: resolvedTiers.opus,
      CLAUDE_CODE_SUBAGENT_MODEL: subagentModel,
    },
    disableLoginPrompt: true,
    includeCoAuthoredBy: false,
  };
}

/** Narrows `value` to a plain JSON object (not `null`, not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges a freshly generated {@link ClaudeSettings} object into whatever
 * `existing` parsed `settings.json` content already holds, preserving every
 * key this tool does not own (design.md D3, spec: "Merge, never clobber").
 *
 * Ownership is exactly:
 * - top level: `env`, `disableLoginPrompt`, `includeCoAuthoredBy`
 * - inside `env`: the six keys on {@link ClaudeSettingsEnv}
 *
 * Every other top-level key (e.g. `permissions`, `model`, `hooks`,
 * `statusLine`) and every other `env.*` entry is carried over unchanged.
 *
 * `existing` is untrusted, parsed JSON and may be anything: `undefined`
 * (no file yet), `null`, a primitive, an array, or a malformed/non-object
 * value (spec: "Unparsable existing file" — the caller backs up and warns
 * before calling this with no prior content). Rather than throw on those
 * shapes, this function treats anything that is not a plain object as "no
 * existing settings" and returns a fresh document containing only the
 * generated keys. This keeps the function total (never throws) and never
 * produces a broken document — the caller is responsible for warning the
 * user separately when `existing` was supposed to be valid JSON but was
 * not.
 */
export function mergeClaudeSettings(
  existing: unknown,
  generated: ClaudeSettings,
): Record<string, unknown> {
  const existingBase = isPlainObject(existing) ? existing : {};
  const existingEnv = isPlainObject(existingBase.env)
    ? existingBase.env
    : {};

  return {
    ...existingBase,
    env: {
      ...existingEnv,
      ...generated.env,
    },
    disableLoginPrompt: generated.disableLoginPrompt,
    includeCoAuthoredBy: generated.includeCoAuthoredBy,
  };
}
