import { describe, expect, it } from "vitest";
import {
  AUTH_JSON_TEXT,
  buildConfigTomlText,
  buildFullScriptText,
  buildModelsJsonText,
  buildOneLinerText,
  buildSettingsJsonText,
  computeGenerateResult,
  fullScriptFilename,
  type GenerateInput,
} from "./generate";

function baseInput(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    baseUrl: "https://api.example.com",
    apiKey: "sk-ant-test_123",
    primaryModel: "claude-sonnet-4-6",
    targets: { claudeCode: true, codex: true },
    os: "posix",
    overrides: {},
    subagentTier: "sonnet",
    providerId: undefined,
    providerName: undefined,
    ...overrides,
  };
}

describe("computeGenerateResult", () => {
  it("resolves both targets from just a primary model when both are selected", () => {
    const result = computeGenerateResult(baseInput());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.claudeCode?.resolvedTiers).toEqual({
      haiku: "claude-sonnet-4-6",
      sonnet: "claude-sonnet-4-6",
      opus: "claude-sonnet-4-6",
    });
    expect(result.claudeCode?.subagentModel).toBe("claude-sonnet-4-6");
    expect(result.codex?.resolvedTiers).toEqual({
      small: "claude-sonnet-4-6",
      medium: "claude-sonnet-4-6",
      large: "claude-sonnet-4-6",
    });
    expect(result.codex?.providerId).toBe("api-example-com");
    expect(result.codex?.providerName).toBe("api.example.com");
  });

  it("rejects a cleared tier override, naming that tier, and blocks output", () => {
    const result = computeGenerateResult(
      baseInput({ overrides: { sonnet: "" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.sonnet).toMatch(/sonnet/);
    expect(result.errors.model).toBeUndefined();
    expect(buildSettingsJsonText(result)).toBe("");
    expect(buildFullScriptText(result, "posix")).toBe("");
  });

  it("rejects a malformed tier override (disallowed character)", () => {
    const result = computeGenerateResult(
      baseInput({ overrides: { opus: "my model" } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.opus).toMatch(/opus/);
  });

  it("does not attribute an untouched tier's failure to the tier field", () => {
    // Primary model empty, no overrides: every tier resolves to "" and
    // fails, but that should surface once under `model`, not under every
    // tier name (the user never touched haiku/sonnet/opus/small/medium/large).
    const result = computeGenerateResult(baseInput({ primaryModel: "" }));
    expect(result.ok).toBe(false);
    expect(result.errors.model).toBeTruthy();
    expect(result.errors.haiku).toBeUndefined();
    expect(result.errors.sonnet).toBeUndefined();
    expect(result.errors.opus).toBeUndefined();
    expect(result.errors.small).toBeUndefined();
  });

  it("rejects an invalid provider_id and blocks codex output only", () => {
    const result = computeGenerateResult(
      baseInput({ providerId: "Bad ID" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.provider_id).toMatch(/provider_id/);
    expect(buildConfigTomlText(result)).toBe("");
  });

  it("requires at least one target", () => {
    const result = computeGenerateResult(
      baseInput({ targets: { claudeCode: false, codex: false } }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.targets).toBeTruthy();
  });

  it("writes the resolved subagent tier's model, not a free-text value", () => {
    const result = computeGenerateResult(
      baseInput({
        overrides: { haiku: "haiku-model", opus: "opus-model" },
        subagentTier: "opus",
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.claudeCode?.subagentModel).toBe("opus-model");
    const settings = JSON.parse(buildSettingsJsonText(result));
    expect(settings.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe("opus-model");
  });

  it("codex-only: no ANTHROPIC_ vars in the script, one-liner is a single line", () => {
    const result = computeGenerateResult(
      baseInput({ targets: { claudeCode: false, codex: true } }),
    );
    expect(result.ok).toBe(true);
    const script = buildFullScriptText(result, "posix");
    expect(script).not.toContain("ANTHROPIC_");
    expect(buildSettingsJsonText(result)).toBe("");
    expect(buildConfigTomlText(result)).not.toBe("");

    const oneLiner = buildOneLinerText(result, "posix", "https://setting-key.example");
    const lines = oneLiner.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("/api/setup/codex?");
  });

  it("claude-code-only: config.toml/models.json are empty, settings.json is not", () => {
    const result = computeGenerateResult(
      baseInput({ targets: { claudeCode: true, codex: false } }),
    );
    expect(result.ok).toBe(true);
    expect(buildConfigTomlText(result)).toBe("");
    expect(buildModelsJsonText(result)).toBe("");
    expect(buildSettingsJsonText(result)).not.toBe("");
  });

  it("auth.json content is the literal empty-object write, regardless of target", () => {
    expect(AUTH_JSON_TEXT).toBe("{}\n");
  });

  it("full script filename follows the OS", () => {
    expect(fullScriptFilename("posix")).toBe("setup.sh");
    expect(fullScriptFilename("windows")).toBe("setup.ps1");
  });
});
