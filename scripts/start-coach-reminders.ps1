param(
    [switch]$Detached,
    [switch]$Stop,
    [switch]$Once
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$runtimeDir = Join-Path $repoRoot 'logs\runtime\coach-reminders'
$pidFile = Join-Path $runtimeDir 'coach-reminders.pid'
$logFile = Join-Path $repoRoot 'logs\coach-reminders.log'
$runner = Join-Path $repoRoot 'agent_tools\coach_reminders.mjs'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Get-NodePath {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw 'No se encontró node en PATH.'
}

function Get-ExistingProcessId {
    if (-not (Test-Path $pidFile)) { return $null }
    $raw = (Get-Content $pidFile -Raw).Trim()
    if (-not $raw) { return $null }
    try {
        $pidValue = [int]$raw
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($process) { return $pidValue }
    } catch {
        return $null
    }
    return $null
}

if ($Stop) {
    $pidValue = Get-ExistingProcessId
    if ($pidValue) {
        Stop-Process -Id $pidValue -Force
        Write-Host ("Coach reminders detenido (PID {0})." -f $pidValue) -ForegroundColor Green
    } else {
        Write-Host 'Coach reminders no estaba corriendo.' -ForegroundColor Yellow
    }
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force }
    return
}

$existing = Get-ExistingProcessId
if ($existing -and -not $Once) {
    Write-Host ("Coach reminders ya está activo (PID {0})." -f $existing) -ForegroundColor Green
    return
}

$node = Get-NodePath
$argsList = @($runner)
if ($Once) { $argsList += '--once' }
$argumentString = ($argsList | ForEach-Object {
    if ($_ -match '\s') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
}) -join ' '

if ($Detached) {
    $process = Start-Process -FilePath $node -ArgumentList $argumentString -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
    Write-Host ("Coach reminders iniciado en segundo plano (launcher PID {0})." -f $process.Id) -ForegroundColor Green
    Write-Host ("Log: {0}" -f $logFile) -ForegroundColor Gray
    return
}

Write-Host 'Coach reminders activo. Ctrl+C para detener.' -ForegroundColor Green
& $node @argsList


