#!/bin/bash
# Bloquea comandos Bash que acceden directamente a paths de secretos protegidos.
# Ejecutado por Claude Code como hook PreToolUse sobre la herramienta Bash.
node - <<'EOF'
const inp = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const cmd = inp.command || '';
if (/(secrets\/|\.env(\.[a-z]|$)|\.age\/)/.test(cmd)) {
  process.stderr.write('[Coach Security] Bloqueado: el comando accede a paths protegidos (secrets/, .env*, .age/).\n');
  process.exit(1);
}
EOF


