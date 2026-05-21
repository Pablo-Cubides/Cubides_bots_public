param(
    [Parameter()]
    [ValidateSet('all', 'colega', 'coach', 'socio')]
    [string]$Agent = 'all',

    [Parameter()]
    [ValidateSet('daily_improvement_plan', 'nightly_review', 'sunday_roundtable')]
    [string]$Routine = 'daily_improvement_plan',

    [Parameter()]
    [switch]$DryRun
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
$orchestrator = Join-Path $repoRoot 'agent_tools\routine_orchestrator.mjs'

if (-not (Test-Path $orchestrator)) {
    throw 'No existe agent_tools/routine_orchestrator.mjs'
}

$nodeExe = Resolve-NodePath
$args = @($orchestrator, '--agent', $Agent, '--routine', $Routine)
if ($DryRun) {
    $args += '--dry-run'
}

Write-Host ("Ejecutando rutina conversacional: agente={0}, rutina={1}" -f $Agent, $Routine) -ForegroundColor Cyan
& $nodeExe @args
if ($LASTEXITCODE -ne 0) {
    throw ("La rutina falló con exit code {0}" -f $LASTEXITCODE)
}


