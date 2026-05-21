param(
    [Parameter()][string]$HostUid = '1001',
    [Parameter()][string]$HostGid = '1001',
    [Parameter()][switch]$NoBuild,
    [Parameter()][switch]$NoAttach
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

function Parse-SecretValue {
    param([Parameter(Mandatory = $true)][string]$Raw)

    $trimmed = $Raw.Trim()
    try {
        return ($trimmed | ConvertFrom-Json)
    }
    catch {
        return $trimmed
    }
}

function Get-JsonPropertyValue {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not $Object) {
        return $null
    }

    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) {
        return $null
    }

    return $prop.Value
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$dockerExe = Resolve-ToolPath -PrimaryName 'docker' -WingetFolderHint $null -ExeName $null

$sopsExe = Resolve-ToolPath -PrimaryName 'sops' -WingetFolderHint 'SecretsOPerationS.SOPS' -ExeName 'sops.exe'

$keyFile = Join-Path $repoRoot '.age\keys.txt'
$personalSecretFile = Join-Path $repoRoot 'secrets\personal.enc.yaml'
$runtimeDir = Join-Path $repoRoot 'secrets\runtime'
$personalEnvFile = Join-Path $runtimeDir 'personal.env'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$personalEnvMap = @{}
if ((Test-Path $keyFile) -and (Test-Path $personalSecretFile)) {
    $env:SOPS_AGE_KEY_FILE = $keyFile
    $decryptedJsonRaw = & $sopsExe --decrypt --output-type json $personalSecretFile
    $decrypted = $decryptedJsonRaw | ConvertFrom-Json
    $personal = Get-JsonPropertyValue -Object $decrypted -Name 'personal'
    $envBlock = Get-JsonPropertyValue -Object $personal -Name 'env'

    if ($envBlock) {
        foreach ($prop in $envBlock.PSObject.Properties) {
            $name = [string]$prop.Name
            $value = [string](Parse-SecretValue -Raw ([string]$prop.Value))
            if (-not [string]::IsNullOrWhiteSpace($name) -and -not [string]::IsNullOrWhiteSpace($value)) {
                $personalEnvMap[$name] = $value
            }
        }
    }
}

$personalEnvLines = @()
foreach ($name in $personalEnvMap.Keys | Sort-Object) {
    $personalEnvLines += ("{0}={1}" -f $name, $personalEnvMap[$name])
}
Set-Content -Path $personalEnvFile -Value $personalEnvLines -Encoding utf8

if ($personalEnvMap.ContainsKey('CLAUDE_CODE_OAUTH_TOKEN')) {
    Write-Host 'OAuth token para Claude Code cargado desde secretos.' -ForegroundColor Gray
}
else {
    Write-Host 'Aviso: no se encontró CLAUDE_CODE_OAUTH_TOKEN en secretos. Claude pedirá login interactivo.' -ForegroundColor Yellow
}

if ($personalEnvMap.ContainsKey('OPENROUTER_API_KEY')) {
    Write-Host 'OPENROUTER_API_KEY cargado para quick prompts.' -ForegroundColor Gray
}
else {
    Write-Host 'Aviso: no se encontró OPENROUTER_API_KEY en secretos.' -ForegroundColor Yellow
}

if ($personalEnvMap.ContainsKey('ANTHROPIC_API_KEY')) {
    Write-Host 'Aviso: ANTHROPIC_API_KEY detectada. Esto puede forzar cobro PAYG en lugar de Claude Pro/Max por OAuth.' -ForegroundColor Yellow
}

$env:HOST_UID = $HostUid
$env:HOST_GID = $HostGid

$upArgs = @('compose', 'up', '-d', '--remove-orphans')
if (-not $NoBuild) {
    $upArgs += '--build'
}
$upArgs += 'personal'

Write-Host "Levantando contenedor personal (HOST_UID=$HostUid, HOST_GID=$HostGid)..." -ForegroundColor Cyan
& $dockerExe @upArgs

if ($LASTEXITCODE -ne 0) {
    throw 'Falló docker compose up para personal.'
}

# Probe OAuth: valida que el token realmente funciona contra la API.
# Resultado cacheado 24h en .tmp/ para no pagar latencia en cada arranque.
$tmpDir    = Join-Path $repoRoot '.tmp'
$probeFlag = Join-Path $tmpDir 'personal-token-probe.flag'
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$runProbe = $true
if (Test-Path $probeFlag) {
    $ageHours = ((Get-Date) - (Get-Item $probeFlag).LastWriteTime).TotalHours
    if ($ageHours -lt 24) {
        Write-Host ("OAuth probe reciente ({0:F1}h). Omitiendo." -f $ageHours) -ForegroundColor Gray
        $runProbe = $false
    }
}

if ($runProbe -and $personalEnvMap.ContainsKey('CLAUDE_CODE_OAUTH_TOKEN')) {
    Write-Host 'Probando OAuth token contra la API (haiku, coste ~$0.001)...' -ForegroundColor Gray
    # Coach usa OAuth Pro/Max — el uso sale del cupo del plan, no por token.
    # No usamos --max-budget-usd porque cappea costo estimado localmente y abortaria
    # respuestas validas aunque no haya cobro real (ver doc: code.claude.com/docs/costs).
    $probeOut = & $dockerExe exec personal bash -lc 'claude -p "ok" --model haiku --permission-mode plan 2>&1' 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Set-Content -Path $probeFlag -Value (Get-Date -Format 'o') -Encoding utf8
        Write-Host 'OAuth token validado correctamente.' -ForegroundColor Green
    } elseif ($probeOut -match 'Invalid|Unauthorized|authentication|token|401|403') {
        Write-Host '' ; Write-Host 'ERROR: Token OAuth rechazado por la API. Renueva con: claude setup-token' -ForegroundColor Red
        Write-Host $probeOut.Trim().Substring(0, [Math]::Min(300, $probeOut.Length)) -ForegroundColor Red
        throw 'OAuth token invalido — Coach no puede conectarse a Claude sin autenticacion.'
    } else {
        Write-Host 'Probe falló por razón externa (red, timeout). Continuando de todas formas.' -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Contenedor personal listo.' -ForegroundColor Green

# Asegura que el Slack bridge este corriendo (no-op si ya esta vivo).
try {
    & (Join-Path $scriptDir 'start-slack-bridge.ps1') -Detached
}
catch {
    Write-Warning ("No se pudo asegurar el Slack bridge: {0}" -f $_.Exception.Message)
}

if ($NoAttach) {
    Write-Host 'Para entrar manualmente:' -ForegroundColor Gray
    Write-Host 'docker compose exec personal bash' -ForegroundColor Gray
    Write-Host 'claude' -ForegroundColor Gray
    exit 0
}

Write-Host 'Entrando al contenedor y lanzando Claude...' -ForegroundColor Cyan
& $dockerExe compose exec personal bash -lc 'claude'

