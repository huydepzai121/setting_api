## Purpose

Defines the exact `~/.claude/settings.json` content produced for Claude Code from a user-supplied endpoint, API key and model names, and the rules an install must follow so that no other part of the user's machine is modified.

## ADDED Requirements

### Requirement: Claude Code settings content

The system SHALL produce a JSON object containing exactly these keys and no others:

| Key | Value |
| --- | --- |
| `env.ANTHROPIC_BASE_URL` | normalized `base_url` |
| `env.ANTHROPIC_AUTH_TOKEN` | `api_key` |
| `env.ANTHROPIC_DEFAULT_HAIKU_MODEL` | haiku tier |
| `env.ANTHROPIC_DEFAULT_SONNET_MODEL` | sonnet tier |
| `env.ANTHROPIC_DEFAULT_OPUS_MODEL` | opus tier |
| `env.CLAUDE_CODE_SUBAGENT_MODEL` | the model of the selected subagent tier |
| `disableLoginPrompt` | `true` |
| `includeCoAuthoredBy` | `false` |

The `env` key is Claude Code's own configuration format and SHALL be preserved. It is not an environment-variable side effect.

#### Scenario: Generated settings shape

- **WHEN** the generator runs with a valid `base_url`, `api_key` and three model tier values
- **THEN** the output parses as JSON
- **AND** the object has exactly the keys `env`, `disableLoginPrompt` and `includeCoAuthoredBy` at the top level
- **AND** `env` has exactly the six keys listed above
- **AND** `disableLoginPrompt` is `true` and `includeCoAuthoredBy` is `false`

#### Scenario: Values are carried verbatim

- **WHEN** `base_url` is `https://api.example.com` and `api_key` is `sk-test_123`
- **THEN** `env.ANTHROPIC_BASE_URL` is exactly `https://api.example.com`
- **AND** `env.ANTHROPIC_AUTH_TOKEN` is exactly `sk-test_123`

### Requirement: Model tier resolution

Claude Code has exactly three model tiers: haiku, sonnet and opus. The system SHALL accept one primary model name and OPTIONALLY a per-tier override for each of the three. Any tier without an override SHALL resolve to the primary model name.

#### Scenario: No overrides supplied

- **WHEN** the primary model is `my-model-v1` and no tier override is supplied
- **THEN** `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` all equal `my-model-v1`

#### Scenario: Partial overrides supplied

- **WHEN** the primary model is `my-model-v1` and the opus tier is overridden with `my-model-big`
- **THEN** `ANTHROPIC_DEFAULT_OPUS_MODEL` is `my-model-big`
- **AND** the haiku and sonnet tiers equal `my-model-v1`

### Requirement: Subagent tier selection

`CLAUDE_CODE_SUBAGENT_MODEL` is not a fourth model. The system SHALL let the user pick WHICH of the three tiers subagents use, and SHALL write that tier's resolved model name into `CLAUDE_CODE_SUBAGENT_MODEL`. The system SHALL NOT offer a free-text model name for the subagent entry. The default selection SHALL be the sonnet tier.

#### Scenario: Default selection

- **WHEN** the user does not change the subagent tier
- **THEN** `CLAUDE_CODE_SUBAGENT_MODEL` equals the resolved sonnet tier model

#### Scenario: Selecting another tier

- **WHEN** the primary model is `my-model-v1`, the haiku tier is overridden with `my-model-fast`, and the user selects the haiku tier for subagents
- **THEN** `CLAUDE_CODE_SUBAGENT_MODEL` is `my-model-fast`
- **AND** it is identical to `ANTHROPIC_DEFAULT_HAIKU_MODEL`

#### Scenario: Subagent value always tracks its tier

- **WHEN** the user selects the opus tier for subagents and then edits the opus override
- **THEN** `CLAUDE_CODE_SUBAGENT_MODEL` changes with it and stays equal to `ANTHROPIC_DEFAULT_OPUS_MODEL`

