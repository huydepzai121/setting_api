/**
 * Pure composition layer between the web UI and `src/lib/*`.
 *
 * This module owns no I/O, no React and no browser globals except via the
 * caller-supplied `origin` parameter — it exists so the page (`Generator`)
 * and the parity test (`src/lib/parity.test.ts`) call the exact same
 * functions to produce `settings.json`, `config.toml`, `models.json`, the
 * full install script and the one-line install command (design.md D1,
 * tasks.md 8.5/8.9/8.10). It reuses `src/lib/validation.ts`,
 * `src/lib/claude-code.ts`, `src/lib/codex.ts` and `src/lib/script.ts`
 * exactly as the route handlers do; it never re-implements validation,
 * merging, TOML/script rendering or query-string building itself.
 */

import { buildClaudeSettings } from "@/lib/claude-code";
import { buildCodexConfigToml, buildCodexModelsJson } from "@/lib/codex";
import {
  buildCombinedOneLiner,
  isWindows,
  renderCombinedScript,
} from "@/lib/script";
import {
  CLAUDE_CODE_MODEL_TIERS,
  CODEX_MODEL_TIERS,
  deriveProviderId,
  deriveProviderName,
  normalizeBaseUrl,
  resolveModelTiers,
  resolveSubagentModel,
  validateApiKey,
  validateModelName,
  validateProviderId,
  validateResolvedTiers,
  type ClaudeCodeModelTier,
  type CodexModelTier,
  type ResolvedTiers,
  type TierOverrides,
} from "@/lib/validation";

/** Every model tier identifier across both targets — used as the key space for `overrides`. */
export type TierId = ClaudeCodeModelTier | CodexModelTier;

/** Per-tier override text, keyed by tier. A tier is "touched" iff its key is present (see `resolveModelTiers`'s absent-vs-empty contract). */
export type OverridesState = Partial<Record<TierId, string>>;

export interface TargetSelection {
  claudeCode: boolean;
  codex: boolean;
}

/** Raw, unvalidated form state as held by the page. */
export interface GenerateInput {
  baseUrl: string;
  apiKey: string;
  primaryModel: string;
  targets: TargetSelection;
  /** `"posix"` or `"windows"` (or any value `isWindows` recognizes/rejects). */
  os: string;
  overrides: OverridesState;
  subagentTier: ClaudeCodeModelTier;
  /** `undefined` means "derive from the base_url hostname" (design.md D6). */
  providerId: string | undefined;
  /** `undefined` means "derive from the base_url hostname" (design.md D6). */
  providerName: string | undefined;
}

/** Field name -> message, for inline display beneath the offending input. */
export type FieldErrors = Record<string, string>;

export interface GenerateResult {
  ok: boolean;
  errors: FieldErrors;
  hasAnyTarget: boolean;
  baseUrl?: string;
  apiKey?: string;
  claudeCode?: {
    resolvedTiers: ResolvedTiers<ClaudeCodeModelTier>;
    subagentModel: string;
  };
  codex?: {
    resolvedTiers: ResolvedTiers<CodexModelTier>;
    providerId: string;
    providerName: string;
  };
}

/**
 * Narrows `overrides` to the `TierOverrides<Tier>` shape `resolveModelTiers`
 * expects for one target's tier set, preserving the absent-vs-present
 * distinction (a tier not in `overrides` is genuinely absent here too).
 */
function pickOverrides<Tier extends TierId>(
  overrides: OverridesState,
  tiers: readonly Tier[],
): TierOverrides<Tier> {
  const out: TierOverrides<Tier> = {};
  for (const tier of tiers) {
    if (Object.prototype.hasOwnProperty.call(overrides, tier)) {
      out[tier] = overrides[tier];
    }
  }
  return out;
}

/**
 * Resolves and validates one target's tiers, reporting a distinct field
 * error only for a tier the user actually overrode. A tier the user never
 * touched falls back to the primary model, whose own failure is already
 * reported once under the `model` field — repeating it under every
 * untouched tier would be noise pointing at inputs the advanced panel may
 * not even have open.
 */
