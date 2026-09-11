import {
  AUTH_JSON_FILENAME,
  AUTH_JSON_TEXT,
  CONFIG_TOML_FILENAME,
  fullScriptFilename,
  MODELS_JSON_FILENAME,
  ONE_LINER_FILENAME,
  SETTINGS_JSON_FILENAME,
  buildConfigTomlText,
  buildFullScriptText,
  buildModelsJsonText,
  buildOneLinerText,
  buildSettingsJsonText,
  type GenerateResult,
  type TargetSelection,
} from "./generate";

type NoteVariant = "muted" | "accent" | "warn" | "danger";

interface TabDef {
  id: string;
  label: string;
  filename: string;
  starred?: boolean;
  content: string;
  note: string;
  noteVariant: NoteVariant;
}

export interface ResultPanelProps {
  result: GenerateResult;
  /** Which targets are currently selected — tab presence follows selection, not validity (spec "Tabs follow the selected targets"). */
  targets: TargetSelection;
  isIdle: boolean;
  os: string;
  origin: string;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  copiedTab: string | null;
  onCopy: (tabId: string, text: string) => void;
  downloadedTab: string | null;
  onDownload: (tabId: string, filename: string, text: string) => void;
}

const noteClassName: Record<NoteVariant, string> = {
  muted: "sk-note",
  accent: "sk-note sk-note--accent",
  warn: "sk-note sk-note--warn",
  danger: "sk-note sk-note--danger",
};

export function ResultPanel({
  result,
  targets,
  isIdle,
  os,
  origin,
  activeTab,
  onActiveTabChange,
  copiedTab,
  onCopy,
  downloadedTab,
  onDownload,
}: ResultPanelProps) {
  const tabs: TabDef[] = [];

  if (targets.claudeCode) {
    tabs.push({
      id: "settings",
      label: "settings.json",
      filename: SETTINGS_JSON_FILENAME,
      content: buildSettingsJsonText(result),
      note: "Merged into ~/.claude/settings.json — every unrelated key is preserved.",
      noteVariant: "muted",
    });
  }

  if (targets.codex) {
    tabs.push({
      id: "toml",
      label: "config.toml",
      filename: CONFIG_TOML_FILENAME,
      content: buildConfigTomlText(result),
      note: "Overwrites ~/.codex/config.toml — the install script backs up the existing file first.",
      noteVariant: "warn",
    });
    tabs.push({
      id: "models",
      label: "models.json",
      filename: MODELS_JSON_FILENAME,
      content: buildModelsJsonText(result),
      note: "Written to ~/.codex/models.json in full — copy and download always deliver the complete file.",
      noteVariant: "muted",
    });
    tabs.push({
      id: "auth",
      label: "auth.json",
      filename: AUTH_JSON_FILENAME,
      content: AUTH_JSON_TEXT,
      note: "Only written when ~/.codex/auth.json is missing or empty — existing login state is preserved otherwise.",
      noteVariant: "muted",
    });
  }

  if (targets.claudeCode || targets.codex) {
    tabs.push({
      id: "script",
      label: "Full script",
      filename: fullScriptFilename(os),
      starred: true,
      content: buildFullScriptText(result, os),
      note: "Recommended — the API key never travels through a URL.",
      noteVariant: "accent",
    });
    tabs.push({
      id: "oneliner",
      label: "One-line install",
      filename: ONE_LINER_FILENAME,
      content: buildOneLinerText(result, os, origin),
      note: "The API key is included in this URL — it can be captured in shell history and by any intermediary.",
      noteVariant: "danger",
    });
  }

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  const active = activeIndex >= 0 ? tabs[activeIndex] : tabs[0];

  const isValid = result.ok;
  const emptyHint = isIdle
    ? "Fill in the endpoint, key and model to see generated output."
    : "Fix the highlighted fields to see generated output.";

  return (
    <div className="sk-panel sk-result-panel">
      <div className="sk-tabs" role="tablist" aria-label="Generated output">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active?.id}
            aria-controls={`tabpanel-${tab.id}`}
            className="sk-tab"
            onClick={() => onActiveTabChange(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.starred ? (
              <span className="sk-tab__star" aria-hidden="true">
                ★
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {active ? (
        <>
          <div className="sk-toolbar">
            <span className={noteClassName[active.noteVariant]}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="6" />
                <path d="M8 7.5v3.5" />
                <path d="M8 5h.01" />
              </svg>
              <span>{isValid ? active.note : "Not enough valid input yet."}</span>
            </span>
            <div className="sk-actions">
              <button
                type="button"
                className={`sk-action-btn${copiedTab === active.id ? " sk-action-btn--active" : ""}`}
                disabled={!isValid}
                onClick={() => onCopy(active.id, active.content)}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                  <path d="M10.5 5.5v-1a1.5 1.5 0 00-1.5-1.5H4a1.5 1.5 0 00-1.5 1.5V9A1.5 1.5 0 004 10.5h1" />
                </svg>
                <span>{copiedTab === active.id ? "Copied" : "Copy"}</span>
              </button>
              <button
                type="button"
                className={`sk-action-btn${downloadedTab === active.id ? " sk-action-btn--active" : ""}`}
                disabled={!isValid}
                onClick={() => onDownload(active.id, active.filename, active.content)}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 2.5v8" />
                  <path d="M4.5 7.5L8 11l3.5-3.5" />
                  <path d="M2.5 13.5h11" />
                </svg>
                <span>{downloadedTab === active.id ? "Downloaded" : active.filename}</span>
              </button>
            </div>
          </div>

          <div
            className="sk-output"
            role="tabpanel"
            id={`tabpanel-${active.id}`}
            aria-labelledby={`tab-${active.id}`}
          >
            {isValid ? (
              <pre className="sk-output__pre">{active.content}</pre>
            ) : (
              <div className="sk-output__empty">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 4h9l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                  <path d="M14 4v5h5" />
                </svg>
                <span>{emptyHint}</span>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
