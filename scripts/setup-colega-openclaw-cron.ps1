param(
    [Parameter()][string]$ChannelId,
    [Parameter()][switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$runtimeEnv = Join-Path $repoRoot 'secrets\runtime\colega.env'
$routeFile = Join-Path $repoRoot 'logs\runtime\slack-routes\colega.json'
$stateDir = Join-Path $repoRoot 'logs\runtime\routines'
$stateFile = Join-Path $stateDir 'colega-openclaw-cron.json'

function Read-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $result = @{}
    if (-not (Test-Path $Path)) {
        return $result
    }
    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }
        $index = $trimmed.IndexOf('=')
        if ($index -lt 1) {
            continue
        }
        $result[$trimmed.Substring(0, $index)] = $trimmed.Substring($index + 1)
    }
    return $result
}

if ([string]::IsNullOrWhiteSpace($ChannelId)) {
    $env = Read-EnvFile -Path $runtimeEnv
    if ($env.ContainsKey('SLACK_CHANNEL_ID')) {
        $ChannelId = $env['SLACK_CHANNEL_ID']
    }
}

if ([string]::IsNullOrWhiteSpace($ChannelId) -and (Test-Path $routeFile)) {
    try {
        $route = Get-Content -Path $routeFile -Raw | ConvertFrom-Json
        $ChannelId = [string]$route.channel
    }
    catch {
        $ChannelId = ''
    }
}

if ([string]::IsNullOrWhiteSpace($ChannelId)) {
    throw 'No encontré canal Slack para Colega. Configura SLACK_CHANNEL_ID o habla una vez con Colega por Slack para guardar el último canal.'
}

$jobs = @(
    @{
        name = 'Colega Morning Conversation'
        cron = '5 8 * * *'
        session = 'session:colega-morning'
        message = 'Rutina de mañana de Colega para Primary User. Saluda, conversa sobre el plan académico del día, propone prioridades útiles, revisa memoria y ofrece una mejora grande para aprobación. Usa America/Bogota.'
    },
    @{
        name = 'Colega Nightly Conversation'
        cron = '30 21 * * *'
        session = 'session:colega-nightly'
        message = 'Rutina nocturna de Colega para Primary User. Cierra el día académico de forma conversacional, pregunta avances/bloqueos, consolida memoria importante y prepara la mañana siguiente. Usa America/Bogota.'
    },
    @{
        name = 'Colega Sunday Roundtable'
        cron = '0 17 * * 0'
        session = 'session:colega-sunday'
        message = 'Reunión dominical de Colega. Prepara insumos académicos amplios: docencia, investigación, papers, congresos, convocatorias, reputación y prioridades de la semana. Usa America/Bogota.'
    }
)

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

$commands = foreach ($job in $jobs) {
    @(
        'exec',
        'colega',
        'openclaw',
        'cron',
        'add',
        '--name', $job.name,
        '--cron', $job.cron,
        '--tz', 'America/Bogota',
        '--session', $job.session,
        '--message', $job.message,
        '--announce',
        '--channel', 'slack',
        '--to', ("channel:{0}" -f $ChannelId),
        '--exact'
    )
}

if (-not $Apply) {
    Write-Host 'Comandos que se aplicarán con -Apply:' -ForegroundColor Cyan
    foreach ($job in $jobs) {
        Write-Host ("- {0}: {1} America/Bogota -> channel:{2}" -f $job.name, $job.cron, $ChannelId) -ForegroundColor Gray
    }
    Write-Host ''
    Write-Host 'Cuando quieras crear los cron nativos:' -ForegroundColor Cyan
    Write-Host '.\scripts\setup-colega-openclaw-cron.ps1 -Apply'
    @{
        configured = $false
        channel = $ChannelId
        jobs = $jobs
        updatedAt = (Get-Date).ToString('o')
        note = 'Preview only. Run with -Apply to create OpenClaw cron jobs.'
    } | ConvertTo-Json -Depth 5 | Set-Content -Path $stateFile -Encoding utf8
    exit 0
}

foreach ($job in $jobs) {
    Write-Host ("Creando cron OpenClaw: {0}" -f $job.name) -ForegroundColor Cyan
    & docker exec colega openclaw cron add `
        --name $job.name `
        --cron $job.cron `
        --tz America/Bogota `
        --session $job.session `
        --message $job.message `
        --announce `
        --channel slack `
        --to ("channel:{0}" -f $ChannelId) `
        --exact
    if ($LASTEXITCODE -ne 0) {
        throw ("Fallo creando cron OpenClaw: {0}" -f $job.name)
    }
}

$listOutput = & docker exec colega openclaw cron list

@{
    configured = $true
    channel = $ChannelId
    jobs = $jobs
    updatedAt = (Get-Date).ToString('o')
    listPreview = ($listOutput -join "`n")
} | ConvertTo-Json -Depth 5 | Set-Content -Path $stateFile -Encoding utf8

Write-Host 'Cron nativos de Colega configurados.' -ForegroundColor Green
Write-Host 'Sugerencia: si las pruebas llegan a Slack, define COLEGA_SLACK_MODE=native y COLEGA_ROUTINE_MODE=native en .env para apagar el fallback del bridge.' -ForegroundColor Yellow

