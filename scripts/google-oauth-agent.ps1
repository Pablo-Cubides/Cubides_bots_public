param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('colega', 'coach', 'socio')]
    [string]$Agent,

    [Parameter(Mandatory = $true)]
    [string]$ClientSecretPath,

    [Parameter()][switch]$NoBrowser,
    [Parameter()][string]$DriveRootFolderId,
    [Parameter()][string]$CalendarId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

if (-not (Test-Path $ClientSecretPath)) {
    throw "No existe ClientSecretPath: $ClientSecretPath"
}

function Get-SecretWriter {
    param([Parameter(Mandatory = $true)][string]$AgentName)
    switch ($AgentName) {
        'colega' { return Join-Path $scriptDir 'add-secret.ps1' }
        'coach' { return Join-Path $scriptDir 'add-secret-personal.ps1' }
        'socio' { return Join-Path $scriptDir 'add-secret-business.ps1' }
    }
}

function Save-AgentSecret {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Value
    )
    $writer = Get-SecretWriter -AgentName $Agent
    & $writer -KeyName $Name -KeyValue $Value | Out-Null
}

function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), 0)
    $listener.Start()
    try {
        return $listener.LocalEndpoint.Port
    }
    finally {
        $listener.Stop()
    }
}

$clientRaw = Get-Content -Path $ClientSecretPath -Raw | ConvertFrom-Json
$clientBlock = if ($clientRaw.installed) { $clientRaw.installed } elseif ($clientRaw.web) { $clientRaw.web } else { throw 'El JSON OAuth no contiene bloque installed ni web.' }
$clientId = [string]$clientBlock.client_id
$clientSecret = [string]$clientBlock.client_secret

if ([string]::IsNullOrWhiteSpace($clientId) -or [string]::IsNullOrWhiteSpace($clientSecret)) {
    throw 'El JSON OAuth no contiene client_id/client_secret.'
}

$port = Get-FreePort
$redirectUri = "http://127.0.0.1:$port/oauth2callback"
$redirectCandidates = @()
if ($clientBlock.redirect_uris) {
    $redirectCandidates = @($clientBlock.redirect_uris | Where-Object { $_ -match '^http://(127\.0\.0\.1|localhost)(:\d+)?/' })
}
if ($redirectCandidates.Count -gt 0) {
    $redirectUri = [string]$redirectCandidates[0]
    $redirectParsed = [uri]$redirectUri
    if ($redirectParsed.Port -le 0) {
        throw "El redirect_uri local del JSON no tiene puerto explicito: $redirectUri"
    }
    $port = $redirectParsed.Port
}
$state = [Guid]::NewGuid().ToString('N')
$scopes = @(
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    # Calendar completo permite crear/ver el calendario propio del agente
    # ("Coach - Agenda", "Colega - Agenda", "Socio - Agenda"). calendar.events
    # solo alcanza para eventos en calendarios ya conocidos y falla al validar.
    'https://www.googleapis.com/auth/calendar'
) -join ' '

$queryPairs = [ordered]@{
    client_id = $clientId
    redirect_uri = $redirectUri
    response_type = 'code'
    scope = $scopes
    access_type = 'offline'
    prompt = 'consent'
    state = $state
}
$query = ($queryPairs.GetEnumerator() | ForEach-Object {
    '{0}={1}' -f [uri]::EscapeDataString([string]$_.Key), [uri]::EscapeDataString([string]$_.Value)
}) -join '&'
$authUrl = "https://accounts.google.com/o/oauth2/v2/auth?$query"

$http = [System.Net.HttpListener]::new()
$http.Prefixes.Add("http://127.0.0.1:$port/")
$http.Start()

Write-Host "Autorizando Google Workspace para $Agent..." -ForegroundColor Cyan
if ($NoBrowser) {
    Write-Host 'Copia este link y pegalo en la ventana/perfil de Chrome correcto para la cuenta Gmail dedicada del agente:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host $authUrl -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'PowerShell quedara esperando la redireccion local de Google despues de autorizar.' -ForegroundColor Gray
}
else {
    Write-Host 'Se abrira el navegador. Inicia sesion con la cuenta Gmail dedicada del agente.' -ForegroundColor Gray
    Write-Host 'Si tienes muchas cuentas abiertas, cancela y usa -NoBrowser para copiar el link manualmente.' -ForegroundColor Yellow
    Start-Process $authUrl | Out-Null
}

try {
    $context = $http.GetContext()
    $request = $context.Request
    $response = $context.Response
    $code = $request.QueryString['code']
    $returnedState = $request.QueryString['state']
    $error = $request.QueryString['error']

    $html = '<html><body><h2>Autorizacion recibida.</h2><p>Puedes cerrar esta ventana y volver a PowerShell.</p></body></html>'
    if ($error) {
        $html = "<html><body><h2>Error OAuth</h2><p>$error</p></body></html>"
    }
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($html)
    $response.ContentType = 'text/html; charset=utf-8'
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()

    if ($error) {
        throw "Google devolvio error OAuth: $error"
    }
    if ($returnedState -ne $state) {
        throw 'OAuth state invalido. Reintenta.'
    }
    if ([string]::IsNullOrWhiteSpace($code)) {
        throw 'No se recibio authorization code.'
    }

    $tokenResponse = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -ContentType 'application/x-www-form-urlencoded' -Body @{
        code = $code
        client_id = $clientId
        client_secret = $clientSecret
        redirect_uri = $redirectUri
        grant_type = 'authorization_code'
    }

    $refreshToken = [string]$tokenResponse.refresh_token
    if ([string]::IsNullOrWhiteSpace($refreshToken)) {
        throw 'Google no devolvio refresh_token. Revoca el acceso previo o reintenta; el script usa prompt=consent.'
    }

    Save-AgentSecret -Name 'GOOGLE_CLIENT_ID' -Value $clientId
    Save-AgentSecret -Name 'GOOGLE_CLIENT_SECRET' -Value $clientSecret
    Save-AgentSecret -Name 'GOOGLE_REFRESH_TOKEN' -Value $refreshToken
    if (-not [string]::IsNullOrWhiteSpace($DriveRootFolderId)) {
        Save-AgentSecret -Name 'GOOGLE_DRIVE_ROOT_FOLDER_ID' -Value $DriveRootFolderId
    }
    if (-not [string]::IsNullOrWhiteSpace($CalendarId)) {
        Save-AgentSecret -Name 'GOOGLE_CALENDAR_ID' -Value $CalendarId
    }

    Write-Host "OAuth Google guardado cifrado para $Agent." -ForegroundColor Green
    Write-Host 'Reinicia el agente correspondiente para regenerar secrets/runtime/*.env.' -ForegroundColor Gray
}
finally {
    if ($http.IsListening) {
        $http.Stop()
    }
}

