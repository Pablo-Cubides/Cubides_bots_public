param(
    [Parameter()][switch]$SkipDatabaseIds
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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
            return $plain.Trim()
        }

        Write-Host 'Valor vacío. Intenta de nuevo.' -ForegroundColor Yellow
    }
}

function Read-OptionalPlainValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    $value = Read-Host -Prompt $Prompt
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $null
    }
    return $value.Trim()
}

function Save-SharedSecret {
    param(
        [Parameter(Mandatory = $true)][string]$KeyName,
        [Parameter(Mandatory = $true)][string]$KeyValue
    )

    & (Join-Path $scriptDir 'add-secret.ps1') -KeyName $KeyName -KeyValue $KeyValue
    & (Join-Path $scriptDir 'add-secret-personal.ps1') -KeyName $KeyName -KeyValue $KeyValue
    & (Join-Path $scriptDir 'add-secret-business.ps1') -KeyName $KeyName -KeyValue $KeyValue
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

Write-Host 'Configurando Notion compartido para Colega, Coach y Socio.' -ForegroundColor Cyan
Write-Host 'El token se guardará cifrado en academic/personal/business. No se imprimirá.' -ForegroundColor Gray

$token = Read-RequiredSecureValue -Prompt 'NOTION_API_KEY / Internal Integration Secret'
Save-SharedSecret -KeyName 'NOTION_API_KEY' -KeyValue $token

if (-not $SkipDatabaseIds) {
    Write-Host ''
    Write-Host 'IDs opcionales de bases de datos. Enter para omitir cualquiera.' -ForegroundColor Cyan
    $databaseKeys = @(
        'NOTION_TASKS_DATABASE_ID',
        'NOTION_MEMORY_DATABASE_ID',
        'NOTION_DAILY_DATABASE_ID',
        'NOTION_NIGHTLY_DATABASE_ID',
        'NOTION_SUNDAY_DATABASE_ID',
        'NOTION_BUSINESS_METRICS_DATABASE_ID'
    )

    foreach ($key in $databaseKeys) {
        $value = Read-OptionalPlainValue -Prompt $key
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            Save-SharedSecret -KeyName $key -KeyValue $value
        }
    }
}

Write-Host ''
Write-Host 'Notion guardado en secretos cifrados.' -ForegroundColor Green
Write-Host 'Siguiente paso: reinicia los agentes para regenerar runtime env:' -ForegroundColor Yellow
Write-Host '  .\scripts\start-academic.ps1' -ForegroundColor Gray
Write-Host '  .\scripts\start-personal.ps1 -NoAttach' -ForegroundColor Gray
Write-Host '  .\scripts\start-business.ps1 -NoBuild' -ForegroundColor Gray


