param(
    [Parameter()][switch]$Restart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')

function Resolve-ToolPath {
    param([Parameter(Mandatory = $true)][string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) { throw "No se encontró '$Name'." }
    return $cmd.Source
}

$docker = Resolve-ToolPath -Name 'docker'

Push-Location $repoRoot
try {
    $container = (& $docker compose ps -q searxng).Trim()
    if (-not $container) {
        & $docker compose --profile openclaw up -d searxng
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar searxng.' }
        Start-Sleep -Seconds 3
        $container = (& $docker compose ps -q searxng).Trim()
    }
    if (-not $container) { throw 'No se encontró contenedor searxng.' }

    $python = @'
from pathlib import Path
import re

path = Path("/etc/searxng/settings.yml")
text = path.read_text(encoding="utf-8")

def patch_search_formats(match):
    block = match.group(0)
    if re.search(r"(?m)^\s{2}formats:\s*\n(?:\s{4}-\s*\w+\s*\n?)+", block):
        return re.sub(
            r"(?m)^\s{2}formats:\s*\n(?:\s{4}-\s*\w+\s*\n?)+",
            "  formats:\n    - html\n    - json\n",
            block,
            count=1,
        )
    return block.rstrip() + "\n  formats:\n    - html\n    - json\n\n"

text = re.sub(r"(?ms)^search:\n.*?(?=^server:\n)", patch_search_formats, text, count=1)
# Remove a legacy top-level formats block accidentally appended by older script versions.
text = re.sub(r"(?ms)\nformats:\s*\n\s*-\s*html\s*\n\s*-\s*json\s*\n?$", "\n", text)
path.write_text(text, encoding="utf-8")
'@

    & $docker exec -i $container python -c $python
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar /etc/searxng/settings.yml.' }

    if ($Restart) {
        & $docker compose restart searxng
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo reiniciar searxng.' }
    }

    Write-Host 'SearXNG configurado con formatos html,json.' -ForegroundColor Green
}
finally {
    Pop-Location
}

