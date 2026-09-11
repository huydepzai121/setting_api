import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import {
  CODEX_MODEL_TIERS,
  deriveProviderId,
  resolveModelTiers,
  validateProviderId,
  validateResolvedTiers,
  type CodexModelTier,
} from "@/lib/validation";
import { buildCodexConfigToml, buildCodexModelsJson } from "@/lib/codex";

/** Resolves and validates tiers the way every real caller must. */
function resolveAndValidateTiers(
  primaryModel: string,
  overrides?: Partial<Record<CodexModelTier, string | undefined>>,
) {
  const resolved = resolveModelTiers(CODEX_MODEL_TIERS, primaryModel, overrides);
  const result = validateResolvedTiers(resolved, CODEX_MODEL_TIERS);
  if (!result.ok) {
    throw new Error(`unexpected invalid tiers: ${result.field}`);
  }
  return result.value;
}

describe("buildCodexConfigToml", () => {
  it("parses as TOML with a provider table of exactly the four specified keys", () => {
    const resolvedTiers = resolveAndValidateTiers("gpt-5.1-router");
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test_123",
      providerId: "example-com",
      providerName: "Example Router",
      resolvedTiers,
    });

    const parsed = parseToml(toml) as Record<string, unknown>;
    const providers = parsed.model_providers as Record<string, unknown>;
    const table = providers["example-com"] as Record<string, unknown>;

    expect(Object.keys(table).sort()).toEqual(
      ["base_url", "experimental_bearer_token", "name", "wire_api"].sort(),
    );
  });

  it("sets wire_api to responses", () => {
    const resolvedTiers = resolveAndValidateTiers("m1");
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com",
      apiKey: "sk-key",
      providerId: "example-com",
      providerName: "Example",
      resolvedTiers,
    });
    const parsed = parseToml(toml) as {
      model_providers: Record<string, { wire_api: string }>;
    };
    expect(parsed.model_providers["example-com"].wire_api).toBe("responses");
  });

  it("sets model to the medium tier value", () => {
    const resolvedTiers = resolveAndValidateTiers("primary-model", {
      medium: "medium-only-model",
    });
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com",
      apiKey: "sk-key",
      providerId: "example-com",
      providerName: "Example",
      resolvedTiers,
    });
    const parsed = parseToml(toml) as { model: string };
    expect(parsed.model).toBe("medium-only-model");
    expect(parsed.model).toBe(resolvedTiers.medium);
  });

  it("sets model_provider, model_catalog_json and features.apps exactly", () => {
    const resolvedTiers = resolveAndValidateTiers("m1");
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com",
      apiKey: "sk-key",
      providerId: "myrouter",
      providerName: "My Router",
      resolvedTiers,
    });
    const parsed = parseToml(toml) as {
      model_provider: string;
      model_catalog_json: string;
      features: { apps: boolean };
    };
    expect(parsed.model_provider).toBe("myrouter");
    expect(parsed.model_catalog_json).toBe("~/.codex/models.json");
    expect(Object.keys(parsed.features)).toEqual(["apps"]);
    expect(parsed.features.apps).toBe(false);
  });

  it("produces exactly the specified top-level key set", () => {
    const resolvedTiers = resolveAndValidateTiers("m1");
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com",
      apiKey: "sk-key",
      providerId: "example-com",
      providerName: "Example",
      resolvedTiers,
    });
    const parsed = parseToml(toml) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "model",
        "model_provider",
        "model_catalog_json",
        "model_providers",
        "features",
      ].sort(),
    );
  });

  it("carries base_url, name and the api key into the provider table verbatim", () => {
    const resolvedTiers = resolveAndValidateTiers("m1");
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test_123",
      providerId: "example-com",
      providerName: "Example Router",
      resolvedTiers,
    });
    const parsed = parseToml(toml) as {
      model_providers: Record<
        string,
        { name: string; base_url: string; experimental_bearer_token: string }
      >;
    };
    const table = parsed.model_providers["example-com"];
    expect(table.name).toBe("Example Router");
    expect(table.base_url).toBe("https://api.example.com/v1");
    expect(table.experimental_bearer_token).toBe("sk-test_123");
  });

  it("still parses when provider_name contains quotes and backslashes", () => {
    const resolvedTiers = resolveAndValidateTiers("m1");
    const trickyName = 'Weird "Router" \\ Name';
    const toml = buildCodexConfigToml({
      baseUrl: "https://api.example.com",
      apiKey: "sk-key",
      providerId: "example-com",
      providerName: trickyName,
      resolvedTiers,
    });
    const parsed = parseToml(toml) as {
      model_providers: Record<string, { name: string }>;
    };
    expect(parsed.model_providers["example-com"].name).toBe(trickyName);
  });

  it("derives a valid provider id from a hostname and accepts it", () => {
    const hostname = "api.example.com";
    const derived = deriveProviderId(hostname);
    expect(derived).toBe("api-example-com");
    const validated = validateProviderId(derived);
    expect(validated.ok).toBe(true);
  });

  it("rejects an invalid provider id before it reaches config generation", () => {
    const result = validateProviderId("My Router!");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("provider_id");
    }
  });
});

