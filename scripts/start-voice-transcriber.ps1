param(
    [Parameter()][switch]$NoBuild,
    [Parameter()][switch]$Stop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-ToolPath {
    param([Parameter(Mandatory = $true)][string]$PrimaryName)
    $cmd = Get-Command $PrimaryName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw "No se encontró la herramienta '$PrimaryName'."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$dockerExe = Resolve-ToolPath -PrimaryName 'docker'

if ($Stop) {
    & $dockerExe compose stop voice_transcriber
    if ($LASTEXITCODE -ne 0) { throw 'Falló detener voice_transcriber.' }
    Write-Host 'voice_transcriber detenido.' -ForegroundColor Green
    exit 0
}

$args = @('compose', 'up', '-d')
if (-not $NoBuild) {
    $args += '--build'
}
$args += 'voice_transcriber'

& $dockerExe @args
if ($LASTEXITCODE -ne 0) {
    throw 'Falló iniciar voice_transcriber.'
}

Write-Host 'voice_transcriber activo: http://127.0.0.1:8011/health' -ForegroundColor Green
Write-Host 'Nota: la primera vez descargará el modelo Whisper configurado y puede tardar.' -ForegroundColor Gray

