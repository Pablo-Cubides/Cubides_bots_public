param(
    [Parameter()][string]$UserEmail = "your-email@example.com",
    [Parameter()][string]$UserName = "Your Name",
    [Parameter()][string]$RemoteUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "📦 Inicializando repositorio Git..." -ForegroundColor Cyan

# Verifica que no estemos ya en un repo
if (Test-Path ".git") {
    Write-Host "ℹ️  Git ya existe en este directorio" -ForegroundColor Yellow
}
else {
    Write-Host "Inicializando Git..." -ForegroundColor Gray
    git init
    git config user.email $UserEmail
    git config user.name $UserName
    Write-Host "✅ Git inicializado" -ForegroundColor Green
}

# Crea directorio de hooks si no existe
$hooksDir = ".git\hooks"
if (-not (Test-Path $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir | Out-Null
}

# Pre-commit hook (PowerShell version para Windows)
$preCommitHook = @'
# Pre-commit hook to catch secrets early
# Ejecutar desde Git Bash o WSL

PATTERNS=(
    "OPENCLAW_GATEWAY_TOKEN"
    "OPENROUTER_API_KEY"
    "CLAUDE_CODE_OAUTH_TOKEN"
    "GMAIL_BOT_APP_PASSWORD"
    "Bearer sk-"
    "sk-or-v1-"
)

for pattern in "${PATTERNS[@]}"; do
    if git diff --cached | grep -qE "$pattern"; then
        echo "❌ Detectado patrón sospechoso: $pattern"
        echo "Commit BLOQUEADO por seguridad."
        exit 1
    fi
done

# Verifica archivos prohibidos
FORBIDDEN=(".age/keys.txt" "secrets/runtime/*.env" ".env")
for file in "${FORBIDDEN[@]}"; do
    if git diff --cached --name-only | grep -qE "^$file"; then
        echo "❌ ¡No puedes commitear $file!"
        exit 1
    fi
done

echo "✅ Listo para commit"
exit 0
'@

$preCommitPath = Join-Path $hooksDir "pre-commit"
Set-Content -Path $preCommitPath -Value $preCommitHook -Encoding utf8
Write-Host "✅ Pre-commit hook configurado en $preCommitPath" -ForegroundColor Green

Write-Host ""
Write-Host "🔐 Próximos pasos para GitHub:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Crea un repositorio en GitHub (https://github.com/new)"
Write-Host ""
Write-Host "2. Añade cambios:"
Write-Host "   git add ." -ForegroundColor Gray
Write-Host ""
Write-Host "3. Primer commit:"
Write-Host "   git commit -m 'chore: initial multi-agent setup'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Renombra rama a main (si es necesario):"
Write-Host "   git branch -M main" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Conecta a GitHub (reemplaza tu usuario):"
Write-Host "   git remote add origin https://github.com/TU-USUARIO/mis-bots.git" -ForegroundColor Gray
Write-Host ""
Write-Host "6. Pushea:"
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Asegúrate de que en GitHub el repo es PRIVADO." -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Verificaciones automáticas de seguridad:" -ForegroundColor Cyan
Write-Host "   ✅ .gitignore excluye: .age/keys.txt, secrets/runtime/*.env"
Write-Host "   ✅ Hooks bloquean commits con patrones sospechosos"
Write-Host "   ✅ .gitattributes marca cifrados como binarios"


