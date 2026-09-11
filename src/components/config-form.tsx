import type { ClaudeCodeModelTier } from "@/lib/validation";
import { CLAUDE_CODE_MODEL_TIERS, CODEX_MODEL_TIERS } from "@/lib/validation";
import { Choice } from "./choice";
import { Field } from "./field";
import { FieldError } from "./field-error";
import type { FieldErrors, OverridesState, TargetSelection, TierId } from "./generate";

export interface ConfigFormProps {
  baseUrl: string;
  apiKey: string;
  primaryModel: string;
  revealKey: boolean;
  targets: TargetSelection;
  os: string;
  advancedOpen: boolean;
  overrides: OverridesState;
  subagentTier: ClaudeCodeModelTier;
  providerId: string | undefined;
  providerName: string | undefined;
  derivedProviderId: string;
  derivedProviderName: string;
  errors: FieldErrors;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onPrimaryModelChange: (value: string) => void;
  onToggleReveal: () => void;
  onToggleTarget: (target: keyof TargetSelection) => void;
  onOsChange: (os: string) => void;
  onToggleAdvanced: () => void;
  onOverrideChange: (tier: TierId, value: string) => void;
  onSubagentTierChange: (tier: ClaudeCodeModelTier) => void;
  onProviderIdChange: (value: string) => void;
  onProviderNameChange: (value: string) => void;
  onBlurField: (field: string) => void;
}

const TIER_LABELS: Record<TierId, string> = {
  haiku: "HAIKU",
  sonnet: "SONNET",
  opus: "OPUS",
  small: "SMALL",
  medium: "MEDIUM",
  large: "LARGE",
};