function resolveTargetTiers<Tier extends TierId>(
  tiers: readonly Tier[],
  primaryModel: string,
  overrides: OverridesState,
  errors: FieldErrors,
): ResolvedTiers<Tier> | undefined {
  const picked = pickOverrides(overrides, tiers);
  const resolved = resolveModelTiers(tiers, primaryModel, picked);
  for (const tier of tiers) {
    if (Object.prototype.hasOwnProperty.call(picked, tier)) {
      const fieldResult = validateModelName(resolved[tier], tier);
      if (!fieldResult.ok) {
        errors[tier] = fieldResult.message;
      }
    }
  }
  const validated = validateResolvedTiers(resolved, tiers);
  return validated.ok ? validated.value : undefined;
}

/**
 * Validates the whole form and resolves everything needed to render output,
 * or collects field-named errors instead. This is the single source of
 * truth both `Generator` (for the live UI) and the parity test consult.
 */
export function computeGenerateResult(input: GenerateInput): GenerateResult {
  const errors: FieldErrors = {};

  const baseUrlResult = normalizeBaseUrl(input.baseUrl, "base_url");
  if (!baseUrlResult.ok) {
    errors.base_url = baseUrlResult.message;
  }

  const keyResult = validateApiKey(input.apiKey, "api_key");
  if (!keyResult.ok) {
    errors.api_key = keyResult.message;
  }

  const modelResult = validateModelName(input.primaryModel, "model");
  if (!modelResult.ok) {
    errors.model = modelResult.message;
  }

  const hasAnyTarget = input.targets.claudeCode || input.targets.codex;
  if (!hasAnyTarget) {
    errors.targets = "select at least one target";
  }

  let claudeCode: GenerateResult["claudeCode"];
  if (input.targets.claudeCode) {
    const resolvedTiers = resolveTargetTiers(
      CLAUDE_CODE_MODEL_TIERS,
      input.primaryModel,
      input.overrides,
      errors,
    );
    if (resolvedTiers) {
      claudeCode = {
        resolvedTiers,
        subagentModel: resolveSubagentModel(resolvedTiers, input.subagentTier),
      };
    }
  }

  let codex: GenerateResult["codex"];
  if (input.targets.codex) {
    const resolvedTiers = resolveTargetTiers(
      CODEX_MODEL_TIERS,
      input.primaryModel,
      input.overrides,
      errors,
    );

    const hostname = baseUrlResult.ok
      ? new URL(baseUrlResult.value).hostname
      : "";
    const providerId = input.providerId ?? deriveProviderId(hostname);
    const providerIdResult = validateProviderId(providerId);
    if (!providerIdResult.ok) {
      errors.provider_id = providerIdResult.message;
    }
    const providerName = input.providerName ?? deriveProviderName(hostname);

    if (resolvedTiers && providerIdResult.ok) {
      codex = {
        resolvedTiers,
        providerId: providerIdResult.value,
        providerName,
      };
    }
  }

  const ok =
    hasAnyTarget &&
    baseUrlResult.ok &&
    keyResult.ok &&
    modelResult.ok &&
    (!input.targets.claudeCode || claudeCode !== undefined) &&
    (!input.targets.codex || codex !== undefined);

  return {
    ok,
    errors,
    hasAnyTarget,
    baseUrl: baseUrlResult.ok ? baseUrlResult.value : undefined,
    apiKey: keyResult.ok ? keyResult.value : undefined,
    claudeCode,
    codex,
  };
}

/** `~/.claude/settings.json`, pretty-printed. Empty string when not yet valid or Claude Code is not selected. */
export function buildSettingsJsonText(result: GenerateResult): string {
  if (!result.ok || !result.claudeCode || !result.baseUrl || !result.apiKey) {
    return "";
  }
  const settings = buildClaudeSettings({
    baseUrl: result.baseUrl,
    apiKey: result.apiKey,
    resolvedTiers: result.claudeCode.resolvedTiers,
    subagentModel: result.claudeCode.subagentModel,
  });
  return `${JSON.stringify(settings, null, 2)}\n`;
}

