param(
    [Parameter()][string]$EmailKeyName = 'GMAIL_BOT_EMAIL',
    [Parameter()][string]$AppPasswordKeyName = 'GMAIL_BOT_APP_PASSWORD',
    [Parameter()][string]$GmailEmail,
    [Parameter()][string]$GmailAppPassword
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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$addSecretScript = Join-Path $scriptDir 'add-secret.ps1'

if (-not (Test-Path $addSecretScript)) {
    throw 'No se encontró scripts/add-secret.ps1'
}

if ([string]::IsNullOrWhiteSpace($GmailEmail)) {
    $GmailEmail = Read-RequiredPlainValue -Prompt 'Correo Gmail del bot (ej: bot.academic@gmail.com)'
}

if ($GmailEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw 'Correo inválido.'
}

if ([string]::IsNullOrWhiteSpace($GmailAppPassword)) {
    $GmailAppPassword = Read-RequiredSecureValue -Prompt 'Clave de aplicación Gmail (16 caracteres)'
}

& $addSecretScript -KeyName $EmailKeyName -KeyValue $GmailEmail
& $addSecretScript -KeyName $AppPasswordKeyName -KeyValue $GmailAppPassword

Write-Host ''
Write-Host 'Secretos Gmail guardados en SOPS.' -ForegroundColor Green
Write-Host ("- {0}" -f $EmailKeyName) -ForegroundColor Gray
Write-Host ("- {0}" -f $AppPasswordKeyName) -ForegroundColor Gray
Write-Host 'Ejecuta scripts/start-academic.ps1 para cargarlos en colega.' -ForegroundColor Gray


