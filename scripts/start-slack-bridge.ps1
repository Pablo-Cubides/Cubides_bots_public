param(
    [Parameter()][switch]$Detached,
    [Parameter()][switch]$Stop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ToolPath {
    param(
        [Parameter(Mandatory = $true)][string]$PrimaryName,
        [Parameter()][string]$FallbackPath
    )

    $cmd = Get-Command $PrimaryName -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    if ($FallbackPath -and (Test-Path $FallbackPath)) {
        return $FallbackPath
    }

    throw "No se encontró la herramienta '$PrimaryName'."
}

function Resolve-NodePath {
    $fallback = 'D:\Programas\node.exe'
    if (Test-Path $fallback) {
        return $fallback
    }

    $cmd = Get-Command 'node' -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    throw "No se encontró la herramienta 'node'."
}

function Resolve-NpmCliPath {
    $fallback = 'D:\Programas\node_modules\npm\bin\npm-cli.js'
    if (Test-Path $fallback) {
        return $fallback
    }

    $cmd = Get-Command 'npm' -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -like '*.js') {
        return $cmd.Source
    }

    throw "No se encontró npm-cli.js. Instala npm o ajusta scripts/start-slack-bridge.ps1."
}

function Invoke-NpmInstall {
    param(
        [Parameter(Mandatory = $true)][string]$NpmPath,
        [Parameter(Mandatory = $true)][string]$NodePath
    )

    & $NodePath $NpmPath install --no-audit --no-fund
}

$originalLocation = Get-Location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$bridgeDir = Join-Path $repoRoot 'slack_bridge'
$logDir = Join-Path $repoRoot 'logs'
$logFile = Join-Path $logDir 'slack-bridge.log'
$pidFile = Join-Path $repoRoot '.tmp\slack-bridge.pid'

if (-not (Test-Path $bridgeDir)) {
    throw 'No existe slack_bridge.'
}

$npmExe = Resolve-NpmCliPath
$nodeExe = Resolve-NodePath

function Get-BridgeProcessIds {
    $ids = @()

    if (Test-Path $pidFile) {
        $rawPid = (Get-Content -Path $pidFile -Raw).Trim()
        if ($rawPid -match '^\d+$') {
            $process = Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
            if ($process) {
                $ids += [int]$rawPid
            }
            else {
                Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
            }
        }
    }

    return $ids | Select-Object -Unique
}

$runningIds = @(Get-BridgeProcessIds)

if ($Stop) {
    if ($runningIds.Count -eq 0) {
        Write-Host 'Slack Bridge no estaba corriendo.' -ForegroundColor Yellow
        exit 0
    }

    foreach ($processId in $runningIds) {
        Stop-Process -Id $processId -Force
        Write-Host ("Slack Bridge detenido (PID {0})." -f $processId) -ForegroundColor Green
    }
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    exit 0
}

if ($runningIds.Count -gt 0) {
    foreach ($processId in $runningIds) {
        Write-Host ("Slack Bridge ya esta activo (PID {0})." -f $processId) -ForegroundColor Green
    }
    exit 0
}

if (-not (Test-Path (Join-Path $bridgeDir 'node_modules'))) {
    Write-Host 'Instalando dependencias de Slack Bridge...' -ForegroundColor Cyan
    Push-Location $bridgeDir
    try {
        Invoke-NpmInstall -NpmPath $npmExe -NodePath $nodeExe
        if ($LASTEXITCODE -ne 0) {
            throw 'Falló npm install para slack_bridge.'
        }
    }
    finally {
        Pop-Location
    }
}

if ($Detached) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    New-Item -ItemType Directory -Force -Path (Split-Path $pidFile -Parent) | Out-Null
    $command = "Set-Location '$bridgeDir'; & '$nodeExe' '.\src\index.js' *>> '$logFile'"
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $process.Id -Encoding UTF8 -NoNewline
    Write-Host ("Slack Bridge iniciado en segundo plano (launcher PID {0})." -f $process.Id) -ForegroundColor Green
    Write-Host ("Logs: {0}" -f $logFile) -ForegroundColor Gray
    exit 0
}

Write-Host 'Slack Bridge activo. Ctrl+C para detener.' -ForegroundColor Green
Push-Location $bridgeDir
try {
    & $nodeExe .\src\index.js
}
finally {
    Pop-Location
    Set-Location $originalLocation
}


