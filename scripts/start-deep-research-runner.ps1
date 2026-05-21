param(
    [Parameter()][switch]$Detached,
    [Parameter()][switch]$Stop,
    [Parameter()][switch]$Once
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
$runner = Join-Path $repoRoot 'agent_tools\deep_research_runner.mjs'
$runtimeDir = Join-Path $repoRoot '.tmp\deep-research'
$pidFile = Join-Path $runtimeDir 'runner.pid'
$logDir = Join-Path $repoRoot 'logs'
$logFile = Join-Path $logDir 'deep-research-runner.log'
$processLogFile = Join-Path $logDir 'deep-research-runner.process.log'
$processErrFile = Join-Path $logDir 'deep-research-runner.stderr.log'

if (-not (Test-Path $runner)) {
    throw 'No existe agent_tools/deep_research_runner.mjs'
}

function Get-RunnerProcessIds {
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
    $runnerPath = [System.IO.Path]::GetFullPath($runner)
    $escapedRunnerPath = [regex]::Escape($runnerPath)
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match $escapedRunnerPath }
    foreach ($process in $processes) {
        if ($process.ProcessId) {
            $ids += [int]$process.ProcessId
        }
    }
    return $ids | Select-Object -Unique
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$runningIds = @(Get-RunnerProcessIds)

if ($Stop) {
    if ($runningIds.Count -eq 0) {
        Write-Host 'Deep Research Runner no estaba corriendo.' -ForegroundColor Yellow
        exit 0
    }
    foreach ($processId in $runningIds) {
        Stop-Process -Id $processId -Force
        Write-Host ("Deep Research Runner detenido (PID {0})." -f $processId) -ForegroundColor Green
    }
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    exit 0
}

if ($Once) {
    & $nodeExe $runner --once
    exit $LASTEXITCODE
}

if ($runningIds.Count -gt 0) {
    foreach ($processId in $runningIds) {
        Write-Host ("Deep Research Runner ya esta activo (PID {0})." -f $processId) -ForegroundColor Green
    }
    exit 0
}

if ($Detached) {
    $process = Start-Process `
        -FilePath $nodeExe `
        -ArgumentList @($runner) `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $processLogFile `
        -RedirectStandardError $processErrFile `
        -PassThru
    [System.IO.File]::WriteAllText($pidFile, [string]$process.Id, [System.Text.UTF8Encoding]::new($false))
    Write-Host ("Deep Research Runner iniciado en segundo plano (PID {0})." -f $process.Id) -ForegroundColor Green
    Write-Host ("Logs: {0}" -f $logFile) -ForegroundColor Gray
    Write-Host ("Process log: {0}" -f $processLogFile) -ForegroundColor Gray
    Write-Host ("Process stderr: {0}" -f $processErrFile) -ForegroundColor Gray
    exit 0
}

Write-Host 'Deep Research Runner activo. Ctrl+C para detener.' -ForegroundColor Green
Set-Location $repoRoot
& $nodeExe $runner

