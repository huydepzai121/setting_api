## Purpose

Defines the single-page web interface where a user enters endpoint, key and model details and reads back the generated configuration files and install commands, including its states, error handling, persistence and accessibility behaviour.

## ADDED Requirements

### Requirement: Configuration form

The page SHALL present one form with these controls: `base_url` (text), `api_key` (masked text with a reveal toggle), primary model name (text), an advanced toggle revealing per-tier model overrides, a target selector for Claude Code and Codex allowing either or both, an OS selector for POSIX and Windows, and — when Codex is a selected target — `provider_id` and `provider_name`.

#### Scenario: Advanced overrides hidden by default

- **WHEN** the page first loads
- **THEN** the per-tier model override inputs are not displayed
- **AND** the primary model input is displayed

#### Scenario: Advanced overrides revealed

- **WHEN** the user activates the advanced toggle with Claude Code and Codex both selected
- **THEN** override inputs for the haiku, sonnet and opus tiers are displayed under a Claude Code heading
- **AND** override inputs for the small, medium and large tiers are displayed under a Codex heading
- **AND** each is pre-filled with the primary model name

#### Scenario: Subagent tier is a choice, not a text field

- **WHEN** the advanced panel is open with Claude Code selected
- **THEN** a single-choice control offers exactly the haiku, sonnet and opus tiers for subagents
- **AND** sonnet is selected by default
- **AND** no free-text input for a subagent model name is displayed

#### Scenario: Advanced overrides are validated

- **WHEN** the user clears a tier override or enters a value with a disallowed character
- **THEN** that input is marked invalid
- **AND** the result panel stops showing generated output until it is corrected

#### Scenario: Codex identity fields are conditional

- **WHEN** Codex is not among the selected targets
- **THEN** the `provider_id` and `provider_name` inputs are not displayed

#### Scenario: API key is masked by default

- **WHEN** the user types into the API key input
- **THEN** the characters are masked
- **AND** activating the reveal toggle shows them

### Requirement: Result panel

The page SHALL present the generated output as tabs. The available tabs SHALL be `settings.json` when Claude Code is selected; `config.toml`, `models.json` and `auth.json` when Codex is selected; and `One-line install` and `Full script` for each selected target. Every tab SHALL offer a copy action and a download action, with the download using that artifact's real filename.

#### Scenario: Tabs follow the selected targets

- **WHEN** only Claude Code is selected
- **THEN** the `settings.json` tab is present
- **AND** no `config.toml` or `models.json` tab is present

#### Scenario: Download filename

- **WHEN** the user downloads from the `config.toml` tab
- **THEN** the downloaded file is named `config.toml`

#### Scenario: Output follows the OS selector

- **WHEN** the OS selector is changed between POSIX and Windows
- **THEN** the `One-line install` and `Full script` tabs show the script for the newly selected OS

### Requirement: Component states

The page SHALL implement four states: **idle** before the required fields are filled, **invalid** when any field fails validation, **valid** when output is displayed, and **copied** as transient feedback after a copy action.

#### Scenario: Idle state

- **WHEN** the page loads with empty fields
- **THEN** the result panel shows an explanatory empty state instead of output
- **AND** the copy and download actions are disabled

#### Scenario: Valid state

- **WHEN** every required field passes validation
- **THEN** the result panel shows the generated output
- **AND** the copy and download actions are enabled

#### Scenario: Copied feedback

- **WHEN** the user activates a copy action
- **THEN** a confirmation is shown near that action
- **AND** the confirmation is announced to assistive technology

### Requirement: Inline validation errors

Validation errors SHALL be displayed inline beneath the field that caused them, SHALL name what is wrong, and SHALL persist until the field is corrected. The page SHALL NOT navigate away, SHALL NOT open a modal, and SHALL NOT report validation errors through auto-dismissing notifications.

#### Scenario: Invalid base URL

- **WHEN** the user enters `not a url` as `base_url`
- **THEN** an error message appears beneath the `base_url` input
- **AND** the page does not navigate
- **AND** the result panel does not show generated output

#### Scenario: Error clears on correction

- **WHEN** the user corrects an invalid field to a valid value
- **THEN** that field's error message is removed
- **AND** output is regenerated once every field is valid

#### Scenario: Error persists

- **WHEN** an invalid value is left in place for an extended time without further input
- **THEN** the error message is still displayed

### Requirement: Non-secret input persistence

The page SHALL persist `base_url`, the primary model name, per-slot overrides, `provider_id`, `provider_name`, the target selection and the OS selection to `localStorage` and restore them on the next visit. It SHALL NOT persist the API key. When `localStorage` is unavailable or throws, the page SHALL still function with empty defaults.

#### Scenario: Non-secret values restored

- **WHEN** the user fills the form, reloads the page
- **THEN** `base_url`, the model names, the provider fields, the target selection and the OS selection are restored
- **AND** the API key input is empty

#### Scenario: Storage unavailable

- **WHEN** `localStorage` access throws, for example in a private window
- **THEN** the page renders and remains usable with empty defaults
- **AND** no error is surfaced to the user

### Requirement: Accessibility

The page SHALL be operable by keyboard alone, SHALL associate every input with a visible label, SHALL link every inline error to its input so assistive technology announces it, SHALL announce copy confirmations through a live region, SHALL show a visible focus indicator on every interactive element, and SHALL meet WCAG 2.1 AA contrast for text and interactive elements.

#### Scenario: Keyboard-only operation

- **WHEN** the user navigates with the keyboard alone
- **THEN** every input, toggle, tab, copy action and download action can be reached and activated
- **AND** the focused element is visibly indicated

#### Scenario: Error announced

- **WHEN** an inline validation error appears
- **THEN** the input is marked invalid and programmatically associated with the error text

#### Scenario: Copy announced

- **WHEN** a copy action succeeds
- **THEN** the confirmation is placed in a live region so it is announced

#### Scenario: Contrast

- **WHEN** the page is rendered
- **THEN** body text, label text, error text and interactive element boundaries meet the WCAG 2.1 AA contrast minimum

### Requirement: Responsive layout

The page SHALL remain usable down to a 400px viewport width, with the form and result panel stacking into a single column and no horizontal scrolling of the page body.

#### Scenario: Narrow viewport

- **WHEN** the viewport is 400px wide
- **THEN** the form and result panel are stacked in one column
- **AND** the page body does not scroll horizontally
