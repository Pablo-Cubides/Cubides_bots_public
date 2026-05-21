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
    $container = (& $docker compose ps -q colega).Trim()
    if (-not $container) {
        & $docker compose --profile openclaw up -d colega
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar colega.' }
        Start-Sleep -Seconds 3
        $container = (& $docker compose ps -q colega).Trim()
    }
    if (-not $container) { throw 'No se encontró contenedor colega.' }

    $shell = @'
set -eu

mkdir -p /data/openclaw/.openclaw/workspace/memory/projects/research-stack
mkdir -p /data/openclaw/.openclaw/workspace/memory/projects/teaching-stack
mkdir -p /data/openclaw/.openclaw/workspace/memory/projects/operations

cat > /data/openclaw/.openclaw/workspace/memory/projects/research-stack/README.md <<'EOF'
# Research Stack

Memoria operacional de Colega para investigación académica: agua, calidad del agua, gestión ambiental, inteligencia artificial, análisis de datos y optimización.

Usar este espacio para recordar líneas de investigación, convocatorias, papers, congresos, contactos académicos y oportunidades relevantes para Primary User.
EOF

cat > /data/openclaw/.openclaw/workspace/memory/projects/teaching-stack/README.md <<'EOF'
# Teaching Stack

Memoria operacional de Colega para docencia: presentaciones, clases, herramientas didácticas, evaluación, materiales, asignaturas y mejora del desempeño como docente.

Usar este espacio para recordar cursos, recursos, ideas de clase, presentaciones y pendientes académicos.
EOF

cat > /data/openclaw/.openclaw/workspace/memory/projects/operations/README.md <<'EOF'
# Operations

Memoria operacional de Colega para funcionamiento del agente: rutinas, Slack nativo, email, Google Workspace, Notion, búsqueda web, deep research y decisiones de configuración.

Usar este espacio para registrar decisiones operativas estables y errores recurrentes ya resueltos.
EOF
'@

    & $docker exec -i $container sh -lc $shell
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron reparar rutas de memoria de Colega.' }

    & $docker exec $container openclaw config set tools.media.audio.enabled true --strict-json
    & $docker exec $container openclaw config set tools.media.audio.echoTranscript true --strict-json
    & $docker exec $container openclaw config set tools.media.audio.maxBytes 20971520 --strict-json
    & $docker exec $container openclaw config set tools.media.audio.maxChars 6000 --strict-json
    & $docker exec $container openclaw config set channels.slack.thread.inheritParent true --strict-json
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar Slack thread.inheritParent.' }

    Write-Host 'Colega/OpenClaw reparado: memoria base, audio nativo y herencia de hilos Slack.' -ForegroundColor Green
    Write-Host 'Nota: OpenClaw 2026.5.7 no permite cambiar replyToModeByChatType fuera de off por schema; se deja en configuración nativa.' -ForegroundColor Yellow
}
finally {
    Pop-Location
}

