param(
    [Parameter()][int]$Port = 3100,
    [Parameter()][switch]$Production,
    [Parameter()][switch]$Dev
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

    throw "No se encontró la herramienta '$PrimaryName'."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$dashboardDir = Join-Path $repoRoot 'dashboard'

if (-not (Test-Path $dashboardDir)) {
    throw 'No existe dashboard/.'
}

$nodeExe = Resolve-ToolPath -PrimaryName 'node' -WingetFolderHint $null -ExeName $null
$nodeDir = Split-Path -Parent $nodeExe
$npmCliCandidates = @(
    (Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'),
    'D:\Programas\node_modules\npm\bin\npm-cli.js'
)
$npmCli = $npmCliCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$npmExe = Resolve-ToolPath -PrimaryName 'npm' -WingetFolderHint $null -ExeName $null
$nextBin = Join-Path $dashboardDir 'node_modules\next\dist\bin\next'

function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    if ($npmCli) {
        & $nodeExe $npmCli @Arguments
    }
    else {
        & $npmExe @Arguments
    }
}

function Repair-NextServerChunks {
    $serverDir = Join-Path $dashboardDir '.next\server'
    $chunksDir = Join-Path $serverDir 'chunks'
    if (-not (Test-Path $chunksDir)) {
        return
    }

    Get-ChildItem -Path $chunksDir -Filter '*.js' -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $serverDir $_.Name) -Force
    }
}

function Clear-NextBuild {
    $nextDir = Join-Path $dashboardDir '.next'
    if ((Test-Path $nextDir) -and ((Resolve-Path $nextDir).Path -eq (Join-Path $dashboardDir '.next'))) {
        Remove-Item -LiteralPath $nextDir -Recurse -Force
    }
}

Set-Location $dashboardDir

if (-not (Test-Path (Join-Path $dashboardDir 'node_modules'))) {
    Write-Host 'Instalando dependencias del dashboard...' -ForegroundColor Cyan
    Invoke-Npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló npm install para dashboard.'
    }
}

Write-Host ("Centro de Comando: http://127.0.0.1:{0}" -f $Port) -ForegroundColor Green
if (-not (Test-Path $nextBin)) {
    throw 'No se encontro el binario local de Next. Ejecuta npm install en dashboard/.'
}

if (-not $Dev) {
    Clear-NextBuild
    & $nodeExe $nextBin build
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló next build para dashboard.'
    }
    Repair-NextServerChunks
    & $nodeExe $nextBin start --hostname 127.0.0.1 --port ([string]$Port)
}
else {
    & $nodeExe $nextBin dev --hostname 127.0.0.1 --port ([string]$Port)
}