export function ConfigForm(props: ConfigFormProps) {
  const {
    baseUrl,
    apiKey,
    primaryModel,
    revealKey,
    targets,
    os,
    advancedOpen,
    overrides,
    subagentTier,
    providerId,
    providerName,
    derivedProviderId,
    derivedProviderName,
    errors,
    onBaseUrlChange,
    onApiKeyChange,
    onPrimaryModelChange,
    onToggleReveal,
    onToggleTarget,
    onOsChange,
    onToggleAdvanced,
    onOverrideChange,
    onSubagentTierChange,
    onProviderIdChange,
    onProviderNameChange,
    onBlurField,
  } = props;

  const onlyOneTargetEnabled =
    Number(targets.claudeCode) + Number(targets.codex) === 1;
  const slotCount =
    (targets.claudeCode ? CLAUDE_CODE_MODEL_TIERS.length : 0) +
    (targets.codex ? CODEX_MODEL_TIERS.length : 0);

  return (
    <div className="sk-form-panel">
      <Field label="Base URL" htmlFor="base-url" error={errors.base_url} errorId="base-url-error">
        <input
          id="base-url"
          className="sk-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://api.example.com"
          value={baseUrl}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          onBlur={() => onBlurField("base_url")}
          aria-invalid={errors.base_url ? true : undefined}
          aria-describedby={errors.base_url ? "base-url-error" : undefined}
        />
      </Field>

      <Field
        label="API Key"
        htmlFor="api-key"
        error={errors.api_key}
        errorId="api-key-error"
        headerExtra={
          <button
            type="button"
            className="sk-reveal-btn"
            onClick={onToggleReveal}
            aria-pressed={revealKey}
          >
            {revealKey ? "Hide" : "Reveal"}
          </button>
        }
      >
        <input
          id="api-key"
          className="sk-input"
          type={revealKey ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          onBlur={() => onBlurField("api_key")}
          aria-invalid={errors.api_key ? true : undefined}
          aria-describedby={errors.api_key ? "api-key-error" : undefined}
        />
      </Field>

      <Field label="Primary model" htmlFor="primary-model" error={errors.model} errorId="model-error">
        <input
          id="primary-model"
          className="sk-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="claude-sonnet-4-6"
          value={primaryModel}
          onChange={(event) => onPrimaryModelChange(event.target.value)}
          onBlur={() => onBlurField("model")}
          aria-invalid={errors.model ? true : undefined}
          aria-describedby={errors.model ? "model-error" : undefined}
        />
      </Field>

      <hr className="sk-divider" />

      <div className="sk-target-row">
        <span className="sk-section-label" id="target-selector-label">
          Configure for
        </span>
        <div
          className="sk-choice-group sk-choice-group--full"
          role="group"
          aria-labelledby="target-selector-label"
        >
          <Choice
            type="checkbox"
            id="target-claude-code"
            checked={targets.claudeCode}
            onChange={() => onToggleTarget("claudeCode")}
            describedBy={
              targets.claudeCode && onlyOneTargetEnabled
                ? "target-lock-hint"
                : undefined
            }
            label={<span>Claude Code</span>}
          />
          <Choice
            type="checkbox"
            id="target-codex"
            checked={targets.codex}
            onChange={() => onToggleTarget("codex")}
            describedBy={
              targets.codex && onlyOneTargetEnabled
                ? "target-lock-hint"
                : undefined
            }
            label={<span>Codex</span>}
          />
        </div>
        {onlyOneTargetEnabled ? (
          <span id="target-lock-hint" className="sk-target-hint">
            At least one target must stay selected.
          </span>
        ) : null}
      </div>

      <div className="sk-target-row">
        <span className="sk-section-label" id="os-selector-label">
          Operating system
        </span>
        <div
          className="sk-choice-group sk-choice-group--split"
          role="group"
          aria-labelledby="os-selector-label"
        >
          <Choice
            type="radio"
            name="os"
            id="os-posix"
            checked={os === "posix"}
            onChange={() => onOsChange("posix")}
            label={<span>macOS / Linux</span>}
          />
          <Choice
            type="radio"
            name="os"
            id="os-windows"
            checked={os === "windows"}
            onChange={() => onOsChange("windows")}
            label={<span>Windows</span>}
          />
        </div>
      </div>

      {targets.codex ? (
        <div className="sk-field">
          <div className="sk-provider-row">
            <Field
              label="Provider ID"
              htmlFor="provider-id"
              error={errors.provider_id}
              errorId="provider-id-error"
            >
              <input
                id="provider-id"
                className="sk-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={derivedProviderId}
                value={providerId ?? derivedProviderId}
                onChange={(event) => onProviderIdChange(event.target.value)}
                onBlur={() => onBlurField("provider_id")}
                aria-invalid={errors.provider_id ? true : undefined}
                aria-describedby={
                  errors.provider_id ? "provider-id-error" : undefined
                }
              />
            </Field>
            <Field label="Provider name" htmlFor="provider-name" errorId="provider-name-error">
              <input
                id="provider-name"
                className="sk-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={derivedProviderName}
                value={providerName ?? derivedProviderName}
                onChange={(event) => onProviderNameChange(event.target.value)}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <hr className="sk-divider" />

      <button
        type="button"
        className="sk-advanced-toggle"
        aria-expanded={advancedOpen}
        aria-controls="advanced-panel"
        onClick={onToggleAdvanced}
      >
        <span className="sk-advanced-toggle__label">
          <svg
            className="sk-advanced-toggle__caret"
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3.5L10.5 8L6 12.5" />
          </svg>
          <span>Set a model per tier</span>
        </span>
        <span className="sk-advanced-toggle__count">{slotCount} tiers</span>
      </button>

      {advancedOpen ? (
        <div id="advanced-panel" className="sk-advanced-panel">
          {targets.claudeCode ? (
            <div className="sk-tier-group">
              <span className="sk-tier-group__title">CLAUDE CODE</span>
              <div className="sk-tier-grid">
                {CLAUDE_CODE_MODEL_TIERS.map((tier) => (
                  <div className="sk-tier-field" key={tier}>
                    <label htmlFor={`slot-${tier}`} className="sk-tier-field__label">
                      {TIER_LABELS[tier]}
                    </label>
                    <input
                      id={`slot-${tier}`}
                      className="sk-input"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={overrides[tier] ?? primaryModel}
                      onChange={(event) => onOverrideChange(tier, event.target.value)}
                      onBlur={() => onBlurField(tier)}
                      aria-invalid={errors[tier] ? true : undefined}
                      aria-describedby={errors[tier] ? `${tier}-error` : undefined}
                    />
                    <FieldError id={`${tier}-error`} message={errors[tier]} />
                  </div>
                ))}
              </div>
              <div className="sk-subagent-row" role="group" aria-labelledby="subagent-tier-label">
                <span id="subagent-tier-label" className="sk-hint">
                  Subagent uses tier
                </span>
                <div className="sk-choice-group sk-choice-group--split">
                  {CLAUDE_CODE_MODEL_TIERS.map((tier) => (
                    <Choice
                      key={tier}
                      type="radio"
                      name="subagent-tier"
                      id={`subagent-${tier}`}
                      checked={subagentTier === tier}
                      onChange={() => onSubagentTierChange(tier)}
                      className="sk-choice--sm"
                      label={<span>{tier}</span>}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {targets.codex ? (
            <div className="sk-tier-group">
              <span className="sk-tier-group__title">CODEX</span>
              <div className="sk-tier-grid">
                {CODEX_MODEL_TIERS.map((tier) => (
                  <div className="sk-tier-field" key={tier}>
                    <label htmlFor={`slot-${tier}`} className="sk-tier-field__label">
                      {TIER_LABELS[tier]}
                    </label>
                    <input
                      id={`slot-${tier}`}
                      className="sk-input"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={overrides[tier] ?? primaryModel}
                      onChange={(event) => onOverrideChange(tier, event.target.value)}
                      onBlur={() => onBlurField(tier)}
                      aria-invalid={errors[tier] ? true : undefined}
                      aria-describedby={errors[tier] ? `${tier}-error` : undefined}
                    />
                    <FieldError id={`${tier}-error`} message={errors[tier]} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
