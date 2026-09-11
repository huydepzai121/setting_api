/**
 * `localStorage` persistence for the non-secret form fields (design.md D9;
 * specs/cli-config/web-ui, "Non-secret input persistence").
 *
 * `PersistedFormState` has no `apiKey` / `api_key` field — that is what
 * keeps the key out of storage, not a runtime check. `toPersistedPayload`
 * builds its return value as a fresh object literal naming exactly the
 * allowed fields, so even if a caller passes in a wider object that also
 * carries `apiKey` (e.g. the live form state), that field is never copied
 * into what gets persisted. Every localStorage access is wrapped in
 * try/catch so a throwing or absent store (private browsing, disabled
 * storage, SSR) degrades to defaults and is never surfaced to the user.
 */

import type {
  ClaudeCodeModelTier,
  CodexModelTier,
} from "@/lib/validation";
import type { OverridesState, TargetSelection } from "./generate";

const STORAGE_KEY = "setting-key:form:v1";

const TIER_KEYS: readonly (ClaudeCodeModelTier | CodexModelTier)[] = [
  "haiku",
  "sonnet",
  "opus",
  "small",
  "medium",
  "large",
];

/** Exactly the fields the spec lists as persisted. No key, ever. */
export interface PersistedFormState {
  baseUrl: string;
  primaryModel: string;
  overrides: OverridesState;
  providerId: string | undefined;
  providerName: string | undefined;
  targets: TargetSelection;
  os: string;
}

/** Minimal storage shape so tests can inject a fake (including one that throws). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_PERSISTED_STATE: PersistedFormState = {
  baseUrl: "",
  primaryModel: "",
  overrides: {},
  providerId: undefined,
  providerName: undefined,
  targets: { claudeCode: true, codex: true },
  os: "posix",
};

function getBrowserStorage(): StorageLike | undefined {
  try {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sanitizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sanitizeOverrides(value: unknown): OverridesState {
  if (!isPlainObject(value)) {
    return {};
  }
  const out: OverridesState = {};
  for (const key of TIER_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      out[key] = candidate;
    }
  }
  return out;
}

function sanitizeTargets(value: unknown): TargetSelection {
  if (!isPlainObject(value)) {
    return { claudeCode: true, codex: true };
  }
  return {
    claudeCode:
      typeof value.claudeCode === "boolean" ? value.claudeCode : true,
    codex: typeof value.codex === "boolean" ? value.codex : true,
  };
}

/**
 * Loads the persisted, non-secret form state, degrading to
 * {@link DEFAULT_PERSISTED_STATE} whenever storage is unavailable, throws,
 * holds unparsable JSON, or holds a shape that isn't a plain object (spec
 * "Storage unavailable"). `storage` is injectable so tests can exercise a
 * throwing store without touching the real `localStorage`.
 */
export function loadPersistedState(
  storage: StorageLike | undefined = getBrowserStorage(),
): PersistedFormState {
  try {
    if (!storage) {
      return DEFAULT_PERSISTED_STATE;
    }
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PERSISTED_STATE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return DEFAULT_PERSISTED_STATE;
    }
    return {
      baseUrl: sanitizeString(parsed.baseUrl),
      primaryModel: sanitizeString(parsed.primaryModel),
      overrides: sanitizeOverrides(parsed.overrides),
      providerId: sanitizeOptionalString(parsed.providerId),
      providerName: sanitizeOptionalString(parsed.providerName),
      targets: sanitizeTargets(parsed.targets),
      os: sanitizeString(parsed.os, "posix") === "windows" ? "windows" : "posix",
    };
  } catch {
    return DEFAULT_PERSISTED_STATE;
  }
}

/**
 * Persists exactly {@link PersistedFormState}'s fields. Callers MUST build
 * `state` with {@link toPersistedPayload} rather than a hand-built object,
 * so the key can never reach this call by construction.
 */
export function savePersistedState(
  state: PersistedFormState,
  storage: StorageLike | undefined = getBrowserStorage(),
): void {
  try {
    if (!storage) {
      return;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable, throwing, or over quota: degrade silently, per
    // spec "Storage unavailable" — never surfaced to the user.
  }
}

/**
 * Narrows a full live-form-shaped object down to exactly
 * {@link PersistedFormState}'s fields. This is the sole place that decides
 * what gets persisted: the return statement below names every field
 * explicitly, so a caller passing in a wider object that also carries
 * `apiKey` (the live form state does) can never leak it into the returned
 * object — there is no spread of the input here.
 */
export function toPersistedPayload(state: {
  baseUrl: string;
  primaryModel: string;
  overrides: OverridesState;
  providerId: string | undefined;
  providerName: string | undefined;
  targets: TargetSelection;
  os: string;
}): PersistedFormState {
  return {
    baseUrl: state.baseUrl,
    primaryModel: state.primaryModel,
    overrides: { ...state.overrides },
    providerId: state.providerId,
    providerName: state.providerName,
    targets: { ...state.targets },
    os: state.os,
  };
}
