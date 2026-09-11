## Purpose

Defines the `~/.codex/config.toml`, `~/.codex/models.json` and `~/.codex/auth.json` content produced for the Codex CLI from a user-supplied endpoint, API key, model names and provider identity, plus the install rules that keep existing authentication state intact.

## ADDED Requirements

### Requirement: Codex config.toml content

The system SHALL produce a `config.toml` with top-level keys `model`, `model_provider` and `model_catalog_json`, a `[model_providers.<provider_id>]` table containing `name`, `base_url`, `experimental_bearer_token` and `wire_api`, and a `[features]` table containing `apps`. `model` SHALL be the medium model slot, `model_provider` SHALL be the provider id, `model_catalog_json` SHALL be `~/.codex/models.json`, `wire_api` SHALL be `responses`, and `apps` SHALL be `false`.

#### Scenario: Generated TOML shape

- **WHEN** the generator runs with provider id `example-com`, a valid `base_url`, `api_key` and three model slots
- **THEN** the output parses as TOML
- **AND** it contains a `model_providers.example-com` table with exactly the keys `name`, `base_url`, `experimental_bearer_token` and `wire_api`
- **AND** `wire_api` is `responses`
- **AND** `model_provider` is `example-com` and `model` equals the medium slot value
- **AND** `model_catalog_json` is `~/.codex/models.json`
- **AND** `features.apps` is `false`

### Requirement: User-supplied provider identity

The system SHALL accept a `provider_id` and a `provider_name` from the user rather than hard-coding a single router identity. When the user supplies neither, `provider_id` SHALL default to the `base_url` hostname lowercased with every character outside `[a-z0-9]` replaced by `-`, and `provider_name` SHALL default to the `base_url` hostname. A user-supplied `provider_id` SHALL match `^[a-z0-9][a-z0-9_-]*$` and SHALL be rejected otherwise.

#### Scenario: Defaults derived from hostname

- **WHEN** `base_url` is `https://api.example.com:8080/v1` and no provider id or name is supplied
- **THEN** `provider_id` is `api-example-com`
- **AND** `provider_name` is `api.example.com`

#### Scenario: User overrides the identity

- **WHEN** the user supplies `provider_id` `myrouter` and `provider_name` `My Router`
- **THEN** the config contains a `model_providers.myrouter` table whose `name` is `My Router`

#### Scenario: Invalid provider id rejected

- **WHEN** the user supplies `provider_id` `My Router!`
- **THEN** generation fails with a validation error naming `provider_id`
- **AND** no config output is produced

### Requirement: Codex models.json catalog

The system SHALL produce a `models.json` catalog containing exactly three model entries, one each for the small, medium and large slots, in that order. Each entry's `slug`, `display_name` and the model name inside its `description` SHALL be that slot's model name. The entries SHALL carry the field set the Codex CLI expects, including `default_reasoning_level`, `supported_reasoning_levels` covering `low`, `medium`, `high` and `xhigh`, `context_window` of `400000`, `truncation_policy` of `{"mode":"tokens","limit":400000}`, `effective_context_window_percent` of `95`, and `input_modalities` of `["text","image"]`.

#### Scenario: Three slots present in order

- **WHEN** the generator runs with small `m-s`, medium `m-m` and large `m-l`
- **THEN** the output parses as JSON
- **AND** `models` has length 3
- **AND** the `slug` values are `m-s`, `m-m`, `m-l` in that order

#### Scenario: Identical slot values collapse to identical entries

- **WHEN** all three slots resolve to the same primary model name
- **THEN** `models` still has length 3
- **AND** all three entries carry that same `slug`

#### Scenario: Reasoning levels present

- **WHEN** the catalog is generated
- **THEN** each entry's `supported_reasoning_levels` contains the efforts `low`, `medium`, `high` and `xhigh`

### Requirement: Install preserves Codex auth state

An install SHALL write `~/.codex/auth.json` containing `{}` only when that file is missing or empty. When the file exists and is non-empty, the install SHALL leave it untouched and report that the existing file was kept.

#### Scenario: Missing auth file is created

- **WHEN** `~/.codex/auth.json` does not exist and the install runs
- **THEN** the file is created containing `{}`

#### Scenario: Existing auth file is preserved

- **WHEN** `~/.codex/auth.json` exists with non-empty content
- **THEN** its content after the install is byte-identical to before
- **AND** the install reports that the existing file was kept

### Requirement: Backup before overwriting Codex config

An install SHALL back up an existing `~/.codex/config.toml` to `config.toml.backup.<timestamp>` before overwriting it. If the backup cannot be created, the install SHALL abort with a non-zero exit status and leave the original file unmodified. `config.toml` and `models.json` are fully owned by this tool and SHALL be written whole rather than merged.

#### Scenario: Existing config is backed up

- **WHEN** `~/.codex/config.toml` already exists and the install runs
- **THEN** a file matching `config.toml.backup.*` exists whose content equals the pre-install `config.toml`

#### Scenario: Backup failure aborts

- **WHEN** the backup copy fails
- **THEN** the install prints an error naming the file, exits non-zero, and leaves `config.toml` unchanged

### Requirement: No automatic CLI installation

An install SHALL NOT install, upgrade or remove the Codex CLI or any npm package. When the `codex` executable is not found on `PATH`, the install SHALL still write the configuration files and SHALL print a warning telling the user the CLI is not installed.

#### Scenario: Codex CLI missing

- **WHEN** `codex` is not on `PATH` and the install runs
- **THEN** no package manager command is executed
- **AND** the configuration files are written
- **AND** a warning states that the Codex CLI was not found

### Requirement: Install writes only Codex config files

An install SHALL write only `~/.codex/config.toml`, `~/.codex/models.json`, `~/.codex/auth.json` and backups of those files. It SHALL NOT modify shell startup files or Windows User or Machine environment variables.

#### Scenario: Nothing outside ~/.codex is touched

- **WHEN** an install completes
- **THEN** the only files created or modified are inside `~/.codex/`
- **AND** no shell startup file and no Windows User or Machine environment variable has changed
