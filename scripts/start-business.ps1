param(
    [Parameter()][switch]$NoBuild
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

function Parse-SecretValue {
    param([Parameter(Mandatory = $true)][string]$Raw)

    $trimmed = $Raw.Trim()
    try {
        return ($trimmed | ConvertFrom-Json)
    }
    catch {
        return $trimmed
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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$dockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null
$sopsExe = Resolve-ToolPath -PrimaryName 'sops' -WingetFolderHint 'SecretsOPerationS.SOPS' -ExeName 'sops.exe'

$keyFile = Join-Path $repoRoot '.age\keys.txt'
$secretFile = Join-Path $repoRoot 'secrets\business.enc.yaml'
$runtimeDir = Join-Path $repoRoot 'secrets\runtime'
$runtimeEnv = Join-Path $runtimeDir 'business.env'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$envMap = @{}
if ((Test-Path $keyFile) -and (Test-Path $secretFile)) {
    $env:SOPS_AGE_KEY_FILE = $keyFile
    $decryptedJsonRaw = & $sopsExe --decrypt --output-type json $secretFile
    $decrypted = $decryptedJsonRaw | ConvertFrom-Json
    $business = Get-JsonPropertyValue -Object $decrypted -Name 'business'
    $envBlock = Get-JsonPropertyValue -Object $business -Name 'env'

    if ($envBlock) {
        foreach ($prop in $envBlock.PSObject.Properties) {
            $name = [string]$prop.Name
            $value = [string](Parse-SecretValue -Raw ([string]$prop.Value))
            if (-not [string]::IsNullOrWhiteSpace($name) -and -not [string]::IsNullOrWhiteSpace($value)) {
                $envMap[$name] = $value
            }
        }
    }
}

$lines = @()
foreach ($name in $envMap.Keys | Sort-Object) {
    $lines += ("{0}={1}" -f $name, $envMap[$name])
}
Set-Content -Path $runtimeEnv -Value $lines -Encoding utf8

if ($envMap.Count -eq 0) {
    Write-Host 'Business sin secretos cargados (business.env vacío).' -ForegroundColor Yellow
}
else {
    Write-Host 'Secretos cargados para business_agent:' -ForegroundColor Cyan
    foreach ($name in $envMap.Keys | Sort-Object) {
        Write-Host ("- {0}" -f $name) -ForegroundColor Gray
    }
}

$upArgs = @('compose', 'up', '-d', '--remove-orphans')
if (-not $NoBuild) {
    $upArgs += '--build'
}
$upArgs += @('business_agent', 'business_agent_daemon')

& $dockerExe @upArgs
if ($LASTEXITCODE -ne 0) {
    throw 'Falló docker compose up para business_agent.'
}

Write-Host ''
Write-Host 'Business agent levantado.' -ForegroundColor Green
Write-Host 'API: http://127.0.0.1:8003/health' -ForegroundColor Gray
Write-Host 'Runtime env: secrets/runtime/business.env' -ForegroundColor Gray

# Asegura que el Slack bridge este corriendo (no-op si ya esta vivo).
try {
    & (Join-Path $scriptDir 'start-slack-bridge.ps1') -Detached
}
catch {
    Write-Warning ("No se pudo asegurar el Slack bridge: {0}" -f $_.Exception.Message)
}


