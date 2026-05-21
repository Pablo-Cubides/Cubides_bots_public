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

    throw "No se encontró la herramienta '$PrimaryName'."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$dockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null

$runtimeEnv = Join-Path $repoRoot 'secrets\runtime\personal.env'
$secretFile = Join-Path $repoRoot 'secrets\personal.enc.yaml'
$keyFile = Join-Path $repoRoot '.age\keys.txt'

Write-Host 'Validando personal...' -ForegroundColor Cyan

if (-not (Test-Path $keyFile)) {
    Write-Host '- .age/keys.txt: NO (ejecuta scripts/secrets-setup.ps1)' -ForegroundColor Yellow
}
else {
    Write-Host '- .age/keys.txt: OK' -ForegroundColor Gray
}

if (-not (Test-Path $secretFile)) {
    Write-Host '- secrets/personal.enc.yaml: NO (ejecuta scripts/secrets-setup-personal.ps1)' -ForegroundColor Yellow
}
else {
    Write-Host '- secrets/personal.enc.yaml: OK' -ForegroundColor Gray
}

if (-not (Test-Path $runtimeEnv)) {
    Write-Host '- secrets/runtime/personal.env: NO (ejecuta scripts/start-personal.ps1)' -ForegroundColor Yellow
    exit 1
}

Write-Host '- secrets/runtime/personal.env: OK' -ForegroundColor Gray

$envMap = @{}
foreach ($line in Get-Content -Path $runtimeEnv) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) {
        continue
    }

    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
        $envMap[$parts[0].Trim()] = $parts[1]
    }
}

if ($envMap.ContainsKey('ANTHROPIC_API_KEY')) {
    Write-Host '- ANTHROPIC_API_KEY: PRESENTE (riesgo de cobro PAYG, recomendado remover)' -ForegroundColor Yellow
}
else {
    Write-Host '- ANTHROPIC_API_KEY: NO (correcto para plan Pro/Max con OAuth)' -ForegroundColor Gray
}

if ($envMap.ContainsKey('CLAUDE_CODE_OAUTH_TOKEN')) {
    Write-Host '- CLAUDE_CODE_OAUTH_TOKEN: OK (modo no-interactivo listo)' -ForegroundColor Gray
}
else {
    Write-Host '- CLAUDE_CODE_OAUTH_TOKEN: AUSENTE (se usará login interactivo)' -ForegroundColor Yellow
}

if ($envMap.ContainsKey('OPENROUTER_API_KEY')) {
    Write-Host '- OPENROUTER_API_KEY: OK (quick prompts habilitados)' -ForegroundColor Gray
}
else {
    Write-Host '- OPENROUTER_API_KEY: AUSENTE (quick prompts deshabilitados)' -ForegroundColor Yellow
}

& $dockerExe compose ps personal | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '- contenedor personal: NO disponible en compose (aún no levantado)' -ForegroundColor Yellow
    exit 0
}

$health = & $dockerExe compose ps --format json personal | ConvertFrom-Json
if ($health -and $health.Health) {
    Write-Host ("- healthcheck personal: {0}" -f $health.Health) -ForegroundColor Gray
}
else {
    Write-Host '- healthcheck personal: sin estado aún' -ForegroundColor Gray
}

Write-Host ''
Write-Host 'Validación completada.' -ForegroundColor Green

