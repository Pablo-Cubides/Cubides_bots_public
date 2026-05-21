<#
.SYNOPSIS
    Actualiza los digests sha256 en los FROM de cada Dockerfile.
    Ejecutar con Docker Desktop activo después de cada actualización de imagen base.

.EXAMPLE
    .\scripts\refresh-image-digests.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..')

$targets = @(
    @{ File = 'academic_agent\Dockerfile';         Image = 'alpine/openclaw:latest' },
    @{ File = 'personal_agent\Dockerfile';         Image = 'node:20-slim' },
    @{ File = 'business_agent\Dockerfile';         Image = 'python:3.11-slim' },
    @{ File = 'business_agent\Dockerfile.heavy';   Image = 'ubuntu:22.04' }
)

foreach ($t in $targets) {
    $path   = Join-Path $repoRoot $t.File
    $image  = $t.Image
    $tag    = $image -replace '@sha256:[a-f0-9]+$', ''  # quita digest previo si existe

    Write-Host "[$tag] Obteniendo digest..." -ForegroundColor Cyan
    & docker pull $tag | Out-Null
    $digest = (& docker inspect --format '{{index .RepoDigests 0}}' $tag) -replace '^.*@', ''

    if (-not $digest -or $digest -notmatch '^sha256:') {
        Write-Warning "No se pudo obtener digest para $tag — omitiendo."
        continue
    }

    $pinned  = "${tag}@${digest}"
    $content = Get-Content $path -Raw

    # Reemplaza FROM image[:tag][@sha256:...] con el digest actual
    $tagBase = $tag -replace '@sha256:[a-f0-9]+$', ''
    $escaped = [regex]::Escape($tagBase)
    $newContent = $content -replace "(?m)^(FROM\s+${escaped})(@sha256:[a-f0-9]+)?", "FROM ${pinned}"

    if ($newContent -ne $content) {
        Set-Content -Path $path -Value $newContent -Encoding utf8NoBOM -NoNewline
        Write-Host "  Actualizado $($t.File) → $pinned" -ForegroundColor Green
    } else {
        Write-Host "  Sin cambios en $($t.File)." -ForegroundColor Gray
    }
}

Write-Host ''
Write-Host 'Digests actualizados. Haz commit de los Dockerfiles y lanza el CI para validar.' -ForegroundColor Cyan

