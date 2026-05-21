param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('colega', 'coach', 'socio')]
    [string]$Agent,

    [Parameter()][string]$BotToken,
    [Parameter()][string]$AppToken,
    [Parameter()][string]$SigningSecret,
    [Parameter()][string]$ChannelId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-RequiredPlainValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    while ($true) {
        $value = (Read-Host -Prompt $Prompt).Trim()
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }

        Write-Host 'Valor vacío. Intenta de nuevo.' -ForegroundColor Yellow
    }
}

function Read-OptionalPlainValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    return (Read-Host -Prompt $Prompt).Trim()
}

function Read-RequiredSecureValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    while ($true) {
        $secure = Read-Host -Prompt $Prompt -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }

        if (-not [string]::IsNullOrWhiteSpace($plain)) {
            return $plain
        }

        Write-Host 'Valor vacío. Intenta de nuevo.' -ForegroundColor Yellow
    }
}

function Read-OptionalSecureValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    return ([string]$plain).Trim()
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($BotToken)) {
    $BotToken = Read-RequiredSecureValue -Prompt ("SLACK_BOT_TOKEN para {0} (xoxb-...)" -f $Agent)
}

if ($BotToken -notmatch '^xoxb-') {
    throw 'SLACK_BOT_TOKEN debe empezar por xoxb-.'
}

if ([string]::IsNullOrWhiteSpace($AppToken)) {
    $AppToken = Read-RequiredSecureValue -Prompt ("SLACK_APP_TOKEN para {0} Socket Mode (xapp-...)" -f $Agent)
}

if ($AppToken -notmatch '^xapp-') {
    throw 'SLACK_APP_TOKEN debe empezar por xapp-.'
}

if ([string]::IsNullOrWhiteSpace($SigningSecret)) {
    $SigningSecret = Read-OptionalSecureValue -Prompt 'SLACK_SIGNING_SECRET opcional (Enter para omitir)'
}

if ([string]::IsNullOrWhiteSpace($ChannelId)) {
    $ChannelId = Read-OptionalPlainValue -Prompt 'SLACK_CHANNEL_ID opcional (ej: C0123..., Enter para omitir)'
}

$writer = switch ($Agent) {
    'colega' { Join-Path $scriptDir 'add-secret.ps1' }
    'coach' { Join-Path $scriptDir 'add-secret-personal.ps1' }
    'socio' { Join-Path $scriptDir 'add-secret-business.ps1' }
}

if (-not (Test-Path $writer)) {
    throw "No se encontró $writer"
}

& $writer -KeyName 'SLACK_BOT_TOKEN' -KeyValue $BotToken
& $writer -KeyName 'SLACK_APP_TOKEN' -KeyValue $AppToken

if (-not [string]::IsNullOrWhiteSpace($SigningSecret)) {
    & $writer -KeyName 'SLACK_SIGNING_SECRET' -KeyValue $SigningSecret
}

if (-not [string]::IsNullOrWhiteSpace($ChannelId)) {
    & $writer -KeyName 'SLACK_CHANNEL_ID' -KeyValue $ChannelId
}

Write-Host ''
Write-Host ("Slack de {0} guardado en secretos cifrados." -f $Agent) -ForegroundColor Green
Write-Host '- SLACK_BOT_TOKEN' -ForegroundColor Gray
Write-Host '- SLACK_APP_TOKEN' -ForegroundColor Gray
if (-not [string]::IsNullOrWhiteSpace($SigningSecret)) { Write-Host '- SLACK_SIGNING_SECRET' -ForegroundColor Gray }
if (-not [string]::IsNullOrWhiteSpace($ChannelId)) { Write-Host '- SLACK_CHANNEL_ID' -ForegroundColor Gray }
Write-Host 'Reinicia el agente correspondiente para regenerar runtime env y tomar los cambios.' -ForegroundColor Gray


