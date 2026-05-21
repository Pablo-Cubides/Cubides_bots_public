param(
    [Parameter()][ValidateSet('colega', 'coach', 'socio')][string]$Agent = 'coach',
    [Parameter()][ValidateSet('all', 'database', 'page')][string]$Type = 'all',
    [Parameter()][int]$Limit = 100,
    [Parameter()][switch]$Json
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

$args = @(
    'agent_tools\notion_list_resources.mjs',
    '--agent', $Agent,
    '--type', $Type,
    '--limit', [string]$Limit
)

if ($Json) {
    $args += '--json'
}

& $node.Source @args
if ($LASTEXITCODE -ne 0) {
    throw 'Falló listar recursos de Notion.'
}

