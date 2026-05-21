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

function Add-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Ok,
        [Parameter()][string]$Detail = ''
    )
    [pscustomobject]@{
        check = $Name
        ok = $Ok
        detail = $Detail
    }
}

function Format-Detail {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return '' }
    return (($Value | Out-String) -replace '\s+', ' ').Trim()
}

$docker = Resolve-ToolPath -Name 'docker'
$node = Resolve-ToolPath -Name 'node'
$checks = @()

Push-Location $repoRoot
try {
    $ps = & $docker compose ps --format json 2>$null
    $containers = @()
    foreach ($line in $ps -split "`r?`n") {
        if ($line.Trim()) {
            try { $containers += $line | ConvertFrom-Json } catch {}
        }
    }
    foreach ($name in @('colega', 'personal', 'business_agent', 'business_agent_daemon', 'searxng')) {
        $item = $containers | Where-Object { $_.Name -eq $name } | Select-Object -First 1
        $detail = if ($item -and ($item.PSObject.Properties.Name -contains 'Status')) {
            [string]$item.Status
        }
        elseif ($item -and ($item.PSObject.Properties.Name -contains 'State')) {
            [string]$item.State
        }
        else {
            'not found'
        }
        $checks += Add-Check -Name "docker:$name" -Ok ([bool]$item -and $item.State -eq 'running') -Detail $detail.Trim()
    }

    $searx = (& $docker exec searxng sh -lc "awk '/^search:/{flag=1} /^server:/{flag=0} flag{print}' /etc/searxng/settings.yml | grep -q -- '- json' && echo json || echo missing" 2>$null) -join "`n"
    $checks += Add-Check -Name 'searxng:json-format' -Ok ($searx -match 'json') -Detail (Format-Detail $searx)

    $audio = (& $docker exec colega openclaw config get tools.media.audio 2>$null) -join "`n"
    $checks += Add-Check -Name 'colega:audio-native-config' -Ok ([bool]($audio -match '"enabled": true')) -Detail (Format-Detail $audio)

    $slackThread = (& $docker exec colega openclaw config get channels.slack.thread 2>$null) -join "`n"
    $checks += Add-Check -Name 'colega:slack-thread-inherit' -Ok ([bool]($slackThread -match '"inheritParent": true')) -Detail (Format-Detail $slackThread)

    $mem = (& $docker exec colega sh -lc "test -f /data/openclaw/.openclaw/workspace/memory/projects/research-stack/README.md && test -f /data/openclaw/.openclaw/workspace/memory/projects/teaching-stack/README.md && test -f /data/openclaw/.openclaw/workspace/memory/projects/operations/README.md && echo ok || echo missing" 2>$null) -join "`n"
    $checks += Add-Check -Name 'colega:memory-projects' -Ok ($mem -match 'ok') -Detail (Format-Detail $mem)

    $memorySearch = (& $docker exec colega openclaw config get agents.defaults.memorySearch 2>$null) -join "`n"
    $memoryProviderValid = [bool]($memorySearch -match '"provider":\s*"(local|openai|openrouter|github-copilot|gemini|voyage|mistral|deepinfra|bedrock|ollama|lmstudio)"')
    $checks += Add-Check -Name 'colega:memory-provider-valid' -Ok $memoryProviderValid -Detail (Format-Detail $memorySearch)

    if ($memorySearch -match '"provider":\s*"local"') {
        $localEmbeddings = & $docker exec colega sh -lc "node -e `"import('node-llama-cpp').then(()=>console.log('ok')).catch(()=>process.exit(1))`" >/dev/null 2>&1 && echo ok || echo missing"
        $checks += Add-Check -Name 'colega:local-embeddings-dependency' -Ok ($localEmbeddings -match 'ok') -Detail (Format-Detail $localEmbeddings)
    }

    $vercel = (& $node .\agent_tools\vercel_observer.mjs --action verify 2>$null) -join "`n"
    $vercelDetail = Format-Detail $vercel
    $checks += Add-Check -Name 'socio:vercel-observer' -Ok ([bool]($vercel -match '"ok": true' -and $vercel -match '"mode": "observer')) -Detail ($vercelDetail.Substring(0, [Math]::Min(300, $vercelDetail.Length)))

    $routineLocks = Test-Path .\logs\runtime\routines\locks
    $checks += Add-Check -Name 'routines:locks-dir' -Ok $routineLocks -Detail 'logs/runtime/routines/locks'

    $bridgePid = Test-Path .\.tmp\slack-bridge.pid
    $checks += Add-Check -Name 'slack-bridge:pid' -Ok $bridgePid -Detail '.tmp/slack-bridge.pid'

    $checks | ConvertTo-Json -Depth 4
}
finally {
    Pop-Location
}


