# Interactive setup CLI (Windows PowerShell 5.1+) — the terminal equivalent of
# the web UI, and the PowerShell twin of `cli-posix.sh.tpl`.
#
# This script collects nothing on its own: it prompts for the same fields the
# web form asks for, then calls the very same `/api/setup/*` route handlers the
# web UI builds one-liners for, and executes the install script they return.
# All validation therefore stays in one place (src/lib/validation.ts) — a bad
# key or model is rejected by the route, and its 400 body (which always names
# the offending field) is printed here verbatim.

$ErrorActionPreference = "Stop"

$ORIGIN = "{{ORIGIN}}"

# $Default may be empty, in which case the prompt has no suggestion and an
# empty answer stays empty for `Require` to reject.
function Read-Answer {
    param([string]$Prompt, [string]$Default = "")

    if ($Default -ne "") {
        $answer = Read-Host -Prompt "$Prompt [$Default]"
    } else {
        $answer = Read-Host -Prompt $Prompt
    }
    if ([string]::IsNullOrWhiteSpace($answer)) {
        return $Default
    }
    return $answer.Trim()
}

# `Read-Host -AsSecureString` keeps the key off the screen. It is converted
# straight back to plain text because that is what has to go on the wire, and
# the BSTR is zeroed immediately afterwards so the decrypted copy does not sit
# in memory for the rest of the session.
function Read-Secret {
    param([string]$Prompt)

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Require-Value {
    param([string]$Value, [string]$Name)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Host "Error: $Name must not be empty." -ForegroundColor Red
        exit 1
    }
}

function Read-YesNo {
    param([string]$Prompt, [bool]$DefaultYes)

    $default = if ($DefaultYes) { "Y" } else { "N" }
    $answer = Read-Answer -Prompt $Prompt -Default $default
    return $answer -match '^[Yy]'
}

# Fetches one install script and runs it. `$Params` is a plain hashtable of
# unencoded values; every one is URL-encoded here, so no caller has to escape
# anything. A non-200 means validation rejected an answer: the body is the
# route's own message naming the bad field, so it is shown as is instead of a
# generic failure. PowerShell throws on a 4xx, and the body is then only
# reachable through the exception, hence the try/catch.
function Invoke-Setup {
    param([string]$Path, [hashtable]$Params)

    $pairs = foreach ($name in $Params.Keys) {
        "{0}={1}" -f $name, [uri]::EscapeDataString([string]$Params[$name])
    }
    $url = "$ORIGIN$Path`?" + ($pairs -join "&")

    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    } catch {
        $status = $null
        $body = $null
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $body = $_.ErrorDetails.Message
        }
        if ($status) {
            Write-Host "Rejected by the server (HTTP $status):" -ForegroundColor Red
            if ($body) { Write-Host $body }
        } else {
            Write-Host "Error: could not reach $ORIGIN$Path" -ForegroundColor Red
        }
        exit 1
    }

    Invoke-Expression $response.Content
}

Write-Host "================================" -ForegroundColor Blue
Write-Host "  Setting Key - interactive setup" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host ""

$wantClaudeCode = Read-YesNo -Prompt "Configure Claude Code?" -DefaultYes $true
$wantCodex = Read-YesNo -Prompt "Configure Codex?" -DefaultYes $false

if (-not $wantClaudeCode -and -not $wantCodex) {
    Write-Host "Nothing selected - exiting." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
$baseUrl = Read-Answer -Prompt "Base URL"
Require-Value -Value $baseUrl -Name "Base URL"

$apiKey = Read-Secret -Prompt "API key"
Require-Value -Value $apiKey -Name "API key"

# One primary model fills every tier, exactly like the web form's "Primary
# model" field; the override prompts below replace individual tiers.
$primaryModel = Read-Answer -Prompt "Primary model"
Require-Value -Value $primaryModel -Name "Primary model"

$wantOverrides = Read-YesNo -Prompt "Override individual model tiers?" -DefaultYes $false

if ($wantClaudeCode) {
    $ccHaiku = $primaryModel
    $ccSonnet = $primaryModel
    $ccOpus = $primaryModel
    if ($wantOverrides) {
        Write-Host ""
        Write-Host "Claude Code model tiers" -ForegroundColor Blue
        $ccHaiku = Read-Answer -Prompt "  haiku" -Default $ccHaiku
        $ccSonnet = Read-Answer -Prompt "  sonnet" -Default $ccSonnet
        $ccOpus = Read-Answer -Prompt "  opus" -Default $ccOpus
    }
}

if ($wantCodex) {
    $cxSmall = $primaryModel
    $cxMedium = $primaryModel
    $cxLarge = $primaryModel
    if ($wantOverrides) {
        Write-Host ""
        Write-Host "Codex model tiers" -ForegroundColor Blue
        $cxSmall = Read-Answer -Prompt "  small" -Default $cxSmall
        $cxMedium = Read-Answer -Prompt "  medium" -Default $cxMedium
        $cxLarge = Read-Answer -Prompt "  large" -Default $cxLarge
    }

    # Codex needs a provider id/name. The defaults offered here are derived
    # from the Base URL's hostname in the same spirit as the web UI's derived
    # placeholders; they are suggestions the user can replace, not a
    # re-implementation of deriveProviderId/deriveProviderName.
    $cxHost = $baseUrl -replace '^[A-Za-z][A-Za-z0-9+.-]*://', '' -replace '[:/].*$', ''
    $cxDefaultId = ($cxHost.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    Write-Host ""
    Write-Host "Codex provider" -ForegroundColor Blue
    $cxProviderId = Read-Answer -Prompt "  provider id" -Default $cxDefaultId
    Require-Value -Value $cxProviderId -Name "provider id"
    $cxProviderName = Read-Answer -Prompt "  provider name" -Default $cxHost
    Require-Value -Value $cxProviderName -Name "provider name"
}

if ($wantClaudeCode) {
    Write-Host ""
    Invoke-Setup -Path "/api/setup/claudecode" -Params @{
        key      = $apiKey
        base_url = $baseUrl
        haiku    = $ccHaiku
        sonnet   = $ccSonnet
        opus     = $ccOpus
        os       = "windows"
    }
}

if ($wantCodex) {
    Write-Host ""
    Invoke-Setup -Path "/api/setup/codex" -Params @{
        key           = $apiKey
        base_url      = $baseUrl
        small         = $cxSmall
        medium        = $cxMedium
        large         = $cxLarge
        provider_id   = $cxProviderId
        provider_name = $cxProviderName
        os            = "windows"
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
