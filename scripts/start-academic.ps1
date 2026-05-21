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

$sopsExe = Resolve-ToolPath -PrimaryName 'sops' -WingetFolderHint 'SecretsOPerationS.SOPS' -ExeName 'sops.exe'
$dockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null

$keyFile = Join-Path $repoRoot '.age\keys.txt'
$secretFile = Join-Path $repoRoot 'secrets\academic.enc.yaml'
$runtimeDir = Join-Path $repoRoot 'secrets\runtime'
$openclawEnvFile = Join-Path $runtimeDir 'colega.env'

if (-not (Test-Path $keyFile)) {
    throw 'No existe .age/keys.txt. Ejecuta primero scripts/secrets-setup.ps1'
}
if (-not (Test-Path $secretFile)) {
    throw 'No existe secrets/academic.enc.yaml. Ejecuta primero scripts/secrets-setup.ps1'
}

$env:SOPS_AGE_KEY_FILE = $keyFile

$decryptedJsonRaw = & $sopsExe --decrypt --output-type json $secretFile
$decrypted = $decryptedJsonRaw | ConvertFrom-Json
$academic = Get-JsonPropertyValue -Object $decrypted -Name 'academic'

$envBlock = Get-JsonPropertyValue -Object $academic -Name 'env'
if (-not $envBlock) {
    $envBlock = [pscustomobject]@{}

    $legacyAdmin = Get-JsonPropertyValue -Object $academic -Name 'AGENT_ADMIN_TOKEN'
    $legacyGateway = Get-JsonPropertyValue -Object $academic -Name 'OPENCLAW_GATEWAY_TOKEN'

    if (-not [string]::IsNullOrWhiteSpace([string]$legacyAdmin) -or -not [string]::IsNullOrWhiteSpace([string]$legacyGateway)) {
        Write-Warning 'secrets/academic.enc.yaml usa el formato top-level legacy (claves fuera de .env{}). Migra con: sops secrets/academic.enc.yaml y mueve AGENT_ADMIN_TOKEN/OPENCLAW_GATEWAY_TOKEN dentro del bloque env:. Este soporte se eliminara en la proxima version minor.'
    }

    if (-not [string]::IsNullOrWhiteSpace([string]$legacyAdmin)) {
        Add-Member -InputObject $envBlock -MemberType NoteProperty -Name 'AGENT_ADMIN_TOKEN' -Value ([string]$legacyAdmin) -Force
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$legacyGateway)) {
        Add-Member -InputObject $envBlock -MemberType NoteProperty -Name 'OPENCLAW_GATEWAY_TOKEN' -Value ([string]$legacyGateway) -Force
    }
}

$envMap = @{}
foreach ($prop in $envBlock.PSObject.Properties) {
    $name = [string]$prop.Name
    $value = [string](Parse-SecretValue -Raw ([string]$prop.Value))
    if (-not [string]::IsNullOrWhiteSpace($name) -and $name -ne 'AGENT_ADMIN_TOKEN') {
        $envMap[$name] = $value
    }
}

$gatewayToken = if ($envMap.ContainsKey('OPENCLAW_GATEWAY_TOKEN')) { $envMap['OPENCLAW_GATEWAY_TOKEN'] } else { $null }

if ([string]::IsNullOrWhiteSpace([string]$gatewayToken)) {
    throw 'Falta OPENCLAW_GATEWAY_TOKEN en secrets/academic.enc.yaml'
}

Write-Host 'Secretos cargados para colega (OpenClaw académico):' -ForegroundColor Cyan
foreach ($name in $envMap.Keys | Sort-Object) {
    Write-Host ("- {0}" -f $name) -ForegroundColor Gray
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$openclawEnvLines = @()
foreach ($name in $envMap.Keys | Sort-Object) {
    $openclawEnvLines += ("{0}={1}" -f $name, $envMap[$name])
}
Set-Content -Path $openclawEnvFile -Value $openclawEnvLines -Encoding utf8

& $dockerExe compose up -d --remove-orphans colega
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'No se pudo levantar colega.' -ForegroundColor Red
    Write-Host 'Si Docker dice que el nombre /colega ya existe, revisa el contenedor actual con:' -ForegroundColor Yellow
    Write-Host 'docker ps -a --filter "name=^/colega$" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"' -ForegroundColor Gray
    Write-Host 'Si confirmas que es un contenedor viejo y quieres reemplazarlo, detenlo y elimínalo manualmente antes de volver a correr este script.' -ForegroundColor Yellow
    throw 'Falló docker compose up para colega.'
}

Write-Host ''
Write-Host 'Stack levantado: colega (OpenClaw académico directo)' -ForegroundColor Green
Write-Host 'OpenClaw UI/API: http://127.0.0.1:18789' -ForegroundColor Gray
Write-Host 'Runtime env file: secrets/runtime/colega.env' -ForegroundColor Gray

# Asegura que el Slack bridge este corriendo (no-op si ya esta vivo).
try {
    & (Join-Path $scriptDir 'start-slack-bridge.ps1') -Detached
}
catch {
    Write-Warning ("No se pudo asegurar el Slack bridge: {0}" -f $_.Exception.Message)
}

