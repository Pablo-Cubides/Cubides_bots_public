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

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$invokeScript = Join-Path $repoRoot 'scripts\invoke-agent-routine.ps1'

if (-not (Test-Path $invokeScript)) {
    throw 'No existe scripts/invoke-agent-routine.ps1'
}

Write-Host 'Prueba de rutinas conversacionales' -ForegroundColor Cyan
Write-Host ("- Agente: {0}" -f $Agent) -ForegroundColor Gray
Write-Host ("- Rutina: {0}" -f $Routine) -ForegroundColor Gray
Write-Host ("- Modo: {0}" -f ($(if ($DryRun) { 'dry-run (no publica en Slack)' } else { 'real (publica en Slack si hay canal)' }))) -ForegroundColor Gray

if ($DryRun) {
    & $invokeScript -Agent $Agent -Routine $Routine -DryRun
}
else {
    & $invokeScript -Agent $Agent -Routine $Routine
}


