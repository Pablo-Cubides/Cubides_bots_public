param(
    [Parameter()][switch]$Detached,
    [Parameter()][switch]$Stop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$nodeExe = Resolve-NodePath
$orchestrator = Join-Path $repoRoot 'agent_tools\routine_orchestrator.mjs'
$tmpDir = Join-Path $repoRoot 'logs\runtime\routines'
$logDir = Join-Path $repoRoot 'logs'
$logFile = Join-Path $logDir 'routine-orchestrator.log'
$stdoutFile = Join-Path $logDir 'routine-orchestrator.stdout.log'
$stderrFile = Join-Path $logDir 'routine-orchestrator.stderr.log'
$pidFile = Join-Path $tmpDir 'orchestrator.pid'
$supervisorPidFile = Join-Path $tmpDir 'orchestrator.supervisor.pid'

if (-not (Test-Path $orchestrator)) {
    throw 'No existe agent_tools/routine_orchestrator.mjs'
}

function Get-OrchestratorProcessIds {
    $ids = @()
    foreach ($file in @($pidFile, $supervisorPidFile)) {
        if (-not (Test-Path $file)) {
            continue
        }
        $rawPid = (Get-Content -Path $file -Raw).Trim()
        if ($rawPid -match '^\d+$') {
            $process = Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
            if ($process) {
                $ids += [int]$rawPid
            }
            else {
                Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
            }
        }
    }
    return $ids | Select-Object -Unique
}

$runningIds = @(Get-OrchestratorProcessIds)

if ($Stop) {
    if ($runningIds.Count -eq 0) {
        Write-Host 'Routine Orchestrator no estaba corriendo.' -ForegroundColor Yellow
        exit 0
    }

    foreach ($processId in $runningIds) {
        Stop-Process -Id $processId -Force
        Write-Host ("Routine Orchestrator detenido (PID {0})." -f $processId) -ForegroundColor Green
    }
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $supervisorPidFile -Force -ErrorAction SilentlyContinue
    exit 0
}

if ($runningIds.Count -gt 0) {
    foreach ($processId in $runningIds) {
        Write-Host ("Routine Orchestrator ya esta activo (PID {0})." -f $processId) -ForegroundColor Green
    }
    exit 0
}

New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if ($Detached) {
    Remove-Item -Path $supervisorPidFile -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $nodeExe -ArgumentList @($orchestrator, '--loop') -WorkingDirectory $repoRoot -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $process.Id -Encoding UTF8 -NoNewline
    Write-Host ("Routine Orchestrator iniciado en segundo plano (PID {0})." -f $process.Id) -ForegroundColor Green
    Write-Host ("Logs: {0}" -f $logFile) -ForegroundColor Gray
    exit 0
}

Write-Host 'Routine Orchestrator activo. Ctrl+C para detener.' -ForegroundColor Green
Set-Location $repoRoot
& $nodeExe $orchestrator --loop


