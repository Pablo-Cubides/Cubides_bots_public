param(
    [Parameter()][int]$Days = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')

Push-Location $repoRoot
try {
    node .\agent_tools\colega_native_memory_bridge.mjs --days $Days
}
finally {
    Pop-Location
}

