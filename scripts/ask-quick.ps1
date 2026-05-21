param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt,
    [Parameter()][string]$Model = 'google/gemma-4-26b-a4b-it:free',
    [Parameter()][double]$Temperature = 0.2,
    [Parameter()][int]$MaxTokens = 700
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$runtimeEnvFile = Join-Path $repoRoot 'secrets\runtime\personal.env'

if (-not (Test-Path $runtimeEnvFile)) {
    throw 'No existe secrets/runtime/personal.env. Ejecuta scripts/start-personal.ps1 primero.'
}

$envMap = @{}
foreach ($line in Get-Content -Path $runtimeEnvFile) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
        $envMap[$parts[0].Trim()] = $parts[1]
    }
}

$openRouterApiKey = $envMap['OPENROUTER_API_KEY']
if ([string]::IsNullOrWhiteSpace([string]$openRouterApiKey)) {
    throw 'Falta OPENROUTER_API_KEY en secrets/runtime/personal.env. Configúralo con scripts/secrets-setup-personal.ps1'
}

$promptText = $Prompt.Trim()
if ([string]::IsNullOrWhiteSpace($promptText)) {
    throw 'Prompt vacío.'
}

$headers = @{
    Authorization  = "Bearer $openRouterApiKey"
    'Content-Type' = 'application/json'
    'HTTP-Referer' = 'http://localhost'
    'X-Title'      = 'mis-bots-personal-quick'
}

$body = @{
    model       = $Model
    temperature = $Temperature
    max_tokens  = $MaxTokens
    messages    = @(
        @{ role = 'system'; content = 'Responde breve y directo. Prioriza utilidad práctica.' },
        @{ role = 'user'; content = $promptText }
    )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Method Post -Uri 'https://openrouter.ai/api/v1/chat/completions' -Headers $headers -Body $body

$content = $response.choices[0].message.content
if ([string]::IsNullOrWhiteSpace([string]$content)) {
    Write-Host 'Sin contenido de respuesta.' -ForegroundColor Yellow
    exit 1
}

Write-Output $content

