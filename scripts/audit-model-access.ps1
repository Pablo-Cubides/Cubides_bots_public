param(
    [Parameter()][switch]$RunProbes,
    [Parameter()][switch]$ProOnly,
    [string]$ColegaContainer   = ($env:OPENCLAW_CONTAINER_NAME ?? 'colega'),
    [string]$PersonalContainer = ($env:PERSONAL_CONTAINER_NAME ?? 'personal'),
    [string]$DaemonContainer   = ($env:DAEMON_CONTAINER_NAME  ?? 'business_agent_daemon')
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

    return $null
}

function Read-EnvNames {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path $Path)) {
        return @()
    }

    return Get-Content -Path $Path |
        Where-Object { $_ -match '^[A-Za-z_][A-Za-z0-9_]*=' } |
        ForEach-Object { ($_ -split '=', 2)[0].Trim() } |
        Sort-Object -Unique
}

function Show-Section {
    param([Parameter(Mandatory = $true)][string]$Title)
    Write-Host ''
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    if (-not $script:DockerExe) {
        Write-Host 'Docker CLI no encontrado.' -ForegroundColor Yellow
        return $false
    }

    & $script:DockerExe @Arguments 2>$null
    return ($LASTEXITCODE -eq 0)
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$script:DockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null

Write-Host 'Auditoria de acceso/configuracion de modelos' -ForegroundColor Green
Write-Host "Repositorio: $repoRoot" -ForegroundColor Gray
Write-Host ("Probes externos: {0}" -f ($(if ($RunProbes) { 'ACTIVOS' } else { 'NO' }))) -ForegroundColor Gray
Write-Host ("Alcance: {0}" -f ($(if ($ProOnly) { 'PRO_ONLY' } else { 'COMPLETO' }))) -ForegroundColor Gray

Show-Section 'Secretos runtime presentes'
foreach ($fileName in @('colega.env', 'personal.env', 'business.env')) {
    $path = Join-Path $repoRoot "secrets\runtime\$fileName"
    $names = @(Read-EnvNames -Path $path)
    if ($names.Count -eq 0) {
        Write-Host ("{0}: sin variables" -f $fileName) -ForegroundColor Yellow
    }
    else {
        Write-Host ("{0}: {1}" -f $fileName, ($names -join ', ')) -ForegroundColor Gray
    }
}

Show-Section 'Configuracion declarada'
Write-Host 'Colega/OpenClaw:' -ForegroundColor Gray
Write-Host '  pro    -> primary openai-codex/gpt-5.4; fallback openrouter/google/gemma-4-26b-a4b-it; local opcional'
if (-not $ProOnly) {
    Write-Host '  normal -> primary openrouter/free; fallback openrouter/google/gemma-4-26b-a4b-it:free, openrouter/google/gemma-4-26b-a4b-it'
    Write-Host '  emergency -> actualmente openrouter/free; no es local salvo que se ajuste el script'
}
Write-Host 'Coach/Claude:' -ForegroundColor Gray
Write-Host '  Claude Code usa CLAUDE_CODE_OAUTH_TOKEN si esta presente'
if (-not $ProOnly) {
    Write-Host '  quick prompts usan OpenRouter'
    Write-Host '  ask-quick default -> google/gemma-4-26b-a4b-it:free'
}
Write-Host 'Socio/Gemini:' -ForegroundColor Gray
Write-Host '  business_agent_daemon usa GEMINI_MODEL; default compose -> gemini-2.5-pro'

Show-Section 'Docker'
$dockerAvailable = Invoke-Docker -Arguments @('ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}')
if (-not $dockerAvailable) {
    Write-Host 'No se pudo consultar Docker desde esta terminal. Ejecuta este script en PowerShell normal/administrador si hace falta.' -ForegroundColor Yellow
}

Show-Section 'Colega / OpenClaw'
if ($dockerAvailable) {
    [void](Invoke-Docker -Arguments @('exec', $ColegaContainer, 'sh', '-lc', 'openclaw models status || true'))
    [void](Invoke-Docker -Arguments @('exec', $ColegaContainer, 'sh', '-lc', 'openclaw models aliases list || true'))
    [void](Invoke-Docker -Arguments @('exec', $ColegaContainer, 'sh', '-lc', 'openclaw models list --plain || true'))
    if (-not $ProOnly) {
        [void](Invoke-Docker -Arguments @('exec', $ColegaContainer, 'sh', '-lc', 'openclaw models list --local --plain || true'))
    }
}
else {
    Write-Host 'Omitido porque Docker no esta disponible.' -ForegroundColor Yellow
}

Show-Section 'Coach / Claude'
if ($dockerAvailable) {
    [void](Invoke-Docker -Arguments @('exec', $PersonalContainer, 'bash', '-lc', 'claude --version || true'))
    if ($RunProbes) {
        [void](Invoke-Docker -Arguments @('exec', $PersonalContainer, 'bash', '-lc', "timeout 60s claude -p 'Respond exactly: OK' --max-budget-usd 0.05 || true"))
    }
    else {
        Write-Host 'Probe Claude omitido. Usa -RunProbes para enviar una llamada minima.' -ForegroundColor Gray
    }
}
else {
    Write-Host 'Omitido porque Docker no esta disponible.' -ForegroundColor Yellow
}

if (-not $ProOnly) {
    Show-Section 'OpenRouter quick'
    if ($RunProbes) {
        try {
            & (Join-Path $repoRoot 'scripts\ask-quick.ps1') -Prompt 'Respond exactly: OK' -MaxTokens 8
        }
        catch {
            Write-Host ("OpenRouter probe fallo: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
        }
    }
    else {
        Write-Host 'Probe OpenRouter omitido. Usa -RunProbes para enviar una llamada minima.' -ForegroundColor Gray
    }
}

Show-Section 'Socio / Gemini'
if ($dockerAvailable) {
    [void](Invoke-Docker -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'gemini --version || true'))
    [void](Invoke-Docker -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'printenv GEMINI_MODEL >/dev/null 2>&1 && echo GEMINI_MODEL=PRESENT || true'))
    [void](Invoke-Docker -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'printenv GOOGLE_API_KEY >/dev/null 2>&1 && echo GOOGLE_API_KEY=PRESENT || true'))
    [void](Invoke-Docker -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'printenv GEMINI_API_KEY >/dev/null 2>&1 && echo GEMINI_API_KEY=PRESENT || true'))
    [void](Invoke-Docker -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'printenv OPENROUTER_API_KEY >/dev/null 2>&1 && echo OPENROUTER_API_KEY=PRESENT || true'))
    if ($RunProbes) {
        [void](Invoke-Docker -Arguments @('exec', $DaemonContainer, 'sh', '-lc', 'MODEL=${GEMINI_MODEL:-gemini-2.5-pro}; printf "Respond exactly: OK\n" | timeout 60s gemini --model "$MODEL" || true'))
    }
    else {
        Write-Host 'Probe Gemini omitido. Usa -RunProbes para enviar una llamada minima.' -ForegroundColor Gray
    }
}
else {
    Write-Host 'Omitido porque Docker no esta disponible.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Auditoria completada.' -ForegroundColor Green


