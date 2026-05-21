param(
    [Parameter()][switch]$NoBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $scriptDir 'start-personal.ps1'
$validateScript = Join-Path $scriptDir 'validate-personal.ps1'

if (-not (Test-Path $startScript)) {
    throw 'No existe scripts/start-personal.ps1'
}

Write-Host 'Preparando personal para Remote Control...' -ForegroundColor Cyan

$startArgs = @('-NoAttach')
if ($NoBuild) {
    $startArgs += '-NoBuild'
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $startScript @startArgs
if ($LASTEXITCODE -ne 0) {
    throw 'Falló start-personal.ps1'
}

if (Test-Path $validateScript) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $validateScript
}

Write-Host ''
Write-Host 'Iniciando Remote Control dentro del contenedor...' -ForegroundColor Cyan
Write-Host 'Si no hay OAuth token, Claude pedirá login (/login).' -ForegroundColor Yellow
& docker compose exec personal bash -lc 'claude remote-control'


