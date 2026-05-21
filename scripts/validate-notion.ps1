param(
    [Parameter()][ValidateSet('all', 'colega', 'coach', 'socio')][string]$Agent = 'all',
    [Parameter()][switch]$Search
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

$args = @('agent_tools\notion_verify.mjs', '--agent', $Agent)
if ($Search) {
    $args += '--search'
}

& $node.Source @args
if ($LASTEXITCODE -ne 0) {
    throw 'Falló la validación de Notion.'
}


