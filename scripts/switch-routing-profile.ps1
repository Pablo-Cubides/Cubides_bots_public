param(
    [ValidateSet('fast', 'standard', 'deep', 'fallback', 'normal', 'pro', 'emergency')]
    [string]$Profile = 'standard',
    [string]$ContainerName = 'colega',
    [string]$FastModel = 'openai-codex/gpt-5.4-mini',
    [string]$StandardModel = 'openai-codex/gpt-5.4',
    [string]$DeepModel = 'openai-codex/gpt-5.3-codex',
    [string]$FallbackModel = 'openrouter/free',
    [string]$FreeSecondaryModel = 'openrouter/google/gemma-4-26b-a4b-it:free',
    [string]$EconomicModel = 'openrouter/google/gemma-4-26b-a4b-it',
    [string]$LocalModel = ''
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

function Invoke-OpenClaw {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )

    $quoted = $Arguments | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\\"') + '"'
        }
        else {
            $_
        }
    }

    $command = 'openclaw ' + ($quoted -join ' ')
    & $dockerExe exec $ContainerName sh -lc $command | Out-Host
    if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
        throw "Falló: $command"
    }
}

function Add-UniqueModel {
    param(
        [Parameter()][System.Collections.Generic.List[string]]$Target,
        [Parameter()][string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $trimmed = $Value.Trim()
    if (-not $Target.Contains($trimmed)) {
        $Target.Add($trimmed)
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

. (Join-Path $scriptDir 'lib\routing-models.ps1')

$dockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null

& $dockerExe ps --format '{{.Names}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker no está disponible. Inicia Docker Desktop y vuelve a ejecutar el script.'
}

$isRunning = (& $dockerExe inspect -f '{{.State.Running}}' $ContainerName 2>$null)
if ($LASTEXITCODE -ne 0 -or $isRunning.Trim() -ne 'true') {
    throw "El contenedor '$ContainerName' no está corriendo. Ejecuta scripts/start-academic.ps1 primero."
}

$primary = ''
$fallbacks = [System.Collections.Generic.List[string]]::new()

switch ($Profile) {
    'fast' {
        $primary = $FastModel
        Add-UniqueModel -Target $fallbacks -Value $StandardModel
        Add-UniqueModel -Target $fallbacks -Value $FallbackModel
    }
    'standard' {
        $primary = $StandardModel
        Add-UniqueModel -Target $fallbacks -Value $FastModel
        Add-UniqueModel -Target $fallbacks -Value $FallbackModel
    }
    'deep' {
        $primary = $DeepModel
        Add-UniqueModel -Target $fallbacks -Value $StandardModel
        Add-UniqueModel -Target $fallbacks -Value $FallbackModel
    }
    'fallback' {
        $primary = $FallbackModel
        Add-UniqueModel -Target $fallbacks -Value $FreeSecondaryModel
        Add-UniqueModel -Target $fallbacks -Value $EconomicModel
    }
    'normal' {
        $primary = $StandardModel
        Add-UniqueModel -Target $fallbacks -Value $FastModel
        Add-UniqueModel -Target $fallbacks -Value $FallbackModel
    }
    'pro' {
        $primary = $DeepModel
        Add-UniqueModel -Target $fallbacks -Value $StandardModel
        Add-UniqueModel -Target $fallbacks -Value $FallbackModel
        if (-not [string]::IsNullOrWhiteSpace($LocalModel)) {
            Add-UniqueModel -Target $fallbacks -Value $LocalModel
        }
        else {
            Write-Host 'Aviso: perfil pro sin LocalModel. Se usará solo Codex -> económico.' -ForegroundColor Yellow
            Write-Host 'Para usar fallback local, pasa -LocalModel "<provider/model>" (ejecuta `openclaw models list --local --plain`).' -ForegroundColor Yellow
        }
    }
    'emergency' {
        $primary = $FallbackModel
        Add-UniqueModel -Target $fallbacks -Value $FreeSecondaryModel
        Add-UniqueModel -Target $fallbacks -Value $EconomicModel
    }
}

Write-Host ("Aplicando perfil de routing: {0}" -f $Profile) -ForegroundColor Cyan
Write-Host ("Primary: {0}" -f $primary) -ForegroundColor Gray
if ($fallbacks.Count -gt 0) {
    Write-Host ("Fallbacks: {0}" -f (($fallbacks.ToArray()) -join ', ')) -ForegroundColor Gray
}
else {
    Write-Host 'Fallbacks: (ninguno)' -ForegroundColor Gray
}

Invoke-OpenClaw -Arguments @('models', 'set', $primary)
Invoke-OpenClaw -Arguments @('models', 'fallbacks', 'clear')
foreach ($model in $fallbacks) {
    Invoke-OpenClaw -Arguments @('models', 'fallbacks', 'add', $model)
}

foreach ($alias in @('fast', 'standard', 'deep', 'planning', 'simple', 'cheap', 'pro', 'backup', 'local', 'emergency', 'fallback')) {
    Invoke-OpenClaw -Arguments @('models', 'aliases', 'remove', $alias) -AllowFailure
}

Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'fast', $FastModel)
Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'standard', $StandardModel)
Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'deep', $DeepModel)
Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'fallback', $FallbackModel)

if (-not [string]::IsNullOrWhiteSpace($LocalModel)) {
    Invoke-OpenClaw -Arguments @('models', 'aliases', 'add', 'local', $LocalModel)
}

Write-Host ''
Write-Host 'Perfil aplicado.' -ForegroundColor Green
Write-Host 'Estado actual:' -ForegroundColor Cyan
Invoke-OpenClaw -Arguments @('models', 'status')


