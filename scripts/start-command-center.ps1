param(
    [Parameter()][int]$Port = 3100,
    [Parameter()][switch]$StartAgents,
    [Parameter()][switch]$StartSlackBridge,
    [Parameter()][switch]$StartRoutineOrchestrator,
    [Parameter()][switch]$NoBrowser,
    [Parameter()][switch]$RequireDocker,
    [Parameter()][switch]$NoPause,
    [Parameter()][switch]$DetachedDashboard,
    [Parameter()][int]$DockerTimeoutSeconds = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$dashboardUrl = "http://127.0.0.1:$Port"
$logDir = Join-Path $repoRoot 'logs'
$tmpDir = Join-Path $repoRoot '.tmp'
$dashboardLog = Join-Path $logDir 'dashboard.log'
$commandCenterLog = Join-Path $logDir 'command-center.log'
$dashboardPid = Join-Path $tmpDir 'dashboard.pid'

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ("[Centro] {0}" -f $Message) -ForegroundColor Cyan
}

function Test-DockerReady {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & docker info 2>&1
        $exitCode = $LASTEXITCODE
        return ($exitCode -eq 0)
    }
    catch {
        return $false
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Start-DockerDesktopIfNeeded {
    if (Test-DockerReady) {
        Write-Step 'Docker ya esta listo.'
        return
    }

    $candidates = @(@(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    ) | Where-Object { $_ -and (Test-Path $_) })

    if ($candidates.Count -eq 0) {
        throw 'Docker no responde y no encontre Docker Desktop.exe. Abre Docker Desktop manualmente y reintenta.'
    }

    Write-Step 'Abriendo Docker Desktop...'
    Start-Process -FilePath $candidates[0] | Out-Null

    $deadline = (Get-Date).AddSeconds($DockerTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3
        if (Test-DockerReady) {
            Write-Step 'Docker quedo listo.'
            return
        }
    }

    $message = "Docker Desktop no quedo listo en $DockerTimeoutSeconds segundos."
    if ($RequireDocker) {
        throw $message
    }
    Write-Host ("[Centro] {0} El dashboard se abrira de todos modos." -f $message) -ForegroundColor Yellow
}

function Test-DashboardRunning {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $dashboardUrl -TimeoutSec 2
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    }
    catch {
        return $false
    }
}

try {
    New-Item -ItemType Directory -Force -Path $logDir, $tmpDir | Out-Null
    Start-Transcript -Path $commandCenterLog -Append | Out-Null
    Set-Location $repoRoot

    Start-DockerDesktopIfNeeded

    if ($StartAgents) {
        if (-not (Test-DockerReady)) {
            Write-Host '[Centro] No levanto agentes porque Docker aun no esta listo.' -ForegroundColor Yellow
        }
        else {
            Write-Step 'Levantando agentes base...'
            & (Join-Path $repoRoot 'scripts\start-academic.ps1')
            & (Join-Path $repoRoot 'scripts\start-personal.ps1') -NoAttach
            & (Join-Path $repoRoot 'scripts\start-business.ps1') -NoBuild
        }
    }

    if ($StartSlackBridge) {
        Write-Step 'Activando Slack Bridge en segundo plano...'
        & (Join-Path $repoRoot 'scripts\start-slack-bridge.ps1') -Detached
    }

    if ($StartRoutineOrchestrator) {
        Write-Step 'Activando Routine Orchestrator en segundo plano...'
        & (Join-Path $repoRoot 'scripts\start-routine-orchestrator.ps1') -Detached
    }

    if (Test-DashboardRunning) {
        Write-Step "Centro de Mando ya esta activo en $dashboardUrl"
    }
else {
    Write-Step "Iniciando Centro de Mando en $dashboardUrl"
        if ($DetachedDashboard) {
            $command = "Set-Location '$repoRoot'; & '.\scripts\start-dashboard.ps1' -Port $Port -Dev *>> '$dashboardLog'"
            $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) -WindowStyle Normal -PassThru
            try {
                Set-Content -Path $dashboardPid -Value $process.Id
            }
            catch {
                Write-Host ("[Centro] No pude guardar dashboard.pid: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
            }
            Write-Step ("Centro de Mando lanzado en segundo plano (PID {0}). Logs: {1}" -f $process.Id, $dashboardLog)

            $deadline = (Get-Date).AddSeconds(45)
            while ((Get-Date) -lt $deadline) {
                Start-Sleep -Seconds 2
                if (Test-DashboardRunning) {
                    break
                }
            }
        }

        if (-not $DetachedDashboard) {
            if (-not $NoBrowser) {
                $watcher = @"
`$url = '$dashboardUrl'
for (`$i = 0; `$i -lt 90; `$i++) {
    try {
        `$response = Invoke-WebRequest -UseBasicParsing -Uri `$url -TimeoutSec 2
        if (`$response.StatusCode -ge 200 -and `$response.StatusCode -lt 500) {
            Start-Process `$url
            exit 0
        }
    }
    catch {}
    Start-Sleep -Seconds 2
}
"@
                Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $watcher) -WindowStyle Hidden | Out-Null
            }
            Write-Host ''
            Write-Host 'El Centro de Mando queda corriendo en esta ventana. Cierra esta ventana solo cuando quieras apagar la interfaz.' -ForegroundColor Green
            & (Join-Path $repoRoot 'scripts\start-dashboard.ps1') -Port $Port -Dev
            return
        }
    }

    if ($DetachedDashboard -and -not $NoBrowser) {
        Start-Process $dashboardUrl | Out-Null
    }

    Write-Host ''
    Write-Host 'Listo.' -ForegroundColor Green
    Write-Host ("Centro de Mando: {0}" -f $dashboardUrl)
    Write-Host 'Desde la interfaz puedes usar "Levantar todos", "Slack Bridge: activar" y "Rutinas: activar".'
}
catch {
    Write-Host ''
    Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ("Log: {0}" -f $commandCenterLog) -ForegroundColor Yellow
    throw
}
finally {
    Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
    if (-not $NoPause) {
        Write-Host ''
        Read-Host 'Presiona Enter para cerrar'
    }
}

