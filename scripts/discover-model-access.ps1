param(
    [Parameter()][switch]$RunProbes,
    [Parameter()][switch]$Json,
    [string]$ColegaContainer   = ($env:OPENCLAW_CONTAINER_NAME ?? 'colega'),
    [string]$PersonalContainer = ($env:PERSONAL_CONTAINER_NAME ?? 'personal'),
    [string]$DaemonContainer   = ($env:DAEMON_CONTAINER_NAME  ?? 'business_agent_daemon')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ToolPath {
    param([Parameter(Mandatory = $true)][string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Invoke-DockerText {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter()][int]$TimeoutSeconds = 90
    )

    if (-not $script:DockerExe) {
        return [pscustomobject]@{ Ok = $false; Output = 'Docker CLI no encontrado.' }
    }

    try {
        $output = & $script:DockerExe @Arguments 2>&1 | ForEach-Object { $_.ToString() }
        $exitCode = $LASTEXITCODE
        return [pscustomobject]@{ Ok = ($exitCode -eq 0); Output = (($output -join "`n").Trim()) }
    }
    catch {
        return [pscustomobject]@{ Ok = $false; Output = $_.Exception.Message }
    }
}

function Show-Section {
    param([Parameter(Mandatory = $true)][string]$Title)
    Write-Host ''
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Show-ProbeResult {
    param(
        [Parameter(Mandatory = $true)][string]$Model,
        [Parameter(Mandatory = $true)]$Result
    )

    $text = [string]$Result.Output
    if ($Result.Ok -and $text -match 'OK') {
        Write-Host ("OK        {0}" -f $Model) -ForegroundColor Green
        return
    }

    if ($text -match '(429|rate|quota|limit|budget|Too Many Requests)') {
        Write-Host ("LIMITADO  {0}  ({1})" -f $Model, (($text -split "`r?`n")[0])) -ForegroundColor Yellow
        return
    }

    if ($text -match '(not found|unknown|invalid|not available|not supported|permission|unauthorized|forbidden|login)') {
        Write-Host ("NO        {0}  ({1})" -f $Model, (($text -split "`r?`n")[0])) -ForegroundColor Red
        return
    }

    if ($Result.Ok) {
        Write-Host ("OK?       {0}  ({1})" -f $Model, (($text -split "`r?`n")[0])) -ForegroundColor Green
    }
    else {
        Write-Host ("FALLO     {0}  ({1})" -f $Model, (($text -split "`r?`n")[0])) -ForegroundColor Yellow
    }
}

function Get-ProbeStatus {
    param([Parameter(Mandatory = $true)]$Result)

    $text = [string]$Result.Output
    if ($Result.Ok -and $text -match 'OK') { return 'ok' }
    if ($text -match '(429|rate|quota|limit|budget|Too Many Requests)') { return 'limited' }
    if ($text -match '(deprecated|end-of-life)') { return 'deprecated' }
    if ($text -match '(not found|unknown|invalid|not available|not supported|permission|unauthorized|forbidden|login|may not exist|do not have access)') { return 'no_access' }
    if ($Result.Ok) { return 'ok' }
    return 'failed'
}

function Get-FirstLine {
    param([Parameter()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
    return (($Text -split "`r?`n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
}

function New-ModelRecord {
    param(
        [Parameter(Mandatory = $true)][string]$Agent,
        [Parameter(Mandatory = $true)][string]$Provider,
        [Parameter(Mandatory = $true)][string]$Model,
        [Parameter(Mandatory = $true)][string]$Phase,
        [Parameter(Mandatory = $true)][string]$Status,
        [Parameter()][string]$Notes = ''
    )

    return [pscustomobject]@{
        agent = $Agent
        provider = $Provider
        model = $Model
        phase = $Phase
        status = $Status
        notes = $Notes
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$script:DockerExe = Resolve-ToolPath -Name 'docker'

$claudeModels = @(
    'default',
    'opusplan',
    'opus',
    'sonnet',
    'haiku',
    'claude-opus-4-1-20250805',
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest'
)

$geminiModels = @(
    'auto',
    'pro',
    'flash',
    'flash-lite',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
)

$openClawProvider = 'openai-codex'

$records = [System.Collections.Generic.List[object]]::new()
$events = [System.Collections.Generic.List[object]]::new()
$records.Add((New-ModelRecord -Agent 'colega' -Provider 'openai-codex' -Model 'openai-codex/gpt-5.4-mini' -Phase 'fast' -Status 'listed' -Notes 'Ruta rapida recomendada para Colega.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'colega' -Provider 'openai-codex' -Model 'openai-codex/gpt-5.4' -Phase 'standard' -Status 'listed' -Notes 'Modelo fuerte confirmado por probe de provider.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'colega' -Provider 'openai-codex' -Model 'openai-codex/gpt-5.3-codex' -Phase 'deep' -Status 'listed' -Notes 'Candidato comparativo para tareas profundas.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'colega' -Provider 'openai-codex' -Model 'openai-codex/gpt-5.2-codex' -Phase 'deep' -Status 'listed' -Notes 'Candidato comparativo para respaldo profundo.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'coach' -Provider 'claude-oauth' -Model 'haiku' -Phase 'fast' -Status 'candidate' -Notes 'Rapido/simple por OAuth de Claude Code.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'coach' -Provider 'claude-oauth' -Model 'sonnet' -Phase 'standard' -Status 'candidate' -Notes 'Trabajo normal serio.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'coach' -Provider 'claude-oauth' -Model 'opus' -Phase 'deep' -Status 'candidate' -Notes 'Razonamiento dificil.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'coach' -Provider 'claude-oauth' -Model 'opusplan' -Phase 'planning' -Status 'candidate' -Notes 'Planificacion grande: Opus planea y Sonnet ejecuta.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'coach' -Provider 'claude-oauth' -Model 'claude-3-7-sonnet-latest' -Phase 'fallback' -Status 'deprecated' -Notes 'No usar: deprecated.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'coach' -Provider 'claude-oauth' -Model 'claude-3-5-haiku-latest' -Phase 'fallback' -Status 'no_access' -Notes 'No usar: fallo por acceso/modelo.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'socio' -Provider 'gemini-cli' -Model 'gemini-2.5-flash-lite' -Phase 'fast' -Status 'candidate' -Notes 'Rapido/economico estable para Socio.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'socio' -Provider 'gemini-cli' -Model 'gemini-2.5-flash' -Phase 'standard' -Status 'candidate' -Notes 'Ruta normal estable para Socio.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'socio' -Provider 'gemini-cli' -Model 'gemini-2.5-pro' -Phase 'deep' -Status 'candidate' -Notes 'Razonamiento avanzado estable.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'socio' -Provider 'gemini-cli' -Model 'gemini-3-pro-preview' -Phase 'experimental' -Status 'experimental' -Notes 'Solo manual por ser preview.')) | Out-Null
$records.Add((New-ModelRecord -Agent 'socio' -Provider 'gemini-cli' -Model 'gemini-3-flash-preview' -Phase 'experimental' -Status 'experimental' -Notes 'Solo manual por ser preview.')) | Out-Null

function Set-RecordStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Provider,
        [Parameter(Mandatory = $true)][string]$Model,
        [Parameter(Mandatory = $true)][string]$Status,
        [Parameter()][string]$Notes
    )

    foreach ($record in $records) {
        if ($record.provider -eq $Provider -and $record.model -eq $Model) {
            $record.status = $Status
            if (-not [string]::IsNullOrWhiteSpace($Notes)) {
                $record.notes = $Notes
            }
        }
    }
}

if (-not $Json) {
    Write-Host 'Descubrimiento de modelos disponibles' -ForegroundColor Green
    Write-Host "Repositorio: $repoRoot" -ForegroundColor Gray
    Write-Host ("Probes reales: {0}" -f ($(if ($RunProbes) { 'ACTIVOS' } else { 'NO, solo listas/help' }))) -ForegroundColor Gray
}

if (-not $Json) { Show-Section 'Docker' }
$docker = Invoke-DockerText -Arguments @('ps', '--format', '{{.Names}}\t{{.Status}}')
if ($docker.Ok) {
    if (-not $Json) { Write-Host $docker.Output }
}
else {
    $events.Add([pscustomobject]@{ severity = 'warning'; message = "Docker no disponible: $(Get-FirstLine $docker.Output)" }) | Out-Null
    if (-not $Json) {
        Write-Host "Docker no disponible: $($docker.Output)" -ForegroundColor Yellow
        Write-Host 'Ejecuta desde PowerShell normal/administrador si Docker Desktop bloquea esta terminal.' -ForegroundColor Yellow
    }
}

if (-not $Json) { Show-Section 'Colega / OpenClaw-Codex' }
if ($docker.Ok) {
    $openClawStatus = Invoke-DockerText -Arguments @('exec', $ColegaContainer, 'sh', '-lc', 'openclaw models status || true')
    if ($openClawStatus.Output -and -not $Json) { Write-Host $openClawStatus.Output }

    if ($RunProbes) {
        if (-not $Json) {
            Write-Host ''
            Write-Host 'Probe real de auth OpenClaw/OpenAI Codex:' -ForegroundColor Gray
        }
        $openClawProbe = Invoke-DockerText -Arguments @('exec', $ColegaContainer, 'sh', '-lc', "openclaw models status --probe --probe-provider $openClawProvider --probe-timeout 60000 --probe-max-tokens 8 || openclaw models status --probe --probe-timeout 60000 --probe-max-tokens 8 || true") -TimeoutSeconds 120
        if ($openClawProbe.Output -and -not $Json) { Write-Host $openClawProbe.Output }
        if ($openClawProbe.Output -match 'openai-codex/gpt-5.4.*ok') {
            Set-RecordStatus -Provider 'openai-codex' -Model 'openai-codex/gpt-5.4' -Status 'ok' -Notes 'Probe real OK via OAuth OpenAI Codex.'
        }
    }

    $openClawList = Invoke-DockerText -Arguments @('exec', $ColegaContainer, 'sh', '-lc', "openclaw models list --all --provider $openClawProvider --plain || openclaw models list --provider $openClawProvider --plain || openclaw models list --plain || openclaw models list || true")
    if ($openClawList.Output) {
        if (-not $Json) {
            Write-Host ''
            Write-Host 'Modelos reportados por OpenClaw para openai-codex:' -ForegroundColor Gray
            Write-Host $openClawList.Output
        }
        foreach ($line in ($openClawList.Output -split "`r?`n")) {
            if ($line -match '^openai-codex/') {
                $phase = if ($line -match 'mini') { 'fast' } elseif ($line -match 'codex|max') { 'deep' } else { 'standard' }
                $exists = $false
                foreach ($record in $records) {
                    if ($record.provider -eq 'openai-codex' -and $record.model -eq $line.Trim()) { $exists = $true }
                }
                if (-not $exists) {
                    $records.Add((New-ModelRecord -Agent 'colega' -Provider 'openai-codex' -Model $line.Trim() -Phase $phase -Status 'listed' -Notes 'Reportado por OpenClaw.')) | Out-Null
                }
            }
        }
    }
    else {
        $events.Add([pscustomobject]@{ severity = 'warning'; message = 'No hubo salida de openclaw models list.' }) | Out-Null
        if (-not $Json) { Write-Host 'No hubo salida de openclaw models list. Si colega.env esta vacio, corre scripts/start-academic.ps1 primero.' -ForegroundColor Yellow }
    }
}
else {
    if (-not $Json) { Write-Host 'Omitido porque Docker no esta disponible.' -ForegroundColor Yellow }
}

if (-not $Json) { Show-Section 'Coach / Claude OAuth' }
if ($docker.Ok) {
    $claudeVersion = Invoke-DockerText -Arguments @('exec', $PersonalContainer, 'bash', '-lc', 'claude --version || true')
    if ($claudeVersion.Output -and -not $Json) { Write-Host $claudeVersion.Output }
}
else {
    if (-not $Json) { Write-Host 'Omitido porque Docker no esta disponible.' -ForegroundColor Yellow }
}

if ($RunProbes -and $docker.Ok) {
    foreach ($model in $claudeModels) {
        $cmd = "timeout 75s claude -p 'Respond exactly: OK' --model '$model' --max-budget-usd 0.08"
        $result = Invoke-DockerText -Arguments @('exec', $PersonalContainer, 'bash', '-lc', $cmd) -TimeoutSeconds 90
        $status = Get-ProbeStatus -Result $result
        Set-RecordStatus -Provider 'claude-oauth' -Model $model -Status $status -Notes (Get-FirstLine $result.Output)
        if (-not $Json) { Show-ProbeResult -Model $model -Result $result }
    }
}
else {
    if (-not $Json) {
        Write-Host 'Candidatos a probar con -RunProbes:' -ForegroundColor Gray
        $claudeModels | ForEach-Object { Write-Host "- $_" }
    }
}

if (-not $Json) { Show-Section 'Socio / Gemini CLI' }
if ($docker.Ok) {
    $geminiVersion = Invoke-DockerText -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'gemini --version || true')
    if ($geminiVersion.Output -and -not $Json) { Write-Host $geminiVersion.Output }
}
else {
    if (-not $Json) { Write-Host 'Omitido porque Docker no esta disponible.' -ForegroundColor Yellow }
}

if ($RunProbes -and $docker.Ok) {
    foreach ($model in $geminiModels) {
        $cmd = "printf 'Respond exactly: OK\n' | timeout 75s gemini --model '$model'"
        $result = Invoke-DockerText -Arguments @('exec', $DaemonContainer, 'sh', '-lc', $cmd) -TimeoutSeconds 90
        $status = Get-ProbeStatus -Result $result
        Set-RecordStatus -Provider 'gemini-cli' -Model $model -Status $status -Notes (Get-FirstLine $result.Output)
        if (-not $Json) { Show-ProbeResult -Model $model -Result $result }
    }
}
else {
    if (-not $Json) {
        Write-Host 'Candidatos a probar con -RunProbes:' -ForegroundColor Gray
        $geminiModels | ForEach-Object { Write-Host "- $_" }
    }
}

if ($Json) {
    [pscustomobject]@{
        generatedAt = (Get-Date).ToString('o')
        probesRun = [bool]$RunProbes
        dockerAvailable = [bool]$docker.Ok
        models = @($records)
        events = @($events)
    } | ConvertTo-Json -Depth 8
}
else {
    Write-Host ''
    Write-Host 'Descubrimiento completado.' -ForegroundColor Green
}

