/**
 * Pure validation and derivation functions shared by the browser UI and the
 * `/api/setup/*` route handlers.
 *
 * These functions reject invalid input rather than repairing it. The
 * accepted charset for keys and model names is deliberately narrow
 * (`[A-Za-z0-9._:-]`) because generated POSIX scripts embed these values
 * inside a single-quoted shell literal (`API_KEY='{{API_KEY}}'`); a value
 * drawn from this charset can never contain `'`, which is what keeps that
 * literal injection-safe. Do not widen the charset without also revisiting
 * every place a validated value is embedded into a script, TOML or JSON
 * body.
 *
 * No I/O, no React, no Next.js imports — this module must stay usable from
 * both a browser bundle and a Node route handler with byte-identical
 * results.
 */

/** Model tier identifiers across both supported CLI targets. */
export type ClaudeCodeModelTier = "haiku" | "sonnet" | "opus";
export type CodexModelTier = "small" | "medium" | "large";

export const CLAUDE_CODE_MODEL_TIERS: readonly ClaudeCodeModelTier[] = [
  "haiku",
  "sonnet",
  "opus",
];

export const CODEX_MODEL_TIERS: readonly CodexModelTier[] = [
  "small",
  "medium",
  "large",
];

/** Default subagent tier when the user has not chosen one. */
export const DEFAULT_SUBAGENT_TIER: ClaudeCodeModelTier = "sonnet";

const MAX_KEY_LENGTH = 300;

/** Charset shared by API keys and model names: ASCII alnum plus `-`, `_`, `.`, `:`. */
const ALLOWED_CHARSET_PATTERN = /^[A-Za-z0-9._:-]+$/;

/** Grammar for a Codex `provider_id`, which is embedded as a bare TOML key. */
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/**
 * Result of a validation. On failure, `field` names the offending field so
 * every caller (form, route handler, generator) can report a precise error
 * instead of a generic one.
 */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function fail<T>(field: string, message: string): ValidationResult<T> {
  return { ok: false, field, message };
}

/**
 * Validates an API key: non-empty, at most 300 characters, and composed
 * entirely of `[A-Za-z0-9._:-]`. Rejects rather than strips — see module
 * header.
 */
export function validateApiKey(
  key: string,
  field = "api_key",
): ValidationResult<string> {
  if (key.length === 0) {
    return fail(field, `${field} must not be empty`);
  }
  if (key.length > MAX_KEY_LENGTH) {
    return fail(
      field,
      `${field} must be at most ${MAX_KEY_LENGTH} characters`,
    );
  }
  if (!ALLOWED_CHARSET_PATTERN.test(key)) {
    return fail(
      field,
      `${field} may only contain letters, digits, '.', '_', ':' and '-'`,
    );
  }
  return ok(key);
}

/**
 * Validates a model name: non-empty and composed entirely of
 * `[A-Za-z0-9._:-]`. Rejects rather than filters — see module header.
 */
export function validateModelName(
  model: string,
  field = "model",
): ValidationResult<string> {
  if (model.length === 0) {
    return fail(field, `${field} must not be empty`);
  }
  if (!ALLOWED_CHARSET_PATTERN.test(model)) {
    return fail(
      field,
      `${field} may only contain letters, digits, '.', '_', ':' and '-'`,
    );
  }
  return ok(model);
}

/**
 * Parses and normalizes a `base_url`: must parse as an absolute URL with
 * scheme `http:` or `https:`. Every trailing `/` is stripped from the
 * result.
 */
