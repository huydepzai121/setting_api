## Purpose

Defines how user input is validated, how the POSIX and Windows install scripts are rendered from it, and the two ways a user can obtain a script: copied whole from the browser, or fetched as a one-line installer from a server route.

## ADDED Requirements

### Requirement: API key validation

The system SHALL accept an `api_key` only when it is non-empty, at most 300 characters, and composed entirely of ASCII alphanumerics and the characters `-`, `_`, `:` and `.`. Any other input SHALL be rejected. The system SHALL NOT strip, escape or otherwise repair a key that fails validation — rejection is what keeps the key safe to embed in a shell single-quoted literal.

#### Scenario: Valid key accepted

- **WHEN** the key is `sk-ant_api03.abc-123:xyz`
- **THEN** validation passes

#### Scenario: Key with a shell metacharacter rejected

- **WHEN** the key contains any of a space, `'`, `"`, `$`, a backtick, `;`, `|`, `&`, `\` or a newline
- **THEN** validation fails with an error naming the key field
- **AND** no script, settings or config output is produced

#### Scenario: Empty key rejected

- **WHEN** the key is an empty string
- **THEN** validation fails with an error naming the key field

#### Scenario: Over-long key rejected

- **WHEN** the key is 301 characters long
- **THEN** validation fails with an error naming the key field

### Requirement: Model name validation

The system SHALL accept a model name only when it is non-empty and composed entirely of ASCII alphanumerics and the characters `-`, `_`, `.` and `:`. Any other input SHALL be rejected rather than filtered.

#### Scenario: Valid model accepted

- **WHEN** the model name is `claude-sonnet-4-6`
- **THEN** validation passes

#### Scenario: Model with a space rejected

- **WHEN** the model name is `my model`
- **THEN** validation fails with an error naming the affected model field
- **AND** no output is produced

#### Scenario: Empty primary model rejected

- **WHEN** the primary model name is empty
- **THEN** validation fails with an error naming the primary model field

### Requirement: Base URL validation and normalization

The system SHALL accept a `base_url` only when it parses as an absolute URL whose scheme is `http` or `https`. The accepted value SHALL be normalized by removing every trailing `/`. Anything that fails to parse, or that uses another scheme, SHALL be rejected.

#### Scenario: Trailing slash removed

- **WHEN** `base_url` is `https://api.example.com/`
- **THEN** the normalized value is `https://api.example.com`

#### Scenario: Multiple trailing slashes removed

- **WHEN** `base_url` is `https://api.example.com/v1///`
- **THEN** the normalized value is `https://api.example.com/v1`

#### Scenario: Non-HTTP scheme rejected

- **WHEN** `base_url` is `file:///etc/passwd` or `ftp://example.com`
- **THEN** validation fails with an error naming the base URL field

#### Scenario: Unparsable value rejected

- **WHEN** `base_url` is `not a url`
- **THEN** validation fails with an error naming the base URL field

### Requirement: OS-specific script rendering

The system SHALL render a POSIX `sh` script and a Windows PowerShell script from the same validated input. The OS SHALL be selected by an `os` value where `windows` and `win`, compared case-insensitively, select the Windows script and any other value selects the POSIX script.

#### Scenario: Windows selected

- **WHEN** `os` is `Windows` or `win` or `WIN`
- **THEN** the PowerShell script is rendered

#### Scenario: POSIX is the default

- **WHEN** `os` is `linux`, `macos`, an unrecognized value, or absent
- **THEN** the POSIX `sh` script is rendered

#### Scenario: Values appear in the rendered script

- **WHEN** a script is rendered with a validated key, base URL and model names
- **THEN** each of those values appears in the script
- **AND** no unreplaced `{{...}}` placeholder remains

### Requirement: One-line installer route handlers

The system SHALL expose `GET /api/setup/claudecode` and `GET /api/setup/codex` returning a rendered install script as the response body. Both SHALL accept `key`, `base_url` and `os` query parameters plus that target's model slot parameters, and for Codex also `provider_id` and `provider_name`. The response `Content-Type` SHALL be `text/plain; charset=utf-8` for Windows and `text/x-shellscript; charset=utf-8` otherwise. Invalid input SHALL produce HTTP 400 with a plain-text body naming the offending field, and SHALL NOT produce a partially rendered script.

#### Scenario: POSIX content type

- **WHEN** `GET /api/setup/claudecode` is called with valid parameters and `os=linux`
- **THEN** the status is 200
- **AND** `Content-Type` is `text/x-shellscript; charset=utf-8`

#### Scenario: Windows content type

- **WHEN** `GET /api/setup/codex` is called with valid parameters and `os=windows`
- **THEN** the status is 200
- **AND** `Content-Type` is `text/plain; charset=utf-8`

#### Scenario: Invalid key rejected by the route

- **WHEN** `GET /api/setup/claudecode` is called with a key containing a space
- **THEN** the status is 400
- **AND** the body names the key field
- **AND** the body contains no script content

#### Scenario: Missing required parameter rejected

- **WHEN** `GET /api/setup/codex` is called without `base_url`
- **THEN** the status is 400
- **AND** the body names the base URL field

### Requirement: Secrets are never persisted or logged

The system SHALL NOT write the API key to any server-side store, log, telemetry sink or analytics event. The installer route handlers SHALL NOT log their request URL or query parameters. The client SHALL NOT place the API key in `localStorage`, `sessionStorage` or any cookie.

#### Scenario: No server-side request logging on installer routes

- **WHEN** an installer route handles a request
- **THEN** it emits no log record containing the request URL, the query string or the key

#### Scenario: Key absent from client storage

- **WHEN** the user has filled the form and generated output
- **THEN** no `localStorage`, `sessionStorage` or cookie entry contains the API key

### Requirement: Client-side full script as the recommended path

The system SHALL render the complete install script in the browser from the same generator used by the route handlers, so the user can copy and paste it without the key travelling through a URL. This path SHALL be presented as the recommended option, and the one-line installer SHALL carry a visible notice that it places the API key in the URL.

#### Scenario: Full script produced without a network request

- **WHEN** the user requests the full script for a valid input
- **THEN** the script is produced in the browser
- **AND** no request carrying the key is sent to the server

#### Scenario: Identical output across both paths

- **WHEN** the same validated input is rendered client-side and by the matching route handler for the same `os`
- **THEN** the two script bodies are identical

#### Scenario: One-liner carries a warning

- **WHEN** the one-line installer command is displayed
- **THEN** a visible notice states that the API key is included in the URL
