"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SUBAGENT_TIER,
  deriveProviderId,
  deriveProviderName,
  normalizeBaseUrl,
  type ClaudeCodeModelTier,
} from "@/lib/validation";
import { ConfigForm } from "./config-form";
import {
  computeGenerateResult,
  type FieldErrors,
  type OverridesState,
  type TargetSelection,
  type TierId,
} from "./generate";
import { ResultPanel } from "./result-panel";
import { loadPersistedState, savePersistedState, toPersistedPayload } from "./storage";

interface FormState {
  baseUrl: string;
  apiKey: string;
  primaryModel: string;
  targets: TargetSelection;
  os: string;
  overrides: OverridesState;
  subagentTier: ClaudeCodeModelTier;
  providerId: string | undefined;
  providerName: string | undefined;
  revealKey: boolean;
  advancedOpen: boolean;
  touched: Record<string, boolean>;
  activeTab: string;
}

/** Field names whose "empty" error should stay quiet until the user has interacted with that field (spec: Idle vs Invalid state). */
const GATED_FIELDS = new Set(["base_url", "api_key", "model", "provider_id"]);

/**
 * The stateful form + result panel. Rendered only after the page has
 * mounted on the client (see `src/app/page.tsx`), so reading
 * `localStorage` / `window.location.origin` in these lazy initializers is
 * safe: this component is never part of the server-rendered or
 * hydration-matching output, so there is nothing for it to mismatch.
 */
