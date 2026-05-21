param(
    [Parameter()][ValidateSet('', 'colega', 'coach', 'socio')][string]$Agent = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'No se encontró node en PATH.'
}

$args = @('agent_tools\notion_map.mjs')
if (-not [string]::IsNullOrWhiteSpace($Agent)) {
    $args += @('--agent', $Agent)
}

& $node.Source @args
if ($LASTEXITCODE -ne 0) {
    throw 'Falló mostrar el mapa de Notion.'
}


