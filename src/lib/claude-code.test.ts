import { describe, expect, it } from "vitest";
import {
  CLAUDE_CODE_MODEL_TIERS,
  resolveModelTiers,
  resolveSubagentModel,
  validateResolvedTiers,
  type ClaudeCodeModelTier,
} from "@/lib/validation";
import { buildClaudeSettings, mergeClaudeSettings } from "@/lib/claude-code";

/** Resolves and validates tiers the way every real caller must. */
function resolveAndValidateTiers(
  primaryModel: string,
  overrides?: Partial<Record<ClaudeCodeModelTier, string | undefined>>,
) {
  const resolved = resolveModelTiers(
    CLAUDE_CODE_MODEL_TIERS,
    primaryModel,
    overrides,
  );
  const result = validateResolvedTiers(resolved, CLAUDE_CODE_MODEL_TIERS);
  if (!result.ok) {
    throw new Error(`unexpected invalid tiers: ${result.field}`);
  }
  return result.value;
}

describe("buildClaudeSettings", () => {
  it("produces exactly the specified top-level and env key sets", () => {
    const resolvedTiers = resolveAndValidateTiers("my-model-v1");
    const settings = buildClaudeSettings({
      baseUrl: "https://api.example.com",
      apiKey: "sk-test_123",
      resolvedTiers,
      subagentModel: resolveSubagentModel(resolvedTiers),
    });

    expect(Object.keys(settings).sort()).toEqual(
      ["disableLoginPrompt", "env", "includeCoAuthoredBy"].sort(),
    );
    expect(Object.keys(settings.env).sort()).toEqual(
      [
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        "ANTHROPIC_DEFAULT_OPUS_MODEL",
        "ANTHROPIC_DEFAULT_SONNET_MODEL",
        "CLAUDE_CODE_SUBAGENT_MODEL",
      ].sort(),
    );
    expect(settings.disableLoginPrompt).toBe(true);
    expect(settings.includeCoAuthoredBy).toBe(false);
  });

  it("carries base_url and api_key values verbatim", () => {
    const resolvedTiers = resolveAndValidateTiers("my-model-v1");
    const settings = buildClaudeSettings({
      baseUrl: "https://api.example.com",
      apiKey: "sk-test_123",
      resolvedTiers,
      subagentModel: resolveSubagentModel(resolvedTiers),
    });

    expect(settings.env.ANTHROPIC_BASE_URL).toBe("https://api.example.com");
    expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test_123");
  });

  it("resolves every tier to the primary model when no overrides are supplied", () => {
    const resolvedTiers = resolveAndValidateTiers("my-model-v1");
    const settings = buildClaudeSettings({
      baseUrl: "https://api.example.com",
      apiKey: "sk-test_123",
      resolvedTiers,
      subagentModel: resolveSubagentModel(resolvedTiers),
    });

    expect(settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("my-model-v1");
    expect(settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("my-model-v1");
    expect(settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("my-model-v1");
  });

  it("applies a partial override to only the overridden tier", () => {
    const resolvedTiers = resolveAndValidateTiers("my-model-v1", {
      opus: "my-model-big",
    });
    const settings = buildClaudeSettings({
      baseUrl: "https://api.example.com",
      apiKey: "sk-test_123",
      resolvedTiers,
      subagentModel: resolveSubagentModel(resolvedTiers),
    });

    expect(settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe("my-model-big");
    expect(settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe("my-model-v1");
    expect(settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("my-model-v1");
  });

  it.each(CLAUDE_CODE_MODEL_TIERS)(
    "sets CLAUDE_CODE_SUBAGENT_MODEL identical to the %s tier's resolved value when selected",
    (tier) => {
      const resolvedTiers = resolveAndValidateTiers("my-model-v1", {
        haiku: "my-model-fast",
        sonnet: "my-model-mid",
        opus: "my-model-big",
      });
      const subagentModel = resolveSubagentModel(resolvedTiers, tier);
      const settings = buildClaudeSettings({
        baseUrl: "https://api.example.com",
        apiKey: "sk-test_123",
        resolvedTiers,
        subagentModel,
      });

      const ownerKey = {
        haiku: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        sonnet: "ANTHROPIC_DEFAULT_SONNET_MODEL",
        opus: "ANTHROPIC_DEFAULT_OPUS_MODEL",
      } as const;

      expect(settings.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe(
        resolvedTiers[tier],
      );
      expect(settings.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe(
        settings.env[ownerKey[tier]],
      );
    },
  );

  it("defaults the subagent tier to sonnet", () => {
    const resolvedTiers = resolveAndValidateTiers("my-model-v1", {
      haiku: "my-model-fast",
      sonnet: "my-model-mid",
      opus: "my-model-big",
    });
    const subagentModel = resolveSubagentModel(resolvedTiers);
    const settings = buildClaudeSettings({
      baseUrl: "https://api.example.com",
      apiKey: "sk-test_123",
      resolvedTiers,
      subagentModel,
    });

    expect(settings.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe("my-model-mid");
    expect(settings.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe(
      settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    );
  });
});

describe("mergeClaudeSettings", () => {
  function generatedSettings() {
    const resolvedTiers = resolveAndValidateTiers("my-model-v1", {
      opus: "my-model-big",
    });
    return buildClaudeSettings({
      baseUrl: "https://api.example.com",
      apiKey: "sk-new-key",
      resolvedTiers,
      subagentModel: resolveSubagentModel(resolvedTiers),
    });
  }

  it("preserves unrelated top-level keys and adds the generated ones", () => {
    const existing = {
      permissions: { allow: ["Bash"] },
      model: "x",
    };
    const merged = mergeClaudeSettings(existing, generatedSettings());

    expect(merged.permissions).toEqual({ allow: ["Bash"] });
    expect(merged.model).toBe("x");
    expect(merged.disableLoginPrompt).toBe(true);
    expect(merged.includeCoAuthoredBy).toBe(false);
    expect(merged.env).toBeDefined();
  });

  it("preserves unrelated env entries while overwriting the six owned keys", () => {
    const existing = {
      env: {
        SOME_OTHER_VAR: "keep-me",
        ANTHROPIC_BASE_URL: "https://old.example.com",
      },
    };
    const generated = generatedSettings();
    const merged = mergeClaudeSettings(existing, generated);
    const env = merged.env as Record<string, unknown>;

    expect(env.SOME_OTHER_VAR).toBe("keep-me");
    expect(env.ANTHROPIC_BASE_URL).toBe(generated.env.ANTHROPIC_BASE_URL);
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe(generated.env.ANTHROPIC_AUTH_TOKEN);
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(
      generated.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    );
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe(
      generated.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
    );
    expect(env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe(
      generated.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    );
    expect(env.CLAUDE_CODE_SUBAGENT_MODEL).toBe(
      generated.env.CLAUDE_CODE_SUBAGENT_MODEL,
    );
  });

  it("preserves both unrelated top-level keys and unrelated env entries together (spec scenario shape)", () => {
    const existing = {
      permissions: { allow: ["Bash"] },
      model: "x",
      env: { SOME_OTHER_VAR: "keep-me" },
    };
    const generated = generatedSettings();
    const merged = mergeClaudeSettings(existing, generated);
    const env = merged.env as Record<string, unknown>;

    expect(merged.permissions).toEqual({ allow: ["Bash"] });
    expect(merged.model).toBe("x");
    expect(env.SOME_OTHER_VAR).toBe("keep-me");
    expect(env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe(
      generated.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    );
  });

  it("produces only the generated keys when there is no existing settings object", () => {
    const merged = mergeClaudeSettings(undefined, generatedSettings());
    expect(Object.keys(merged).sort()).toEqual(
      ["disableLoginPrompt", "env", "includeCoAuthoredBy"].sort(),
    );
  });

  it.each([
    ["null", null],
    ["an array", ["not", "an", "object"]],
    ["a string", "not json"],
    ["a number", 42],
  ])(
    "falls back to a fresh document instead of throwing when existing is %s",
    (_label, existing) => {
      const generated = generatedSettings();
      let merged: Record<string, unknown> | undefined;
      expect(() => {
        merged = mergeClaudeSettings(existing, generated);
      }).not.toThrow();
      expect(Object.keys(merged as Record<string, unknown>).sort()).toEqual(
        ["disableLoginPrompt", "env", "includeCoAuthoredBy"].sort(),
      );
      expect((merged as Record<string, unknown>).env).toEqual(
        generated.env,
      );
    },
  );

  it("falls back to a fresh env object when existing.env is not a plain object", () => {
    const existing = { env: "not an object", model: "keep-me" };
    const generated = generatedSettings();
    const merged = mergeClaudeSettings(existing, generated);

    expect(merged.model).toBe("keep-me");
    expect(merged.env).toEqual(generated.env);
  });
});