describe("buildCodexModelsJson", () => {
  it("parses as JSON with three slugs in order", () => {
    const resolvedTiers = resolveAndValidateTiers("primary", {
      small: "m-s",
      medium: "m-m",
      large: "m-l",
    });
    const json = buildCodexModelsJson({ resolvedTiers });
    const parsed = JSON.parse(json) as {
      models: Array<{ slug: string }>;
    };

    expect(parsed.models).toHaveLength(3);
    expect(parsed.models.map((m) => m.slug)).toEqual(["m-s", "m-m", "m-l"]);
  });

  it("still produces three entries when every tier resolves to the same model", () => {
    const resolvedTiers = resolveAndValidateTiers("shared-model");
    const json = buildCodexModelsJson({ resolvedTiers });
    const parsed = JSON.parse(json) as {
      models: Array<{ slug: string }>;
    };

    expect(parsed.models).toHaveLength(3);
    expect(parsed.models.every((m) => m.slug === "shared-model")).toBe(true);
  });

  it("exposes low/medium/high/xhigh reasoning levels on every entry", () => {
    const resolvedTiers = resolveAndValidateTiers("primary", {
      small: "m-s",
      medium: "m-m",
      large: "m-l",
    });
    const json = buildCodexModelsJson({ resolvedTiers });
    const parsed = JSON.parse(json) as {
      models: Array<{
        supported_reasoning_levels: Array<{ effort: string }>;
      }>;
    };

    for (const model of parsed.models) {
      const efforts = model.supported_reasoning_levels.map((r) => r.effort);
      expect(efforts.sort()).toEqual(["high", "low", "medium", "xhigh"].sort());
    }
  });

  it("sets display_name and the model name inside description to the slot's model name", () => {
    const resolvedTiers = resolveAndValidateTiers("primary", {
      small: "m-s",
      medium: "m-m",
      large: "m-l",
    });
    const json = buildCodexModelsJson({ resolvedTiers });
    const parsed = JSON.parse(json) as {
      models: Array<{ slug: string; display_name: string; description: string }>;
    };

    for (const model of parsed.models) {
      expect(model.display_name).toBe(model.slug);
      expect(model.description).toContain(model.slug);
    }
  });

  it("preserves the Codex-defined schema fields exactly as ported", () => {
    const resolvedTiers = resolveAndValidateTiers("m1");
    const json = buildCodexModelsJson({ resolvedTiers });
    const parsed = JSON.parse(json) as {
      models: Array<Record<string, unknown>>;
    };

    for (const model of parsed.models) {
      expect(model.context_window).toBe(400000);
      expect(model.truncation_policy).toEqual({
        mode: "tokens",
        limit: 400000,
      });
      expect(model.effective_context_window_percent).toBe(95);
      expect(model.input_modalities).toEqual(["text", "image"]);
    }
  });

  it("rejects malformed JSON if the substituted model name were to break structure", () => {
    // Model names are restricted to [A-Za-z0-9._:-] by validateModelName,
    // so a real caller can never pass a quote or backslash here — but this
    // asserts the substitution mechanism does not corrupt JSON structure
    // for a value drawn from that charset, including punctuation chars.
    const resolvedTiers = resolveAndValidateTiers("m1.2:3-4_5");
    const json = buildCodexModelsJson({ resolvedTiers });
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
