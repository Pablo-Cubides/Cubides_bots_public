param(
    [Parameter()][string]$KeyName,
    [Parameter()][string]$KeyValue
)

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

$sopsExe = Resolve-ToolPath -PrimaryName 'sops' -WingetFolderHint 'SecretsOPerationS.SOPS' -ExeName 'sops.exe'
$keyFile = Join-Path $repoRoot '.age\keys.txt'
$secretFile = Join-Path $repoRoot 'secrets\academic.enc.yaml'

if (-not (Test-Path $keyFile)) {
    throw 'No existe .age/keys.txt. Ejecuta primero scripts/secrets-setup.ps1'
}
if (-not (Test-Path $secretFile)) {
    throw 'No existe secrets/academic.enc.yaml. Ejecuta primero scripts/secrets-setup.ps1'
}

$env:SOPS_AGE_KEY_FILE = $keyFile

$keyName = if (-not [string]::IsNullOrWhiteSpace($KeyName)) { $KeyName.Trim() } else { (Read-Host 'Nombre del secreto (ej: NOTION_API_KEY)').Trim() }
if ($keyName -notmatch '^[A-Z][A-Z0-9_]*$') {
    throw 'Nombre inválido. Usa formato ENV: MAYÚSCULAS, números y _'
}

$keyValue = if (-not [string]::IsNullOrWhiteSpace($KeyValue)) { $KeyValue } else { Read-RequiredSecureValue -Prompt ("Valor para {0}" -f $keyName) }

$decryptedJsonRaw = & $sopsExe --decrypt --output-type json $secretFile
$jsonObj = $decryptedJsonRaw | ConvertFrom-Json

$academicObj = Ensure-JsonObjectProperty -Object $jsonObj -Name 'academic'
$envObj = Ensure-JsonObjectProperty -Object $academicObj -Name 'env'

$legacyAdmin = Get-JsonPropertyValue -Object $academicObj -Name 'AGENT_ADMIN_TOKEN'
$legacyGateway = Get-JsonPropertyValue -Object $academicObj -Name 'OPENCLAW_GATEWAY_TOKEN'

if (-not [string]::IsNullOrWhiteSpace([string]$legacyAdmin) -and -not (Get-JsonPropertyValue -Object $envObj -Name 'AGENT_ADMIN_TOKEN')) {
    Add-Member -InputObject $envObj -MemberType NoteProperty -Name 'AGENT_ADMIN_TOKEN' -Value ([string]$legacyAdmin) -Force
}
if (-not [string]::IsNullOrWhiteSpace([string]$legacyGateway) -and -not (Get-JsonPropertyValue -Object $envObj -Name 'OPENCLAW_GATEWAY_TOKEN')) {
    Add-Member -InputObject $envObj -MemberType NoteProperty -Name 'OPENCLAW_GATEWAY_TOKEN' -Value ([string]$legacyGateway) -Force
}

Add-Member -InputObject $envObj -MemberType NoteProperty -Name $keyName -Value $keyValue -Force

$tempJson = Join-Path $env:TEMP ("academic-secrets-" + [Guid]::NewGuid().ToString() + '.json')
$tempEnc = Join-Path $repoRoot 'secrets\.tmp.academic.enc.yaml'
try {
    ($jsonObj | ConvertTo-Json -Depth 20) | Set-Content -Path $tempJson -Encoding utf8
    Get-Content -Path $tempJson -Raw | Set-Content -Path $tempEnc -Encoding utf8
    & $sopsExe --encrypt --in-place $tempEnc
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló el cifrado con sops al guardar el secreto.'
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

Write-Host ("Secreto {0} guardado cifrado en secrets/academic.enc.yaml" -f $keyName) -ForegroundColor Green

