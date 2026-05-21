Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ToolPath {
    param(
        [Parameter(Mandatory = $true)][string]$PrimaryName,
        [Parameter()][string]$WingetFolderHint,
        [Parameter()][string]$ExeName
    )

    $cmd = Get-Command $PrimaryName -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    if ($WingetFolderHint -and $ExeName) {
        $base = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
        if (Test-Path $base) {
            $candidate = Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like "$WingetFolderHint*" } |
                ForEach-Object { Join-Path $_.FullName $ExeName } |
                Where-Object { Test-Path $_ } |
                Select-Object -First 1
            if ($candidate) {
                return $candidate
            }
        }
    }

    throw "No se encontró la herramienta '$PrimaryName'."
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

    if ($null -eq $plain) {
        return ''
    }

    return ([string]$plain).Trim()
}

function Get-JsonPropertyValue {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not $Object) {
        return $null
    }

    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) {
        return $null
    }

    return $prop.Value
}

function Ensure-JsonObjectProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $value = Get-JsonPropertyValue -Object $Object -Name $Name
    if (-not $value) {
        Add-Member -InputObject $Object -MemberType NoteProperty -Name $Name -Value ([pscustomobject]@{}) -Force
        $value = Get-JsonPropertyValue -Object $Object -Name $Name
    }

    return $value
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

Write-Host "Repositorio: $repoRoot" -ForegroundColor Cyan

$sopsExe = Resolve-ToolPath -PrimaryName 'sops' -WingetFolderHint 'SecretsOPerationS.SOPS' -ExeName 'sops.exe'
$ageKeygenExe = Resolve-ToolPath -PrimaryName 'age-keygen' -WingetFolderHint 'FiloSottile.age' -ExeName 'age\age-keygen.exe'

$ageDir = Join-Path $repoRoot '.age'
$keyFile = Join-Path $ageDir 'keys.txt'
$secretsDir = Join-Path $repoRoot 'secrets'
$secretFile = Join-Path $secretsDir 'business.enc.yaml'
$sopsConfig = Join-Path $repoRoot '.sops.yaml'

New-Item -ItemType Directory -Force -Path $ageDir | Out-Null
New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null

if (-not (Test-Path $keyFile)) {
    Write-Host 'No existe identidad AGE. Generando .age/keys.txt...' -ForegroundColor Yellow
    & $ageKeygenExe -o $keyFile | Out-Null
}

$publicKeyMatch = Select-String -Path $keyFile -Pattern '^# public key: (age1[0-9a-z]+)$' | Select-Object -First 1
if (-not $publicKeyMatch) {
    throw 'No se pudo extraer la llave pública AGE desde .age/keys.txt'
}
$publicKey = $publicKeyMatch.Matches[0].Groups[1].Value

if (-not (Test-Path $sopsConfig)) {
    @"
creation_rules:
  - path_regex: ^secrets/.*\\.enc\\.ya?ml$
    age: $publicKey
    encrypted_regex: '^(.*_unencrypted)$'
"@ | Set-Content -Path $sopsConfig -Encoding utf8
    Write-Host 'Creado .sops.yaml con tu llave pública AGE.' -ForegroundColor Green
}

$env:SOPS_AGE_KEY_FILE = $keyFile

Write-Host ''
Write-Host 'Configurarás secretos cifrados para SOCIO (business_agent)' -ForegroundColor Cyan
Write-Host '- TELEGRAM_BOT_TOKEN (opcional)' -ForegroundColor Gray
Write-Host '- GOOGLE_ANALYTICS_KEY (opcional)' -ForegroundColor Gray
Write-Host '- OPENROUTER_API_KEY (opcional)' -ForegroundColor Gray
Write-Host ''

$jsonObj = $null
if (Test-Path $secretFile) {
    $existingJson = & $sopsExe --decrypt --output-type json $secretFile
    $jsonObj = $existingJson | ConvertFrom-Json
}
else {
    $jsonObj = [pscustomobject]@{}
}

$businessObj = Ensure-JsonObjectProperty -Object $jsonObj -Name 'business'
$envObj = Ensure-JsonObjectProperty -Object $businessObj -Name 'env'

$extraKeysRaw = Read-Host 'Ingresa nombres de secretos para Socio separados por coma (ej: TELEGRAM_BOT_TOKEN,VERCEL_API_KEY) o Enter para omitir'
if (-not [string]::IsNullOrWhiteSpace($extraKeysRaw)) {
    $extraKeys = $extraKeysRaw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^[A-Z][A-Z0-9_]*$' } | Select-Object -Unique

    foreach ($key in $extraKeys) {
        $value = Read-RequiredSecureValue -Prompt ("Ingresa {0}" -f $key)
        Add-Member -InputObject $envObj -MemberType NoteProperty -Name $key -Value $value -Force
    }
}

$tempJson = Join-Path $env:TEMP ("business-secrets-" + [Guid]::NewGuid().ToString() + '.json')
$tempEnc = Join-Path $repoRoot 'secrets\.tmp.business.enc.yaml'
try {
    ($jsonObj | ConvertTo-Json -Depth 20) | Set-Content -Path $tempJson -Encoding utf8
    Get-Content -Path $tempJson -Raw | Set-Content -Path $tempEnc -Encoding utf8
    & $sopsExe --encrypt --in-place $tempEnc
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló el cifrado con sops al guardar secrets/business.enc.yaml'
    }
    Move-Item -Force -Path $tempEnc -Destination $secretFile
}
finally {
    if (Test-Path $tempJson) {
        Remove-Item $tempJson -Force
    }
    if (Test-Path $tempEnc) {
        Remove-Item $tempEnc -Force
    }
}

Write-Host ''
Write-Host 'Listo: secretos de Socio guardados en secrets/business.enc.yaml' -ForegroundColor Green
Write-Host 'Tu llave privada está en .age/keys.txt (no compartir).' -ForegroundColor Yellow


