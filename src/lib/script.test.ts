import { describe, expect, it } from "vitest";
import {
  CLAUDE_CODE_MODEL_TIERS,
  CODEX_MODEL_TIERS,
  resolveModelTiers,
  resolveSubagentModel,
  validateResolvedTiers,
  type ClaudeCodeModelTier,
  type CodexModelTier,
} from "@/lib/validation";
import {
  ALL_SCRIPT_TEMPLATES,
  buildClaudeCodeOneLinerUrl,
  buildCodexOneLinerUrl,
  buildCombinedOneLiner,
  buildOneLinerCommand,
  isWindows,
  renderClaudeCodeScript,
  renderCodexScript,
  renderCombinedScript,
  renderScript,
} from "@/lib/script";

/** Resolves and validates Claude Code tiers the way every real caller must. */
function resolveClaudeCodeTiers(
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

/** Resolves and validates Codex tiers the way every real caller must. */
function resolveCodexTiers(
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

function sampleClaudeCodeInput(os?: string) {
  const resolvedTiers = resolveClaudeCodeTiers("primary-model", {
    opus: "opus-override",
  });
  return {
    os,
    endpointUrl: "https://api.example.com/v1",
    apiKey: "sk-test_key-123",
    resolvedTiers,
    subagentModel: resolveSubagentModel(resolvedTiers, "opus"),
  };
}

function sampleCodexInput(os?: string) {
  const resolvedTiers = resolveCodexTiers("primary-model", {
    large: "large-override",
  });
  return {
    os,
    endpointUrl: "https://api.example.com/v1",
    apiKey: "sk-test_key-456",
    resolvedTiers,
    providerId: "example-com",
    providerName: "Example Router",
  };
}

describe("isWindows", () => {
  it.each(["Windows", "win", "WIN", "windows", "Win"])(
    "selects Windows for %s",
    (os) => {
      expect(isWindows(os)).toBe(true);
    },
  );

  it.each(["linux", "macos", "some-unknown-value", undefined])(
    "selects POSIX for %s",
    (os) => {
      expect(isWindows(os)).toBe(false);
    },
  );
});

describe("renderScript", () => {
  it("substitutes every {{VAR}} placeholder with the matching value", () => {
    const out = renderScript("hello {{NAME}}, bye {{NAME}}", { NAME: "world" });
    expect(out).toBe("hello world, bye world");
  });

  it("throws when the template references a placeholder missing from vars", () => {
    expect(() => renderScript("{{MISSING}}", {})).toThrow(/MISSING/);
  });

  it("is not vulnerable to $&-style replacement-pattern corruption", () => {
    // A plain `template.replace(regex, stringValue)` call would interpret
    // "$&", "$'", "$`" and "$1" inside a *string* replacement. A value
    // containing them must appear in the output completely unchanged.
    const dangerous = "$& $` $' $1 end";
    const out = renderScript("value={{V}}", { V: dangerous });
    expect(out).toBe(`value=${dangerous}`);
  });
});

describe("renderClaudeCodeScript", () => {
  it("renders the POSIX template with every supplied value present", () => {
    const input = sampleClaudeCodeInput("linux");
    const out = renderClaudeCodeScript(input);
    expect(out).toContain(input.endpointUrl);
    expect(out).toContain(input.apiKey);
    expect(out).toContain(input.resolvedTiers.haiku);
    expect(out).toContain(input.resolvedTiers.sonnet);
    expect(out).toContain(input.resolvedTiers.opus);
    expect(out).toContain(input.subagentModel);
    expect(out).toContain("#!/bin/sh");
  });

  it("renders the Windows template when os is win", () => {
    const input = sampleClaudeCodeInput("win");
    const out = renderClaudeCodeScript(input);
    expect(out).toContain(input.endpointUrl);
    expect(out).toContain(input.apiKey);
    expect(out).toContain('$ErrorActionPreference = "Stop"');
  });

  it("leaves no unreplaced {{...}} placeholder", () => {
    expect(renderClaudeCodeScript(sampleClaudeCodeInput("linux"))).not.toMatch(
      /\{\{[A-Z_]+\}\}/,
    );
    expect(renderClaudeCodeScript(sampleClaudeCodeInput("windows"))).not.toMatch(
      /\{\{[A-Z_]+\}\}/,
    );
  });
});

describe("renderCodexScript", () => {
  it("renders the POSIX template with every supplied value present, including the models.json catalog", () => {
    const input = sampleCodexInput("macos");
    const out = renderCodexScript(input);
    expect(out).toContain(input.endpointUrl);
    expect(out).toContain(input.apiKey);
    expect(out).toContain(input.resolvedTiers.small);
    expect(out).toContain(input.resolvedTiers.medium);
    expect(out).toContain(input.resolvedTiers.large);
    expect(out).toContain(input.providerId);
    expect(out).toContain(input.providerName);
    // The rendered models.json catalog is pasted in as literal text.
    expect(out).toContain(`"slug": "${input.resolvedTiers.small}"`);
  });

  it("renders the Windows template when os is WIN", () => {
    const input = sampleCodexInput("WIN");
    const out = renderCodexScript(input);
    expect(out).toContain(input.providerId);
    expect(out).toContain('$ErrorActionPreference = "Stop"');
  });

  it("leaves no unreplaced {{...}} placeholder, including {{MODELS_JSON}}", () => {
    expect(renderCodexScript(sampleCodexInput("linux"))).not.toMatch(
      /\{\{[A-Z_]+\}\}/,
    );
    expect(renderCodexScript(sampleCodexInput("windows"))).not.toMatch(
      /\{\{[A-Z_]+\}\}/,
    );
  });

  it("is not vulnerable to a $-bearing provider_name", () => {
    const input = sampleCodexInput("linux");
    const out = renderCodexScript({
      ...input,
      providerName: "My $& Router $1",
    });
    expect(out).toContain('PROVIDER_NAME="My $& Router $1"');
  });
});

describe("ALL_SCRIPT_TEMPLATES leftover-placeholder check", () => {
  it("has no unreplaced {{...}} placeholder in any template once rendered", () => {
    const claudeCodePosix = renderClaudeCodeScript(sampleClaudeCodeInput("linux"));
    const claudeCodeWindows = renderClaudeCodeScript(
      sampleClaudeCodeInput("windows"),
    );
    const codexPosix = renderCodexScript(sampleCodexInput("linux"));
    const codexWindows = renderCodexScript(sampleCodexInput("windows"));
    // The interactive CLI template is rendered by its route handler rather
    // than by a render* helper here; its one placeholder is the origin.
    const cliPosix = renderScript(ALL_SCRIPT_TEMPLATES["cli-posix.sh.tpl"], {
      ORIGIN: "https://setting.example.com",
    });
    const cliWindows = renderScript(
      ALL_SCRIPT_TEMPLATES["cli-windows.ps1.tpl"],
      { ORIGIN: "https://setting.example.com" },
    );

    const rendered = {
      "claudecode-posix.sh.tpl": claudeCodePosix,
      "claudecode-windows.ps1.tpl": claudeCodeWindows,
      "codex-posix.sh.tpl": codexPosix,
      "codex-windows.ps1.tpl": codexWindows,
      "cli-posix.sh.tpl": cliPosix,
      "cli-windows.ps1.tpl": cliWindows,
    };

    // Sanity: this test must actually exercise every template this
    // module owns, not silently drop one if a name is renamed.
    expect(Object.keys(rendered).sort()).toEqual(
      Object.keys(ALL_SCRIPT_TEMPLATES).sort(),
    );

    for (const [name, body] of Object.entries(rendered)) {
      expect(body, `${name} left an unreplaced placeholder`).not.toMatch(
        /\{\{[A-Z_]+\}\}/,
      );
    }
  });
});

describe("renderCombinedScript", () => {
  it("composes both target scripts when both are selected", () => {
    const claudeCode = sampleClaudeCodeInput();
    const codex = sampleCodexInput();
    const out = renderCombinedScript({
      os: "linux",
      claudeCode,
      codex,
    });
    expect(out).toContain("Claude Code Setup");
    expect(out).toContain("Codex CLI Setup");
    expect(out).toContain(claudeCode.apiKey);
    expect(out).toContain(codex.apiKey);
  });

  it("a deselected Codex target contributes nothing", () => {
    const claudeCode = sampleClaudeCodeInput();
    const out = renderCombinedScript({ os: "linux", claudeCode });
    expect(out).toContain("Claude Code Setup");
    expect(out).not.toContain("Codex CLI Setup");
    expect(out).not.toContain("PROVIDER_ID");
  });

  it("a deselected Claude Code target contributes nothing", () => {
    const codex = sampleCodexInput();
    const out = renderCombinedScript({ os: "linux", codex });
    expect(out).not.toContain("Claude Code Setup");
    expect(out).toContain("Codex CLI Setup");
    expect(out).not.toContain("ANTHROPIC_BASE_URL");
  });

  it("both deselected produces an empty script", () => {
    expect(renderCombinedScript({ os: "linux" })).toBe("");
  });
});

describe("one-liner URL builders", () => {
  it("Claude Code one-liner carries every tier override plus the resolved subagent model", () => {
    const url = buildClaudeCodeOneLinerUrl("https://setting.example", {
      key: "sk-abc-123",
      base_url: "https://api.example.com",
      os: "linux",
      haiku: "haiku-override",
      sonnet: "sonnet-override",
      opus: "opus-override",
      subagent: "opus-override",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://setting.example");
    expect(parsed.pathname).toBe("/api/setup/claudecode");
    expect(parsed.searchParams.get("key")).toBe("sk-abc-123");
    expect(parsed.searchParams.get("base_url")).toBe("https://api.example.com");
    expect(parsed.searchParams.get("os")).toBe("linux");
    expect(parsed.searchParams.get("haiku")).toBe("haiku-override");
    expect(parsed.searchParams.get("sonnet")).toBe("sonnet-override");
    expect(parsed.searchParams.get("opus")).toBe("opus-override");
    expect(parsed.searchParams.get("subagent")).toBe("opus-override");
  });

  it("Codex one-liner carries every tier override plus provider_id/provider_name", () => {
    const url = buildCodexOneLinerUrl("https://setting.example", {
      key: "sk-abc-123",
      base_url: "https://api.example.com",
      os: "windows",
      small: "small-override",
      medium: "medium-override",
      large: "large-override",
      provider_id: "example-com",
      provider_name: "Example Router",
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/api/setup/codex");
    expect(parsed.searchParams.get("small")).toBe("small-override");
    expect(parsed.searchParams.get("medium")).toBe("medium-override");
    expect(parsed.searchParams.get("large")).toBe("large-override");
    expect(parsed.searchParams.get("provider_id")).toBe("example-com");
    expect(parsed.searchParams.get("provider_name")).toBe("Example Router");
  });
});

describe("buildOneLinerCommand", () => {
  it("wraps a POSIX URL in curl | sh", () => {
    expect(buildOneLinerCommand("https://x/y", "linux")).toBe(
      'curl -fsSL "https://x/y" | sh',
    );
  });

  it("wraps a Windows URL in irm | iex", () => {
    expect(buildOneLinerCommand("https://x/y", "windows")).toBe(
      'irm "https://x/y" | iex',
    );
  });
});

describe("buildCombinedOneLiner", () => {
  const claudeCode = {
    key: "sk-cc-key",
    base_url: "https://api.example.com",
    haiku: "haiku-m",
    sonnet: "sonnet-m",
    opus: "opus-m",
    subagent: "opus-m",
  };
  const codex = {
    key: "sk-codex-key",
    base_url: "https://api.example.com",
    small: "small-m",
    medium: "medium-m",
    large: "large-m",
    provider_id: "example-com",
    provider_name: "Example",
  };

  it("emits one command per selected target", () => {
    const out = buildCombinedOneLiner({
      origin: "https://setting.example",
      os: "linux",
      claudeCode,
      codex,
    });
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("/api/setup/claudecode");
    expect(lines[0]).toContain("subagent=opus-m");
    expect(lines[1]).toContain("/api/setup/codex");
    expect(lines[1]).toContain("provider_id=example-com");
  });

  it("a deselected target contributes nothing to the one-liner", () => {
    const out = buildCombinedOneLiner({
      origin: "https://setting.example",
      os: "linux",
      codex,
    });
    expect(out).not.toContain("/api/setup/claudecode");
    expect(out).toContain("/api/setup/codex");
  });
});