export function Generator() {
  const [form, setForm] = useState<FormState>(() => {
    const persisted = loadPersistedState();
    return {
      baseUrl: persisted.baseUrl,
      apiKey: "",
      primaryModel: persisted.primaryModel,
      targets: persisted.targets,
      os: persisted.os,
      overrides: persisted.overrides,
      subagentTier: DEFAULT_SUBAGENT_TIER,
      providerId: persisted.providerId,
      providerName: persisted.providerName,
      revealKey: false,
      advancedOpen: false,
      touched: {},
      activeTab: "script",
    };
  });
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [downloadedTab, setDownloadedTab] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist every non-secret change (design.md D9). `apiKey` never appears
  // in `toPersistedPayload`'s return value, by construction — see
  // src/components/storage.ts.
  useEffect(() => {
    savePersistedState(
      toPersistedPayload({
        baseUrl: form.baseUrl,
        primaryModel: form.primaryModel,
        overrides: form.overrides,
        providerId: form.providerId,
        providerName: form.providerName,
        targets: form.targets,
        os: form.os,
      }),
    );
  }, [
    form.baseUrl,
    form.primaryModel,
    form.overrides,
    form.providerId,
    form.providerName,
    form.targets,
    form.os,
  ]);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      if (downloadTimer.current) {
        clearTimeout(downloadTimer.current);
      }
    },
    [],
  );

  const result = useMemo(
    () =>
      computeGenerateResult({
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        primaryModel: form.primaryModel,
        targets: form.targets,
        os: form.os,
        overrides: form.overrides,
        subagentTier: form.subagentTier,
        providerId: form.providerId,
        providerName: form.providerName,
      }),
    [
      form.baseUrl,
      form.apiKey,
      form.primaryModel,
      form.targets,
      form.os,
      form.overrides,
      form.subagentTier,
      form.providerId,
      form.providerName,
    ],
  );

  const derivedProviderId = useMemo(() => {
    const normalized = normalizeBaseUrl(form.baseUrl);
    const hostname = normalized.ok ? new URL(normalized.value).hostname : "";
    return deriveProviderId(hostname);
  }, [form.baseUrl]);

  const derivedProviderName = useMemo(() => {
    const normalized = normalizeBaseUrl(form.baseUrl);
    const hostname = normalized.ok ? new URL(normalized.value).hostname : "";
    return deriveProviderName(hostname);
  }, [form.baseUrl]);

  const isIdle =
    form.baseUrl === "" && form.apiKey === "" && form.primaryModel === "";

  // Top-level required fields only surface their "empty"/invalid error once
  // the user has interacted with them (spec: Idle state on first load has
  // no visible errors). Per-tier override errors are already gated inside
  // computeGenerateResult (only reported when the user actually overrode
  // that tier), so they are shown unconditionally here.
  const visibleErrors: FieldErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [field, message] of Object.entries(result.errors)) {
      if (field === "targets") {
        continue; // structurally unreachable: the toggle refuses to clear the last target.
      }
      if (GATED_FIELDS.has(field)) {
        if (form.touched[field]) {
          out[field] = message;
        }
      } else {
        out[field] = message;
      }
    }
    return out;
  }, [result.errors, form.touched]);

  function handleBaseUrlChange(value: string) {
    // Changing the endpoint re-derives provider_id/provider_name from the
    // new hostname unless the user re-enters a manual override afterwards
    // (design.md D6).
    setForm((prev) => ({
      ...prev,
      baseUrl: value,
      providerId: undefined,
      providerName: undefined,
    }));
  }

  function handleToggleTarget(target: keyof TargetSelection) {
    setForm((prev) => {
      const nextTargets = { ...prev.targets, [target]: !prev.targets[target] };
      const enabledCount = Number(nextTargets.claudeCode) + Number(nextTargets.codex);
      if (enabledCount === 0) {
        return prev; // the last enabled target cannot be turned off.
      }
      return { ...prev, targets: nextTargets };
    });
  }

  function handleOverrideChange(tier: TierId, value: string) {
    setForm((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [tier]: value },
    }));
  }

  function handleBlurField(field: string) {
    setForm((prev) =>
      prev.touched[field]
        ? prev
        : { ...prev, touched: { ...prev.touched, [field]: true } },
    );
  }

  async function handleCopy(tabId: string, text: string) {
    if (!text) {
      return;
    }
    const succeeded = await copyToClipboard(text);
    if (!succeeded) {
      return;
    }
    setCopiedTab(tabId);
    setLiveMessage(`Copied ${tabId === "oneliner" ? "the one-line install command" : tabId} to the clipboard.`);
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopiedTab(null), 2000);
  }

  function handleDownload(tabId: string, filename: string, text: string) {
    if (!text || typeof document === "undefined") {
      return;
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedTab(tabId);
    setLiveMessage(`Downloaded ${filename}.`);
    if (downloadTimer.current) {
      clearTimeout(downloadTimer.current);
    }
    downloadTimer.current = setTimeout(() => setDownloadedTab(null), 2000);
  }

  return (
    <div className="sk-main">
      <div className="sk-intro">
        <h1>Point Claude Code and Codex at your endpoint</h1>
        <p>
          Enter your endpoint, key and model names. Get back the exact
          configuration files — nothing touches shell startup files or
          system environment variables.
        </p>
      </div>

      <div className="sk-layout">
        <ConfigForm
          baseUrl={form.baseUrl}
          apiKey={form.apiKey}
          primaryModel={form.primaryModel}
          revealKey={form.revealKey}
          targets={form.targets}
          os={form.os}
          advancedOpen={form.advancedOpen}
          overrides={form.overrides}
          subagentTier={form.subagentTier}
          providerId={form.providerId}
          providerName={form.providerName}
          derivedProviderId={derivedProviderId}
          derivedProviderName={derivedProviderName}
          errors={visibleErrors}
          onBaseUrlChange={handleBaseUrlChange}
          onApiKeyChange={(value) => setForm((prev) => ({ ...prev, apiKey: value }))}
          onPrimaryModelChange={(value) =>
            setForm((prev) => ({ ...prev, primaryModel: value }))
          }
          onToggleReveal={() =>
            setForm((prev) => ({ ...prev, revealKey: !prev.revealKey }))
          }
          onToggleTarget={handleToggleTarget}
          onOsChange={(os) => setForm((prev) => ({ ...prev, os }))}
          onToggleAdvanced={() =>
            setForm((prev) => ({ ...prev, advancedOpen: !prev.advancedOpen }))
          }
          onOverrideChange={handleOverrideChange}
          onSubagentTierChange={(tier) =>
            setForm((prev) => ({ ...prev, subagentTier: tier }))
          }
          onProviderIdChange={(value) =>
            setForm((prev) => ({ ...prev, providerId: value }))
          }
          onProviderNameChange={(value) =>
            setForm((prev) => ({ ...prev, providerName: value }))
          }
          onBlurField={handleBlurField}
        />

        <ResultPanel
          result={result}
          targets={form.targets}
          isIdle={isIdle}
          os={form.os}
          origin={origin}
          activeTab={form.activeTab}
          onActiveTabChange={(tab) =>
            setForm((prev) => ({ ...prev, activeTab: tab }))
          }
          copiedTab={copiedTab}
          onCopy={handleCopy}
          downloadedTab={downloadedTab}
          onDownload={handleDownload}
        />
      </div>

      <div className="sk-footer-note">
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#56D98A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 2l5.5 3v4c0 3-2.3 5.2-5.5 6-3.2-.8-5.5-3-5.5-6V5z" />
          <path d="M5.8 8.2l1.6 1.6L10.4 6.8" />
        </svg>
        <span>
          The script only writes inside <code>~/.claude</code> and{" "}
          <code>~/.codex</code>. It backs up existing files before changing
          them, and never touches <code>.bashrc</code>, <code>.zshrc</code>{" "}
          or a system environment variable.
        </span>
      </div>

      <div aria-live="polite" className="sk-sr-only">
        {liveMessage}
      </div>
    </div>
  );
}

/** Copies `text` to the clipboard, falling back to a legacy selection-based copy. Returns whether it succeeded. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}
