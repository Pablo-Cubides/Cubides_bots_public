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

function Read-OptionalSecureValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    if ($null -eq $plain) {
        return ''
    }

    return ([string]$plain).Trim()
}

function Read-RequiredSecureValue {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    while ($true) {
        $value = Read-OptionalSecureValue -Prompt $Prompt
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
        Write-Host 'Valor vacío. Intenta de nuevo.' -ForegroundColor Yellow
    }
}

function Ensure-JsonObjectProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) {
        Add-Member -InputObject $Object -MemberType NoteProperty -Name $Name -Value ([pscustomobject]@{}) -Force
        $prop = $Object.PSObject.Properties[$Name]
    }

    return $prop.Value
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
Set-Location $repoRoot

$sopsExe = Resolve-ToolPath -PrimaryName 'sops' -WingetFolderHint 'SecretsOPerationS.SOPS' -ExeName 'sops.exe'

$keyFile = Join-Path $repoRoot '.age\keys.txt'
$secretFile = Join-Path $repoRoot 'secrets\personal.enc.yaml'

if (-not (Test-Path $keyFile)) {
    throw 'No existe .age/keys.txt. Ejecuta primero scripts/secrets-setup.ps1'
}

$env:SOPS_AGE_KEY_FILE = $keyFile

Write-Host 'Configurarás secretos cifrados para personal:' -ForegroundColor Cyan
Write-Host '- OPENROUTER_API_KEY (obligatorio para quick online gratis)' -ForegroundColor Gray
Write-Host '- CLAUDE_CODE_OAUTH_TOKEN (opcional, para no-login interactivo)' -ForegroundColor Gray
Write-Host ''

$openRouterApiKey = Read-RequiredSecureValue -Prompt 'Ingresa OPENROUTER_API_KEY'
$oauthToken = Read-OptionalSecureValue -Prompt 'Ingresa CLAUDE_CODE_OAUTH_TOKEN (opcional, Enter para omitir)'

$jsonObj = $null
if (Test-Path $secretFile) {
    $existingJson = & $sopsExe --decrypt --output-type json $secretFile
    $jsonObj = $existingJson | ConvertFrom-Json
}
else {
    $jsonObj = [pscustomobject]@{}
}

$personalObj = Ensure-JsonObjectProperty -Object $jsonObj -Name 'personal'
$envObj = Ensure-JsonObjectProperty -Object $personalObj -Name 'env'

Add-Member -InputObject $envObj -MemberType NoteProperty -Name 'OPENROUTER_API_KEY' -Value $openRouterApiKey -Force

if ($envObj.PSObject.Properties['ANTHROPIC_API_KEY']) {
    $envObj.PSObject.Properties.Remove('ANTHROPIC_API_KEY')
}

if ([string]::IsNullOrWhiteSpace($oauthToken)) {
    if ($envObj.PSObject.Properties['CLAUDE_CODE_OAUTH_TOKEN']) {
        $envObj.PSObject.Properties.Remove('CLAUDE_CODE_OAUTH_TOKEN')
    }
}
else {
    Add-Member -InputObject $envObj -MemberType NoteProperty -Name 'CLAUDE_CODE_OAUTH_TOKEN' -Value $oauthToken -Force
}

$tempJson = Join-Path $env:TEMP ("personal-secrets-" + [Guid]::NewGuid().ToString() + '.json')
$tempEnc = Join-Path $repoRoot 'secrets\.tmp.personal.enc.yaml'
try {
    ($jsonObj | ConvertTo-Json -Depth 20) | Set-Content -Path $tempJson -Encoding utf8
    Get-Content -Path $tempJson -Raw | Set-Content -Path $tempEnc -Encoding utf8
    & $sopsExe --encrypt --in-place $tempEnc
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló el cifrado con sops al guardar secrets/personal.enc.yaml'
    }
    Move-Item -Force -Path $tempEnc -Destination $secretFile
}
finally {
    if (Test-Path $tempJson) { Remove-Item $tempJson -Force }
    if (Test-Path $tempEnc) { Remove-Item $tempEnc -Force }
}

Write-Host ''
Write-Host 'Listo: secretos personales guardados en secrets/personal.enc.yaml' -ForegroundColor Green


