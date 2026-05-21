# Modelos por defecto definidos en scripts/lib/routing-models.ps1 (dot-sourced más abajo).
# Los strings aquí son copias necesarias para el bloque param(); la fuente de verdad es el lib.
param(
    [string]$ContainerName = 'colega',
    [string]$PrimaryModel = 'openai-codex/gpt-5.4',
    [string[]]$FallbackModels = @(
        'openai-codex/gpt-5.4-mini',
        'openrouter/free'
    )
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

function Invoke-OpenClaw {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $quoted = $Arguments | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\\"') + '"'
        }
        else {
            $_
        }
    }
    $command = 'openclaw ' + ($quoted -join ' ')
    & $dockerExe exec $ContainerName sh -lc $command | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Falló: $command"
    }
}

function Invoke-OpenClawAllowFailure {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $quoted = $Arguments | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\\"') + '"'
        }
        else {
            $_
        }
    }
    $command = 'openclaw ' + ($quoted -join ' ')
    & $dockerExe exec $ContainerName sh -lc $command | Out-Host
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

. (Join-Path $scriptDir 'lib\routing-models.ps1')

$dockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null

& $dockerExe ps --format '{{.Names}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker no está disponible. Inicia Docker Desktop y vuelve a ejecutar el script.'
}

$isRunning = (& $dockerExe inspect -f '{{.State.Running}}' $ContainerName 2>$null)
if ($LASTEXITCODE -ne 0 -or $isRunning.Trim() -ne 'true') {
    throw "El contenedor '$ContainerName' no está corriendo. Ejecuta scripts/start-academic.ps1 primero."
}

Write-Host 'Aplicando política de enrutado de modelos...' -ForegroundColor Cyan

Invoke-OpenClaw -Arguments @('models', 'set', $PrimaryModel)
Invoke-OpenClaw -Arguments @('models', 'fallbacks', 'clear')

foreach ($model in $FallbackModels) {
    Invoke-OpenClaw -Arguments @('models', 'fallbacks', 'add', $model)
}

foreach ($alias in @('fast', 'standard', 'deep', 'fallback', 'simple', 'cheap', 'pro', 'backup', 'emergency')) {
    Invoke-OpenClawAllowFailure -Arguments @('models', 'aliases', 'remove', $alias)
}

Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'fast', $ROUTE_FAST)
Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'standard', $PrimaryModel)
Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'deep', $ROUTE_DEEP)
Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'fallback', $ROUTE_FALLBACK)

Write-Host ''
Write-Host 'Política aplicada.' -ForegroundColor Green
Write-Host 'Resumen de estado:' -ForegroundColor Cyan
Invoke-OpenClaw -Arguments @('models', 'status')

Write-Host ''
Write-Host 'Uso recomendado:' -ForegroundColor Cyan
Write-Host '- Consultas simples: /model fast' -ForegroundColor Gray
Write-Host '- Ruta normal: /model standard' -ForegroundColor Gray
Write-Host '- Análisis/código complejo: /model deep' -ForegroundColor Gray
Write-Host '- El fallback automático usa:' -ForegroundColor Gray
foreach ($model in $FallbackModels) {
    Write-Host ("  - {0}" -f $model) -ForegroundColor Gray
}

