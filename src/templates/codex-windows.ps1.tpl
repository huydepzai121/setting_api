# Derived from viber-router (viber-router-api/templates/setup/codex-windows.ps1.tpl).
# Source project license: "Context Engine — Source-Available, Non-Commercial License,
# Copyright (c) 2026 viber.vn. All rights reserved." Ported and adapted for setting_key.
#
# Codex CLI Setup Script (Windows PowerShell 5.1+)
# Auto-generated — configures the Codex CLI to use your endpoint and API key.
# This script only ever creates or modifies files under ~/.codex — it never
# installs, upgrades or removes the Codex CLI or any package.

$ErrorActionPreference = "Stop"

$ENDPOINT_URL = "{{ENDPOINT_URL}}"
$API_KEY = '{{API_KEY}}'
$CODEX_SMALL = "{{SMALL}}"
$CODEX_MEDIUM = "{{MEDIUM}}"
$CODEX_LARGE = "{{LARGE}}"
$PROVIDER_ID = "{{PROVIDER_ID}}"
$PROVIDER_NAME = "{{PROVIDER_NAME}}"

Write-Host "================================" -ForegroundColor Blue
Write-Host "  Codex CLI Setup" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host ""

if ([string]::IsNullOrEmpty($ENDPOINT_URL)) {
    Write-Host "Error: Endpoint URL not configured" -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrEmpty($API_KEY)) {
    Write-Host "Error: API key not configured" -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrEmpty($CODEX_SMALL) -or [string]::IsNullOrEmpty($CODEX_MEDIUM) -or [string]::IsNullOrEmpty($CODEX_LARGE)) {
    Write-Host "Error: model tiers not configured" -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrEmpty($PROVIDER_ID)) {
    Write-Host "Error: provider id not configured" -ForegroundColor Red
    exit 1
}

$MASKED_KEY = $API_KEY.Substring(0, [Math]::Min(10, $API_KEY.Length))
Write-Host "Endpoint URL:      " -NoNewline
Write-Host "$ENDPOINT_URL" -ForegroundColor Green
Write-Host "API Key:           " -NoNewline
Write-Host "$MASKED_KEY..." -ForegroundColor Green
Write-Host "Small (Fast):      " -NoNewline
Write-Host "$CODEX_SMALL" -ForegroundColor Green
Write-Host "Medium (Default):  " -NoNewline
Write-Host "$CODEX_MEDIUM" -ForegroundColor Green
Write-Host "Large (Powerful):  " -NoNewline
Write-Host "$CODEX_LARGE" -ForegroundColor Green
Write-Host ""

$codexCmd = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexCmd) {
    Write-Host "Warning: the Codex CLI was not found on PATH." -ForegroundColor Yellow
    Write-Host "Configuration files will still be written; install the Codex CLI separately when ready." -ForegroundColor Yellow
    Write-Host ""
}

$codexDir = Join-Path $HOME ".codex"
if (-not (Test-Path $codexDir)) {
    New-Item -ItemType Directory -Path $codexDir -Force | Out-Null
}

Write-Host "Configuring Codex CLI..." -ForegroundColor Blue

# config.toml and models.json fully describe the provider setup, so they are
# backed up and written whole rather than merged.
$configPath = Join-Path $codexDir "config.toml"
if (Test-Path $configPath) {
    $configBackupPath = "$configPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    try {
        Copy-Item $configPath $configBackupPath -ErrorAction Stop
    } catch {
        Write-Host "Error: could not back up $configPath" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Backed up: $configPath -> $configBackupPath" -ForegroundColor Yellow
}

$configContent = @"
model = "$CODEX_MEDIUM"
model_provider = "$PROVIDER_ID"
model_catalog_json = "~/.codex/models.json"

[model_providers.$PROVIDER_ID]
name = "$PROVIDER_NAME"
base_url = "$ENDPOINT_URL"
experimental_bearer_token = "$API_KEY"
wire_api = "responses"

[features]
apps = false
"@
[System.IO.File]::WriteAllText($configPath, $configContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "  " -NoNewline
Write-Host "OK" -ForegroundColor Green -NoNewline
Write-Host " Written config.toml"

# models.json content is rendered server-side from a template with the
# {{SMALL}}/{{MEDIUM}}/{{LARGE}} slots already substituted; it is embedded
# here as static JSON (single-quoted here-string, no variable expansion).
$modelsPath = Join-Path $codexDir "models.json"
$modelsContent = @'
{{MODELS_JSON}}
'@
[System.IO.File]::WriteAllText($modelsPath, $modelsContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "  " -NoNewline
Write-Host "OK" -ForegroundColor Green -NoNewline
Write-Host " Written models.json"

# auth.json holds Codex login state this tool has no business touching, so it
# is written only when missing or empty.
$authPath = Join-Path $codexDir "auth.json"
if ((-not (Test-Path $authPath)) -or (Get-Item $authPath).Length -eq 0) {
    [System.IO.File]::WriteAllText($authPath, "{}", [System.Text.UTF8Encoding]::new($false))
    Write-Host "  " -NoNewline
    Write-Host "OK" -ForegroundColor Green -NoNewline
    Write-Host " Written auth.json"
} else {
    Write-Host "  " -NoNewline
    Write-Host "OK" -ForegroundColor Green -NoNewline
    Write-Host " Kept existing auth.json"
}

# models_cache.json is Codex's own cache of the previous model catalog; if left
# behind it can shadow the models.json just written, so remove it when present.
$modelsCachePath = Join-Path $codexDir "models_cache.json"
if (Test-Path $modelsCachePath) {
    Remove-Item $modelsCachePath -Force
    Write-Host "  " -NoNewline
    Write-Host "OK" -ForegroundColor Green -NoNewline
    Write-Host " Removed models_cache.json"
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Configuration Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Codex CLI is now configured:"
Write-Host "  Endpoint:          " -NoNewline
Write-Host "$ENDPOINT_URL" -ForegroundColor Blue
Write-Host "  API Key:           " -NoNewline
Write-Host "$MASKED_KEY..." -ForegroundColor Blue
Write-Host "  Small (Fast):      " -NoNewline
Write-Host "$CODEX_SMALL" -ForegroundColor Blue
Write-Host "  Medium (Default):  " -NoNewline
Write-Host "$CODEX_MEDIUM" -ForegroundColor Blue
Write-Host "  Large (Powerful):  " -NoNewline
Write-Host "$CODEX_LARGE" -ForegroundColor Blue
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  Run: " -NoNewline
Write-Host "codex" -ForegroundColor Blue
Write-Host ""