/** `~/.codex/config.toml`. Empty string when not yet valid or Codex is not selected. */
export function buildConfigTomlText(result: GenerateResult): string {
  if (!result.ok || !result.codex || !result.baseUrl || !result.apiKey) {
    return "";
  }
  return buildCodexConfigToml({
    baseUrl: result.baseUrl,
    apiKey: result.apiKey,
    providerId: result.codex.providerId,
    providerName: result.codex.providerName,
    resolvedTiers: result.codex.resolvedTiers,
  });
}

/**
 * `~/.codex/models.json` — the real, complete rendered catalog (never a
 * truncated preview; the panel that displays this may clip visually but
 * copy/download always get this full string).
 */
export function buildModelsJsonText(result: GenerateResult): string {
  if (!result.ok || !result.codex) {
    return "";
  }
  return buildCodexModelsJson({ resolvedTiers: result.codex.resolvedTiers });
}

/**
 * `~/.codex/auth.json` as written ONLY when the file is missing or empty
 * (see `src/templates/codex-posix.sh.tpl` / `codex-windows.ps1.tpl`); an
 * existing non-empty `auth.json` is left untouched by the install script.
 */
export const AUTH_JSON_TEXT = "{}\n";

/** The finished install script for every *selected* target, for one OS. */
export function buildFullScriptText(result: GenerateResult, os: string): string {
  if (!result.ok || !result.baseUrl || !result.apiKey) {
    return "";
  }
  return renderCombinedScript({
    os,
    claudeCode: result.claudeCode
      ? {
          endpointUrl: result.baseUrl,
          apiKey: result.apiKey,
          resolvedTiers: result.claudeCode.resolvedTiers,
          subagentModel: result.claudeCode.subagentModel,
        }
      : undefined,
    codex: result.codex
      ? {
          endpointUrl: result.baseUrl,
          apiKey: result.apiKey,
          resolvedTiers: result.codex.resolvedTiers,
          providerId: result.codex.providerId,
          providerName: result.codex.providerName,
        }
      : undefined,
  });
}

/**
 * The one-line install command(s) for every *selected* target, carrying
 * every tier override and the resolved subagent model (tasks.md 8.9) —
 * built with `buildCombinedOneLiner` so the query string is never
 * hand-assembled here (design.md D1).
 */
export function buildOneLinerText(
  result: GenerateResult,
  os: string,
  origin: string,
): string {
  if (!result.ok || !result.baseUrl || !result.apiKey) {
    return "";
  }
  return buildCombinedOneLiner({
    origin,
    os,
    claudeCode: result.claudeCode
      ? {
          key: result.apiKey,
          base_url: result.baseUrl,
          haiku: result.claudeCode.resolvedTiers.haiku,
          sonnet: result.claudeCode.resolvedTiers.sonnet,
          opus: result.claudeCode.resolvedTiers.opus,
          subagent: result.claudeCode.subagentModel,
        }
      : undefined,
    codex: result.codex
      ? {
          key: result.apiKey,
          base_url: result.baseUrl,
          small: result.codex.resolvedTiers.small,
          medium: result.codex.resolvedTiers.medium,
          large: result.codex.resolvedTiers.large,
          provider_id: result.codex.providerId,
          provider_name: result.codex.providerName,
        }
      : undefined,
  });
}

/** Real download filename for the full script, matching the route handlers' `Content-Type` split by OS. */
export function fullScriptFilename(os: string): string {
  return isWindows(os) ? "setup.ps1" : "setup.sh";
}

export const ONE_LINER_FILENAME = "install-command.txt";
export const SETTINGS_JSON_FILENAME = "settings.json";
export const CONFIG_TOML_FILENAME = "config.toml";
export const MODELS_JSON_FILENAME = "models.json";
export const AUTH_JSON_FILENAME = "auth.json";
