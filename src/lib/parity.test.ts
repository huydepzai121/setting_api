/**
 * Client/server parity — tasks.md 8.9 and 8.10.
 *
 * This file lives in `src/lib/` (not `src/components/`) specifically so it
 * can sit next to the route handlers under test without claiming ownership
 * of any other file in `src/lib/`; every other file here belongs to
 * earlier batches and is untouched.
 *
 * Two things are proven with real code paths, not by calling the shared
 * generator twice:
 *
 * 1. (8.10) The client-rendered full script
 *    (`src/components/generate.ts#buildFullScriptText`) is byte-identical
 *    to what the matching `/api/setup/*` route handler's exported `GET`
 *    returns for the same resolved input and OS.
 * 2. (8.9) The one-line installer built by `buildOneLinerText` carries
 *    every tier override and the resolved subagent model: the exact URLs
 *    it embeds, fed into the real route handlers, produce output
 *    byte-identical to the corresponding section of the full script.
 */
import { describe, expect, it } from "vitest";
import { GET as claudeCodeGet } from "@/app/api/setup/claudecode/route";
import { GET as codexGet } from "@/app/api/setup/codex/route";
import {
  buildFullScriptText,
  buildOneLinerText,
  computeGenerateResult,
  type GenerateInput,
} from "@/components/generate";

const ORIGIN = "https://setting-key.example";

function sharedFields(): Omit<GenerateInput, "targets" | "os"> {
  return {
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk-ant-router_9f2c4e",
    primaryModel: "claude-sonnet-4-6",
    overrides: {
      haiku: "claude-haiku-4-6",
      opus: "claude-opus-4-6",
      small: "gpt-5-mini",
      large: "gpt-5-pro",
    },
    subagentTier: "opus",
    providerId: "custom-router",
    providerName: "Custom Router",
  };
}

/** Extracts every double-quoted URL from a one-liner command block, in order. */
function extractUrls(oneLiner: string): string[] {
  return [...oneLiner.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

describe.each(["posix", "windows"] as const)("client/server parity — os=%s", (os) => {
  it("full script: Claude-Code-only client render == claudecode route body", async () => {
    const result = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: true, codex: false },
      os,
    });
    expect(result.ok).toBe(true);
    const clientScript = buildFullScriptText(result, os);
    expect(clientScript).not.toBe("");

    const routeUrl = new URL(`${ORIGIN}/api/setup/claudecode`);
    routeUrl.searchParams.set("key", result.apiKey!);
    routeUrl.searchParams.set("base_url", result.baseUrl!);
    routeUrl.searchParams.set("os", os);
    routeUrl.searchParams.set("haiku", result.claudeCode!.resolvedTiers.haiku);
    routeUrl.searchParams.set("sonnet", result.claudeCode!.resolvedTiers.sonnet);
    routeUrl.searchParams.set("opus", result.claudeCode!.resolvedTiers.opus);
    routeUrl.searchParams.set("subagent", result.claudeCode!.subagentModel);

    const response = await claudeCodeGet(new Request(routeUrl));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe(clientScript);
  });

  it("full script: Codex-only client render == codex route body", async () => {
    const result = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: false, codex: true },
      os,
    });
    expect(result.ok).toBe(true);
    const clientScript = buildFullScriptText(result, os);
    expect(clientScript).not.toBe("");

    const routeUrl = new URL(`${ORIGIN}/api/setup/codex`);
    routeUrl.searchParams.set("key", result.apiKey!);
    routeUrl.searchParams.set("base_url", result.baseUrl!);
    routeUrl.searchParams.set("os", os);
    routeUrl.searchParams.set("small", result.codex!.resolvedTiers.small);
    routeUrl.searchParams.set("medium", result.codex!.resolvedTiers.medium);
    routeUrl.searchParams.set("large", result.codex!.resolvedTiers.large);
    routeUrl.searchParams.set("provider_id", result.codex!.providerId);
    routeUrl.searchParams.set("provider_name", result.codex!.providerName);

    const response = await codexGet(new Request(routeUrl));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe(clientScript);
  });

  it("full script: both targets selected == claudecode segment + codex segment, joined by a blank line", async () => {
    const claudeOnly = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: true, codex: false },
      os,
    });
    const codexOnly = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: false, codex: true },
      os,
    });
    const both = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: true, codex: true },
      os,
    });

    const claudeSegment = buildFullScriptText(claudeOnly, os);
    const codexSegment = buildFullScriptText(codexOnly, os);
    const combined = buildFullScriptText(both, os);

    expect(combined).toBe(`${claudeSegment}\n\n${codexSegment}`);
  });

  it("one-liner (8.9): every URL it embeds, fed into the real route handlers, reproduces the full script's per-target section byte-for-byte", async () => {
    const claudeOnly = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: true, codex: false },
      os,
    });
    const codexOnly = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: false, codex: true },
      os,
    });
    const both = computeGenerateResult({
      ...sharedFields(),
      targets: { claudeCode: true, codex: true },
      os,
    });

    const claudeSegment = buildFullScriptText(claudeOnly, os);
    const codexSegment = buildFullScriptText(codexOnly, os);

    const oneLiner = buildOneLinerText(both, os, ORIGIN);
    const urls = extractUrls(oneLiner);
    expect(urls).toHaveLength(2);

    const claudeUrl = urls.find((url) => url.includes("/api/setup/claudecode"));
    const codexUrl = urls.find((url) => url.includes("/api/setup/codex"));
    expect(claudeUrl).toBeDefined();
    expect(codexUrl).toBeDefined();

    // Every tier override plus the resolved subagent model must actually be
    // present in the URL — not just "the request would happen to succeed".
    expect(claudeUrl).toContain(
      `haiku=${encodeURIComponent(both.claudeCode!.resolvedTiers.haiku)}`,
    );
    expect(claudeUrl).toContain(
      `opus=${encodeURIComponent(both.claudeCode!.resolvedTiers.opus)}`,
    );
    expect(claudeUrl).toContain(
      `subagent=${encodeURIComponent(both.claudeCode!.subagentModel)}`,
    );
    expect(codexUrl).toContain(
      `small=${encodeURIComponent(both.codex!.resolvedTiers.small)}`,
    );
    expect(codexUrl).toContain(
      `large=${encodeURIComponent(both.codex!.resolvedTiers.large)}`,
    );
    expect(codexUrl).toContain(
      `provider_id=${encodeURIComponent(both.codex!.providerId)}`,
    );

    const claudeResponse = await claudeCodeGet(new Request(claudeUrl!));
    expect(claudeResponse.status).toBe(200);
    expect(await claudeResponse.text()).toBe(claudeSegment);

    const codexResponse = await codexGet(new Request(codexUrl!));
    expect(codexResponse.status).toBe(200);
    expect(await codexResponse.text()).toBe(codexSegment);
  });
});
