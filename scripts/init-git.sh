#!/bin/bash
# Initialize Git repo with security checks

set -e

echo "📦 Inicializando repositorio Git..."

# Inicializa git si no existe
if [ ! -d ".git" ]; then
    git init
    git config user.email "your-email@example.com"
    git config user.name "Your Name"
    echo "✅ Git inicializado"
else
    echo "ℹ️  Git ya existe"
fi

# Configura hooks de seguridad
mkdir -p .git/hooks

# Pre-push hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
# Pre-push hook to prevent accidental secret leaks

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔒 Verificando secretos antes de push...${NC}"

DANGEROUS_PATTERNS=(
    "OPENCLAW_GATEWAY_TOKEN"
    "OPENROUTER_API_KEY"
    "CLAUDE_CODE_OAUTH_TOKEN"
    "GMAIL_BOT_APP_PASSWORD"
    "Bearer sk-"
    "sk-or-v1-"
)

FOUND_SECRET=0

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if git diff HEAD...@{u} --name-only 2>/dev/null | xargs grep -l "$pattern" 2>/dev/null || false; then
        echo -e "${RED}❌ ¡PELIGRO! Patrón detectado: $pattern${NC}"
        FOUND_SECRET=1
    fi
done

if [ $FOUND_SECRET -eq 1 ]; then
    echo -e "${RED}Push bloqueado por seguridad.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Sin secretos detectados.${NC}"
exit 0
EOF

chmod +x .git/hooks/pre-push

# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook to catch secrets early

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🔍 Verificando commit..."

PATTERNS=(
    "OPENCLAW_GATEWAY_TOKEN"
    "OPENROUTER_API_KEY"
    "CLAUDE_CODE_OAUTH_TOKEN"
    "Bearer "
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
    if git diff --cached | grep -qE "$pattern"; then
        echo -e "${RED}❌ Detectado patrón sospechoso: $pattern${NC}"
        FOUND=1
    fi
done

if [ $FOUND -eq 1 ]; then
    echo -e "${RED}Commit bloqueado. Revisa tus cambios.${NC}"
    exit 1
fi

# Verifica .gitignore
for file in .age/keys.txt secrets/runtime/*.env .env; do
    if git diff --cached --name-only | grep -qE "^$file"; then
        echo -e "${RED}❌ ¡No puedes commitear $file!${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Listo para commit${NC}"
exit 0
EOF

chmod +x .git/hooks/pre-commit

echo "✅ Hooks de seguridad configurados"
echo ""
echo "📝 Próximos pasos:"
echo "   git add ."
echo "   git commit -m 'chore: initial setup'"
echo "   git branch -M main"
echo "   git remote add origin https://github.com/tu-usuario/mis-bots.git"
echo "   git push -u origin main"