### Requirement: Install writes only the settings file

An install SHALL create `~/.claude/` if missing and write only `~/.claude/settings.json` and its backup. It SHALL NOT write, append to, or modify `.bashrc`, `.zshrc`, `.bash_profile`, `.zprofile`, `.profile`, `.zshenv`, any other shell startup file, any Windows User or Machine environment variable, `~/.claude/statusline.sh`, or `~/.claude/statusline.ps1`.

#### Scenario: Shell startup files untouched

- **WHEN** an install runs on a machine whose `~/.bashrc` and `~/.zshrc` contain `ANTHROPIC_BASE_URL` exports
- **THEN** the content of those files after the install is byte-identical to before
- **AND** no Windows User or Machine environment variable has been created, changed or removed

#### Scenario: No statusline artifacts

- **WHEN** an install completes
- **THEN** no `statusline.sh` or `statusline.ps1` exists as a result of the install
- **AND** the written `settings.json` contains no `statusLine` key

### Requirement: Backup before modifying

An install SHALL back up an existing `~/.claude/settings.json` to `settings.json.backup.<timestamp>` before modifying it. If the backup cannot be created, the install SHALL abort with a non-zero exit status and SHALL leave the original file unmodified.

#### Scenario: Existing file is backed up

- **WHEN** `~/.claude/settings.json` already exists and the install runs
- **THEN** a file matching `settings.json.backup.*` exists whose content equals the pre-install `settings.json`

#### Scenario: Backup failure aborts

- **WHEN** the backup copy fails, for example because the directory is read-only
- **THEN** the install prints an error naming the file it could not back up
- **AND** exits with a non-zero status
- **AND** `~/.claude/settings.json` is unchanged

#### Scenario: Missing file is created

- **WHEN** `~/.claude/settings.json` does not exist
- **THEN** the install creates it
- **AND** no backup file is created

### Requirement: Merge, never clobber

An install SHALL merge the generated keys into the existing `settings.json`, preserving every key it does not own. The keys it owns are the six `env.*` entries listed above plus `disableLoginPrompt` and `includeCoAuthoredBy`.

#### Scenario: Unrelated top-level keys survive

- **WHEN** the existing `settings.json` is `{"permissions":{"allow":["Bash"]},"model":"x"}` and the install runs
- **THEN** the resulting file still contains `permissions.allow` equal to `["Bash"]` and `model` equal to `x`
- **AND** additionally contains the generated `env` object, `disableLoginPrompt` and `includeCoAuthoredBy`

#### Scenario: Unrelated env entries survive

- **WHEN** the existing `settings.json` contains `env.SOME_OTHER_VAR` set to `keep-me`
- **THEN** after the install `env.SOME_OTHER_VAR` is still `keep-me`
- **AND** the six generated `env.*` entries hold the new values

#### Scenario: Unparsable existing file

- **WHEN** the existing `settings.json` is not valid JSON
- **THEN** the install backs it up, warns that the previous content could not be parsed and names the backup path
- **AND** writes a fresh settings file containing only the generated keys

### Requirement: Warn about overriding environment variables

An install SHALL detect `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL` when they are set in the current process environment — including when set to an empty string — and SHALL print a warning naming each one, explaining that it overrides `settings.json`. The install SHALL NOT unset, clear or otherwise modify them.

#### Scenario: Active variable is reported

- **WHEN** `ANTHROPIC_BASE_URL` is exported in the shell running the install
- **THEN** the install prints a warning naming `ANTHROPIC_BASE_URL`
- **AND** the variable is still set with its original value when the install exits

#### Scenario: Empty-string variable counts as set

- **WHEN** `ANTHROPIC_AUTH_TOKEN` is set to an empty string
- **THEN** the install prints a warning naming `ANTHROPIC_AUTH_TOKEN`

#### Scenario: No variables set

- **WHEN** none of the listed variables are set
- **THEN** the install prints no override warning
