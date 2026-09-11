import { describe, expect, it } from "vitest";
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
} from "@/lib/validation";

describe("validateApiKey", () => {
  it("accepts a valid key", () => {
    const result = validateApiKey("sk-ant_api03.abc-123:xyz");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("sk-ant_api03.abc-123:xyz");
    }
  });

  it.each([
    ["a space", "sk ant"],
    ["a single quote", "sk'ant"],
    ["a double quote", 'sk"ant'],
    ["a dollar sign", "sk$ant"],
    ["a backtick", "sk`ant"],
    ["a semicolon", "sk;ant"],
    ["a pipe", "sk|ant"],
    ["an ampersand", "sk&ant"],
    ["a backslash", "sk\\ant"],
    ["a newline", "sk\nant"],
  ])("rejects a key containing %s, naming the key field", (_label, key) => {
    const result = validateApiKey(key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("api_key");
    }
  });

  it("rejects an empty key, naming the key field", () => {
    const result = validateApiKey("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("api_key");
    }
  });

  it("rejects a 301-character key", () => {
    const key = "a".repeat(301);
    const result = validateApiKey(key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("api_key");
    }
  });

  it("accepts a 300-character key (boundary)", () => {
    const key = "a".repeat(300);
    const result = validateApiKey(key);
    expect(result.ok).toBe(true);
  });

  it("does not sanitise: a key with a stripped-then-valid remainder is still rejected outright", () => {
    // A sanitising implementation would strip the apostrophe and accept
    // "skant". This implementation must reject the whole value instead —
    // there is no code path that returns a modified/cleaned key.
    const result = validateApiKey("sk'ant");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The rejection must not carry a "cleaned" value anywhere.
      expect(Object.prototype.hasOwnProperty.call(result, "value")).toBe(
        false,
      );
    }
  });
});

describe("validateModelName", () => {
  it("accepts a valid model name", () => {
    const result = validateModelName("claude-sonnet-4-6");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("claude-sonnet-4-6");
    }
  });

  it("rejects a model name containing a space, naming the field", () => {
    const result = validateModelName("my model", "primary_model");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("primary_model");
    }
  });

  it("rejects an empty primary model, naming the field", () => {
    const result = validateModelName("", "primary_model");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("primary_model");
    }
  });
});

describe("normalizeBaseUrl", () => {
  it("removes a single trailing slash", () => {
    const result = normalizeBaseUrl("https://api.example.com/");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("https://api.example.com");
    }
  });

  it("removes multiple trailing slashes", () => {
    const result = normalizeBaseUrl("https://api.example.com/v1///");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("https://api.example.com/v1");
    }
  });

  it.each(["file:///etc/passwd", "ftp://example.com"])(
    "rejects the %s scheme, naming the field",
    (url) => {
      const result = normalizeBaseUrl(url);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.field).toBe("base_url");
      }
    },
  );

  it("rejects an unparsable value, naming the field", () => {
    const result = normalizeBaseUrl("not a url");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("base_url");
    }
  });
});

describe("deriveProviderId / deriveProviderName", () => {
  it("derives provider id and name from a base_url hostname", () => {
    const url = new URL("https://api.example.com:8080/v1");
    expect(deriveProviderId(url.hostname)).toBe("api-example-com");
    expect(deriveProviderName(url.hostname)).toBe("api.example.com");
  });

  it("falls back to a non-empty slug for an all-punctuation hostname", () => {
    // A hostname with no [a-z0-9] characters at all (e.g. an IPv6 literal
    // consisting only of colons) slugifies to an empty string, which is
    // not a legal TOML bare key. The derivation must not return "".
    expect(deriveProviderId("::")).toBe("provider");
    expect(deriveProviderId("...---...")).toBe("provider");
  });
});

describe("validateProviderId", () => {
  it("accepts a hostname-derived provider id", () => {
    const result = validateProviderId(
      deriveProviderId(new URL("https://api.example.com:8080/v1").hostname),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("api-example-com");
    }
  });

  it("rejects an invalid provider id, naming the field", () => {
    const result = validateProviderId("My Router!");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("provider_id");
    }
  });
});