export function normalizeBaseUrl(
  baseUrl: string,
  field = "base_url",
): ValidationResult<string> {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return fail(field, `${field} must be a valid absolute URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fail(field, `${field} must use the http or https scheme`);
  }
  const href = parsed.toString();
  const stripped = href.replace(/\/+$/, "");
  return ok(stripped);
}

/**
 * Derives a default Codex `provider_id` from a `base_url` hostname:
 * lowercase, every run of non-`[a-z0-9]` characters becomes a single `-`,
 * then leading/trailing `-` is trimmed.
 *
 * A hostname consisting only of characters outside `[a-z0-9]` (for example
 * an IPv6 literal made up solely of colons) would otherwise slugify to an
 * empty string, which is not a legal TOML bare key. Rather than emit `""`
 * and let it fail deep inside config generation, this function falls back
 * to the literal `provider` in that case so a `provider_id` is always a
 * valid, non-empty slug.
 */
export function deriveProviderId(hostname: string): string {
  const slug = hostname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "provider";
}

/** Derives a default Codex `provider_name` from a `base_url` hostname (verbatim). */
export function deriveProviderName(hostname: string): string {
  return hostname;
}

/**
 * Validates a user-supplied (or derived) `provider_id` against the TOML
 * bare-key grammar `^[a-z0-9][a-z0-9_-]*$`.
 */
export function validateProviderId(
  providerId: string,
  field = "provider_id",
): ValidationResult<string> {
  if (!PROVIDER_ID_PATTERN.test(providerId)) {
    return fail(
      field,
      `${field} must match ^[a-z0-9][a-z0-9_-]*$`,
    );
  }
  return ok(providerId);
}

/** Partial per-tier overrides, keyed by tier name, value possibly absent/empty. */
export type TierOverrides<Tier extends string> = Partial<
  Record<Tier, string | undefined>
>;

/** Fully resolved per-tier model names, one entry per tier. */
export type ResolvedTiers<Tier extends string> = Record<Tier, string>;

/**
 * Resolves every model tier from a primary model plus optional per-tier
 * overrides.
 *
 * A tier whose override key is absent (`undefined`, i.e. genuinely unset —
 * the caller never supplied it, as with a route handler query parameter
 * that was not passed) falls back to the primary model. A tier whose
 * override key IS present resolves to that value verbatim, including an
 * empty string.
 *
 * This distinction matters: the UI pre-fills every advanced tier override
 * with the primary model (tasks.md 8.1), so a present-but-empty override
 * only occurs when the user has deliberately cleared a pre-filled field.
 * That is a validation error, not a request to fall back — resolving it to
 * the primary model here would silently discard the user's clear action.
 * {@link validateResolvedTiers} (2.6) is what turns that empty string into
 * a rejection naming the offending tier, so it never reaches a config
 * file.
 */
export function resolveModelTiers<Tier extends string>(
  tiers: readonly Tier[],
  primaryModel: string,
  overrides: TierOverrides<Tier> = {},
): ResolvedTiers<Tier> {
  const resolved = {} as ResolvedTiers<Tier>;
  for (const tier of tiers) {
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, tier);
    const override = overrides[tier];
    resolved[tier] = hasOverride ? (override ?? "") : primaryModel;
  }
  return resolved;
}

/**
 * Validates every resolved tier's model name with {@link validateModelName},
 * naming the offending tier's field (e.g. `sonnet`) on failure. Returns the
 * first failure encountered, or the fully resolved and validated tier map.
 */
export function validateResolvedTiers<Tier extends string>(
  resolved: ResolvedTiers<Tier>,
  tiers: readonly Tier[],
): ValidationResult<ResolvedTiers<Tier>> {
  for (const tier of tiers) {
    const result = validateModelName(resolved[tier], tier);
    if (!result.ok) {
      return result;
    }
  }
  return ok(resolved);
}

/**
 * Returns the resolved model for the selected subagent tier.
 * `CLAUDE_CODE_SUBAGENT_MODEL` is not a free-text fourth model — it is a
 * pointer to one of the three Claude Code tiers (design.md D5), so this
 * simply looks up that tier's already-resolved value.
 */
export function resolveSubagentModel(
  resolvedTiers: ResolvedTiers<ClaudeCodeModelTier>,
  subagentTier: ClaudeCodeModelTier = DEFAULT_SUBAGENT_TIER,
): string {
  return resolvedTiers[subagentTier];
}
