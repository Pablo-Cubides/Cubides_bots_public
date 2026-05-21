param(
    [Parameter()][switch]$PurgeActiveRuntime
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$runtimeDir = Join-Path $repoRoot 'secrets\runtime'

if (-not (Test-Path $runtimeDir)) {
    Write-Host 'No existe secrets/runtime. Nada por limpiar.' -ForegroundColor Yellow
    exit 0
}

$legacyFiles = @(
    'academic_agent.env',
    'openclaw.env'
)

$removed = 0
foreach ($name in $legacyFiles) {
    $path = Join-Path $runtimeDir $name
    if (Test-Path $path) {
        Remove-Item -Path $path -Force
        Write-Host ("Eliminado legacy: secrets/runtime/{0}" -f $name) -ForegroundColor Green
        $removed++
    }
}

if ($PurgeActiveRuntime) {
    $activeFiles = @(
        'colega.env',
        'personal.env',
        'business.env'
    )

    foreach ($name in $activeFiles) {
        $path = Join-Path $runtimeDir $name
        if (Test-Path $path) {
            Remove-Item -Path $path -Force
            Write-Host ("Eliminado runtime activo: secrets/runtime/{0}" -f $name) -ForegroundColor Yellow
            $removed++
        }
    }

    Write-Host 'Runtime activo purgado. Reejecuta scripts/start-*.ps1 para regenerar envs.' -ForegroundColor Yellow
}

if ($removed -eq 0) {
    Write-Host 'No se encontraron archivos para limpiar.' -ForegroundColor Gray
}

