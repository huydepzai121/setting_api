# Derived from viber-router (viber-router-api/templates/setup/claudecode-windows.ps1.tpl).
# Source project license: "Context Engine — Source-Available, Non-Commercial License,
# Copyright (c) 2026 viber.vn. All rights reserved." Ported and adapted for setting_key.
#
# Claude Code Setup Script (Windows PowerShell 5.1+)
# Auto-generated — configures Claude Code to use your endpoint and API key.
# This script only ever creates or modifies files under ~/.claude — it never
# creates or changes a User or Machine environment variable and never installs
# any package.

$ErrorActionPreference = "Stop"

$ENDPOINT_URL = "{{ENDPOINT_URL}}"
$API_KEY = '{{API_KEY}}'
$HAIKU_MODEL = "{{HAIKU}}"
$SONNET_MODEL = "{{SONNET}}"
$OPUS_MODEL = "{{OPUS}}"
$SUBAGENT_MODEL = "{{SUBAGENT}}"

Write-Host "================================" -ForegroundColor Blue
Write-Host "  Claude Code Setup" -ForegroundColor Blue
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

$MASKED_KEY = $API_KEY.Substring(0, [Math]::Min(10, $API_KEY.Length))
Write-Host "Endpoint URL: " -NoNewline
Write-Host "$ENDPOINT_URL" -ForegroundColor Green
Write-Host "API Key:      " -NoNewline
Write-Host "$MASKED_KEY..." -ForegroundColor Green
Write-Host ""

# Claude Code reads ANTHROPIC_* and CLAUDE_CODE_SUBAGENT_MODEL from the current
# process environment, and those take precedence over settings.json. This
# script never creates, changes or removes a User or Machine environment
# variable — it only warns, because doing otherwise would mean touching
# something outside the Claude Code config directory.
# Test-Path against the Env: drive is used (rather than checking the value)
# so a variable set to an empty string still counts as "set".
$WATCHED_VARS = @(
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "CLAUDE_CODE_SUBAGENT_MODEL"
)

$activeVars = @()
foreach ($varName in $WATCHED_VARS) {
    if (Test-Path "Env:\$varName") {
        $activeVars += $varName
    }
}

if ($activeVars.Count -gt 0) {
    Write-Host "Warning: these variables are set in your current environment:" -ForegroundColor Yellow
    foreach ($varName in $activeVars) {
        Write-Host "  - $varName" -ForegroundColor Yellow
    }
    Write-Host "They override settings.json for any Claude Code process that inherits them." -ForegroundColor Yellow
    Write-Host "To remove one permanently, delete it from wherever it is configured (System" -ForegroundColor Yellow
    Write-Host "Properties > Environment Variables, or however it was set) and open a new terminal." -ForegroundColor Yellow
    Write-Host "To clear them in this session only, run:" -ForegroundColor Yellow
    foreach ($varName in $activeVars) {
        Write-Host "  Remove-Item Env:\$varName" -ForegroundColor Yellow
    }
    Write-Host ""
}

$settingsDir = Join-Path $HOME ".claude"
$settingsPath = Join-Path $settingsDir "settings.json"

if (-not (Test-Path $settingsDir)) {
    New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null
}

Write-Host "Configuring Claude Code settings..." -ForegroundColor Blue

$settings = $null

if (Test-Path $settingsPath) {
    $backupPath = "$settingsPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    try {
        Copy-Item $settingsPath $backupPath -ErrorAction Stop
    } catch {
        Write-Host "Error: could not back up $settingsPath" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Backed up: $settingsPath -> $backupPath" -ForegroundColor Yellow

    $parseFailed = $false
    $isEmpty = (Get-Item $settingsPath).Length -eq 0
    if (-not $isEmpty) {
        try {
            $content = Get-Content $settingsPath -Raw -ErrorAction Stop
            $settings = ConvertFrom-Json $content -ErrorAction Stop
        } catch {
            $parseFailed = $true
        }
    } else {
        $parseFailed = $true
    }

    if ($parseFailed -or $null -eq $settings) {
        Write-Host "  Warning: existing settings.json could not be parsed as JSON." -ForegroundColor Yellow
        Write-Host "  Previous content preserved at: $backupPath" -ForegroundColor Yellow
        Write-Host "  Writing a fresh settings.json with only the generated keys." -ForegroundColor Yellow
        $settings = $null
    }
}

if ($null -eq $settings) {
    $settings = New-Object PSObject
}

if (-not (Get-Member -InputObject $settings -Name "env" -MemberType Properties)) {
    $settings | Add-Member -MemberType NoteProperty -Name "env" -Value (New-Object PSObject)
}

$envVars = @{
    "ANTHROPIC_BASE_URL" = $ENDPOINT_URL
    "ANTHROPIC_AUTH_TOKEN" = $API_KEY
    "ANTHROPIC_DEFAULT_HAIKU_MODEL" = $HAIKU_MODEL
    "ANTHROPIC_DEFAULT_SONNET_MODEL" = $SONNET_MODEL
    "ANTHROPIC_DEFAULT_OPUS_MODEL" = $OPUS_MODEL
    "CLAUDE_CODE_SUBAGENT_MODEL" = $SUBAGENT_MODEL
}

foreach ($kvp in $envVars.GetEnumerator()) {
    if (Get-Member -InputObject $settings.env -Name $kvp.Key -MemberType Properties) {
        $settings.env.($kvp.Key) = $kvp.Value
    } else {
        $settings.env | Add-Member -MemberType NoteProperty -Name $kvp.Key -Value $kvp.Value
    }
}

if (Get-Member -InputObject $settings -Name "disableLoginPrompt" -MemberType Properties) {
    $settings.disableLoginPrompt = $true
} else {
    $settings | Add-Member -MemberType NoteProperty -Name "disableLoginPrompt" -Value $true
}

if (Get-Member -InputObject $settings -Name "includeCoAuthoredBy" -MemberType Properties) {
    $settings.includeCoAuthoredBy = $false
} else {
    $settings | Add-Member -MemberType NoteProperty -Name "includeCoAuthoredBy" -Value $false
}

$jsonContent = $settings | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($settingsPath, $jsonContent, [System.Text.UTF8Encoding]::new($false))

Write-Host "  " -NoNewline
Write-Host "OK" -ForegroundColor Green -NoNewline
Write-Host " Updated $settingsPath"

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Configuration Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Claude Code is now configured:"
Write-Host "  Endpoint: " -NoNewline
Write-Host "$ENDPOINT_URL" -ForegroundColor Blue
Write-Host "  API Key:  " -NoNewline
Write-Host "$MASKED_KEY..." -ForegroundColor Blue
Write-Host "  Config:   " -NoNewline
Write-Host "$settingsPath" -ForegroundColor Blue
Write-Host ""
if ($activeVars.Count -gt 0) {
    Write-Host "Reminder: variables set in this environment still override settings.json - see warning above." -ForegroundColor Yellow
    Write-Host ""
}
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open a new terminal if you changed any environment variables"
Write-Host "  2. Run: " -NoNewline
Write-Host "claude" -ForegroundColor Blue
Write-Host ""