describe("resolveModelTiers", () => {
  it("fills every tier from the primary model when no overrides are given", () => {
    const resolved = resolveModelTiers(
      CLAUDE_CODE_MODEL_TIERS,
      "claude-sonnet-4-6",
    );
    expect(resolved).toEqual({
      haiku: "claude-sonnet-4-6",
      sonnet: "claude-sonnet-4-6",
      opus: "claude-sonnet-4-6",
    });
  });

  it("applies partial overrides, leaving unset tiers on the primary model", () => {
    const resolved = resolveModelTiers(
      CLAUDE_CODE_MODEL_TIERS,
      "claude-sonnet-4-6",
      { opus: "claude-opus-4-1" },
    );
    expect(resolved).toEqual({
      haiku: "claude-sonnet-4-6",
      sonnet: "claude-sonnet-4-6",
      opus: "claude-opus-4-1",
    });
  });

  it("resolves Codex's three tiers the same way", () => {
    const resolved = resolveModelTiers(CODEX_MODEL_TIERS, "gpt-5-codex", {
      small: "gpt-5-codex-mini",
    });
    expect(resolved).toEqual({
      small: "gpt-5-codex-mini",
      medium: "gpt-5-codex",
      large: "gpt-5-codex",
    });
  });

  it("carries an explicitly cleared tier override through as an empty string", () => {
    // resolveModelTiers itself does not reject; validateResolvedTiers does.
    // This is what lets a "cleared" override (key present, value "") be
    // distinguished from an "unset" one (key absent).
    const resolved = resolveModelTiers(
      CLAUDE_CODE_MODEL_TIERS,
      "claude-sonnet-4-6",
      { sonnet: "" },
    );
    expect(resolved.sonnet).toBe("");
    expect(resolved.haiku).toBe("claude-sonnet-4-6");
  });
});

describe("validateResolvedTiers", () => {
  it("accepts a fully resolved, valid tier map", () => {
    const resolved = resolveModelTiers(
      CLAUDE_CODE_MODEL_TIERS,
      "claude-sonnet-4-6",
      { opus: "claude-opus-4-1" },
    );
    const result = validateResolvedTiers(resolved, CLAUDE_CODE_MODEL_TIERS);
    expect(result.ok).toBe(true);
  });

  it("rejects a cleared tier override instead of letting it reach a config file", () => {
    const resolved = resolveModelTiers(
      CLAUDE_CODE_MODEL_TIERS,
      "claude-sonnet-4-6",
      { sonnet: "" },
    );
    const result = validateResolvedTiers(resolved, CLAUDE_CODE_MODEL_TIERS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("sonnet");
    }
  });

  it("rejects a malformed tier override, naming that tier", () => {
    const resolved = resolveModelTiers(
      CLAUDE_CODE_MODEL_TIERS,
      "claude-sonnet-4-6",
      { haiku: "not a model" },
    );
    const result = validateResolvedTiers(resolved, CLAUDE_CODE_MODEL_TIERS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("haiku");
    }
  });
});

describe("resolveSubagentModel", () => {
  const resolved = resolveModelTiers(CLAUDE_CODE_MODEL_TIERS, "primary-model", {
    haiku: "haiku-model",
    sonnet: "sonnet-model",
    opus: "opus-model",
  });

  it.each<[ClaudeCodeModelTier, string]>([
    ["haiku", "haiku-model"],
    ["sonnet", "sonnet-model"],
    ["opus", "opus-model"],
  ])("resolves the %s subagent tier to its resolved model", (tier, expected) => {
    expect(resolveSubagentModel(resolved, tier)).toBe(expected);
  });

  it("defaults to the sonnet tier when none is specified", () => {
    expect(resolveSubagentModel(resolved)).toBe("sonnet-model");
  });
});
