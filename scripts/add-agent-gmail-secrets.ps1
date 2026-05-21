param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('colega', 'coach', 'socio')]
    [string]$Agent,

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
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($GmailEmail)) {
    $GmailEmail = Read-RequiredPlainValue -Prompt ("Correo Gmail propio de {0}" -f $Agent)
}

if ($GmailEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw 'Correo inválido.'
}

if ([string]::IsNullOrWhiteSpace($GmailAppPassword)) {
    $GmailAppPassword = Read-RequiredSecureValue -Prompt 'Clave de aplicación Gmail'
}

$emailKey = ''
$passwordKey = ''
$writer = ''

switch ($Agent) {
    'colega' {
        $emailKey = 'GMAIL_BOT_EMAIL'
        $passwordKey = 'GMAIL_BOT_APP_PASSWORD'
        $writer = Join-Path $scriptDir 'add-secret.ps1'
    }
    'coach' {
        $emailKey = 'COACH_GMAIL_EMAIL'
        $passwordKey = 'COACH_GMAIL_APP_PASSWORD'
        $writer = Join-Path $scriptDir 'add-secret-personal.ps1'
    }
    'socio' {
        $emailKey = 'SOCIO_GMAIL_EMAIL'
        $passwordKey = 'SOCIO_GMAIL_APP_PASSWORD'
        $writer = Join-Path $scriptDir 'add-secret-business.ps1'
    }
}

if (-not (Test-Path $writer)) {
    throw "No se encontró $writer"
}

& $writer -KeyName $emailKey -KeyValue $GmailEmail
& $writer -KeyName $passwordKey -KeyValue $GmailAppPassword

Write-Host ''
Write-Host ("Correo de {0} guardado en secretos cifrados." -f $Agent) -ForegroundColor Green
Write-Host ("- {0}" -f $emailKey) -ForegroundColor Gray
Write-Host ("- {0}" -f $passwordKey) -ForegroundColor Gray
Write-Host 'Reinicia el agente correspondiente para regenerar runtime env y tomar los cambios.' -ForegroundColor Gray

