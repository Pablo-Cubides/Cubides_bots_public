# Security Policy

Este documento describe el modelo de seguridad del stack Cubides Bots, las prácticas implementadas y los procedimientos de respuesta a incidentes.

---

## Modelo de seguridad

El principio rector es **mínimo privilegio en cada capa**: cada agente recibe solo los secretos, capacidades de sistema y acceso de red que necesita para funcionar — nada más.

```
┌─────────────────────────────────────────────────────────────┐
│  Capa 1: Secretos      SOPS+AGE cifrado por agente          │
│  Capa 2: Red           127.0.0.1 only, sin exposición       │
│  Capa 3: Proceso       Usuario no-root, cap_drop ALL        │
│  Capa 4: Filesystem    read_only + tmpfs para /tmp          │
│  Capa 5: Aislamiento   Volúmenes dedicados, sin cruce       │
└─────────────────────────────────────────────────────────────┘
```

---

## Gestión de secretos

### Cadena de custodia

```
secrets-setup-*.ps1
    ↓ Read-Host -AsSecureString (nunca en texto plano en terminal)
    ↓ SOPS encrypt con clave AGE pública
    → secrets/*.enc.yaml  (cifrado, seguro versionar en git)

start-*.ps1
    ↓ sops --decrypt (requiere .age/keys.txt en disco local)
    → secrets/runtime/*.env  (efímero, gitignored)
    ↓ docker compose --env-file
    → variables de entorno del contenedor
```

### Qué se versiona en git

| Archivo | Se versiona | Motivo |
|---------|------------|--------|
| `secrets/*.enc.yaml` | ✅ Sí | Cifrado con AGE — seguro sin la clave privada |
| `.sops.yaml` | ✅ Sí | Solo contiene la clave pública AGE |
| `secrets/runtime/*.env` | ❌ No | Texto plano — gitignored |
| `.age/keys.txt` | ❌ No | Clave privada — gitignored |
| `.env` / `.env.*` | ❌ No | Variables locales — gitignored |

### Aislamiento de secretos por agente

Cada agente tiene su propio archivo cifrado independiente. Un agente comprometido no puede acceder a los secretos de los otros — incluso si el contenedor tuviera acceso al filesystem del host.

| Agente | Archivo cifrado | Secretos |
|--------|----------------|---------|
| Colega | `secrets/academic.enc.yaml` | `OPENCLAW_GATEWAY_TOKEN`, `OPENROUTER_API_KEY` |
| Coach | `secrets/personal.enc.yaml` | `CLAUDE_CODE_OAUTH_TOKEN`, `OPENROUTER_API_KEY` |
| Socio | `secrets/business.enc.yaml` | APIs opcionales (Telegram, OpenRouter, etc.) |

### La clave AGE privada

- Ubicación: `.age/keys.txt` (gitignored, solo en disco local)
- **Sin esta clave no se puede descifrar ningún secreto del stack**
- Haz backup en un gestor de contraseñas (1Password, Bitwarden, etc.) o en almacenamiento cifrado offline
- Si se pierde, hay que rotar todos los secretos desde cero

---

## Hardening Docker

### Capacidades y permisos

| Control de seguridad | `colega` | `personal` | `business_agent` | `business_agent_daemon` | `business_agent_heavy` |
|---------------------|----------|------------|-----------------|------------------------|----------------------|
| `cap_drop: ALL` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `no-new-privileges` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `read_only` filesystem | — | — | ✅ | ✅ | — ² |
| `tmpfs /tmp` | — | — | ✅ | ✅ | ✅ |
| Usuario no-root | — ¹ | `claude` (1001) | `appuser` | `appuser` | `socio` (1001) |

> ¹ Colega/OpenClaw mantiene `user: "0:0"` por compatibilidad pendiente de prueba formal non-root. Tiene `cap_drop: ALL` y `no-new-privileges`, pero sigue siendo deuda técnica.
> ² Socio Heavy usa VNC/browser; `read_only` puede romper perfiles y sockets. Se endureció con usuario no-root, `cap_drop: ALL`, `no-new-privileges` y `tmpfs /tmp`.

### Aislamiento de volúmenes

Cada agente tiene su propio volumen o bind mount — sin puntos de montaje cruzados:

```yaml
colega:                openclaw_data (named volume externo)
personal:              repo completo en /home/claude/workspace
business_agent:        ./business_agent/data
business_agent_daemon: ./business_agent/data
business_agent_heavy:  ./business_agent/data
voice_transcriber:     voice_transcriber_cache
```

La separación lógica entre memoria curada, runtime y artefactos está documentada en `docs/runtime-data-boundaries.md`.

---

## Aislamiento de red

Todos los puertos están enlazados a `127.0.0.1` — accesibles únicamente desde el host local:

```
colega:               127.0.0.1:18789  (OpenClaw UI + WebSocket)
business_agent:       127.0.0.1:8003   (FastAPI)
business_agent_heavy: 127.0.0.1:6080   (noVNC)
voice_transcriber:     127.0.0.1:8011   (STT local)
dashboard:             127.0.0.1:3100   (Centro de Comando)
```

Coach no expone ningún puerto. El acceso remoto se realiza mediante `claude remote-control`, que establece un túnel cifrado sin abrir puertos en el firewall.

### Acceso remoto seguro

Si necesitas acceder a los servicios desde fuera del host:

```
Opción 1: Tailscale (recomendado)
  → tailscale up
  → Los puertos son accesibles dentro de tu red privada Tailscale

Opción 2: SSH port forwarding
  → ssh -L 8003:127.0.0.1:8003 usuario@host

Opción 3: Reverse proxy con TLS (Traefik, nginx)
  → Requiere certificado válido y autenticación básica mínima
```

**Nunca** cambies el binding de `127.0.0.1` a `0.0.0.0` sin autenticación y TLS.

---

## Secretos que no deben exponerse

Lista de secretos críticos del stack:

- `OPENCLAW_GATEWAY_TOKEN` — acceso al gateway OpenClaw
- `OPENROUTER_API_KEY` — acceso a modelos vía OpenRouter (facturación por token)
- `CLAUDE_CODE_OAUTH_TOKEN` — sesión activa de Claude Pro/Max
- `ANTHROPIC_API_KEY` — si se usa, activa facturación PAYG directa
- `GMAIL_BOT_EMAIL` + `GMAIL_BOT_APP_PASSWORD` — credenciales de Gmail bot
- Cualquier token de Telegram, Vercel, o APIs de terceros en `business.enc.yaml`
- `DASHBOARD_ADMIN_TOKEN` / `AGENT_ADMIN_TOKEN` — controlan acciones locales del Centro de Comando y Socio API
- `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` — controlan los bots de Slack
- `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` — acceso OAuth a Drive, Docs, Slides y Calendar

Si alguno de estos aparece en texto plano en logs, archivos o git history — trátalo como comprometido y rótalo de inmediato.

---

## Rotación de secretos

Rota secretos cada 90 días o ante cualquier cambio de acceso (dispositivo perdido, colaborador que sale, etc.).

### Procedimiento general

```powershell
# 1. Genera el nuevo valor
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$newToken = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')

# 2. Guarda cifrado (reemplaza el valor anterior)
.\scripts\add-secret.ps1 -KeyName NOMBRE_DEL_SECRETO

# 3. Reinicia el servicio afectado
.\scripts\start-academic.ps1   # o start-personal / start-business
```

### Rotación de la clave AGE

En caso de compromiso de la clave privada (`.age/keys.txt`):

```powershell
# 1. Genera nueva clave AGE
age-keygen -o .age/keys_new.txt

# 2. Re-cifra todos los enc.yaml con la nueva clave pública
# (actualizar .sops.yaml con la nueva clave pública y re-ejecutar todos los secrets-setup-*.ps1)

# 3. Elimina la clave comprometida
Remove-Item .age/keys.txt
Rename-Item .age/keys_new.txt .age/keys.txt
```

---

## Verificación antes de pushear a git

```powershell
# Verifica que archivos sensibles están ignorados
git check-ignore -v .age/keys.txt
git check-ignore -v secrets/runtime/personal.env

# Revisa qué se va a subir
git status
git diff --cached

# Busca patrones de secreto en código fuente
grep -r "sk-" . --include="*.py" --include="*.js"   # API keys OpenAI/OpenRouter
grep -r "Bearer " . --include="*.yaml" --include="*.yml"

# Verifica que los enc.yaml están cifrados (no son JSON plano)
python -c "import yaml,sys; d=yaml.safe_load(open('secrets/academic.enc.yaml')); print('OK - cifrado' if 'sops' in d else 'ERROR - texto plano')"
```

---

## Coach — Autenticación Claude

Coach usa `CLAUDE_CODE_OAUTH_TOKEN` para autenticarse. La diferencia con `ANTHROPIC_API_KEY` es crítica en términos de costos:

| Método | Plan aplicado | Costo |
|--------|--------------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Pro / Max (suscripción) | Incluido en el plan mensual |
| `ANTHROPIC_API_KEY` | PAYG | Por token consumido |

El script `validate-personal.ps1` detecta si hay una API key configurada por error y alerta antes de operar.

---

## Centro de Comando

El dashboard local puede ejecutar acciones allowlist sobre Docker y scripts. Por eso:

- Requiere `DASHBOARD_ADMIN_TOKEN` o `AGENT_ADMIN_TOKEN`.
- Si no existe ningún token, falla cerrado con `503`.
- El token se ingresa en la UI y vive en `sessionStorage`.
- El backend no acepta comandos arbitrarios; solo acciones definidas por agente.
- Los logs pasan por redacción de secretos antes de mostrarse.

---

## Autonomía de Socio

Socio está configurado como agente autónomo porque el stack es personal y las órdenes vienen de Primary User/Primary User. Esa decisión queda explícita en:

```env
SOCIO_AUTO_APPROVE=true
```

Implicación:

- Gemini CLI puede ejecutar tool calls sin pedir confirmación en cada paso.
- Los secretos siguen protegidos por SOPS+AGE, deny-lists operativos y ausencia de impresión de valores.
- Acciones externas costosas, legales, publicación pública o invitados externos deben pedirse como confirmación humana según las instrucciones de identidad/rutinas.

Para una sesión conservadora:

```env
SOCIO_AUTO_APPROVE=false
```

---

## Permisos de archivo recomendados (Linux/WSL/Mac)

```bash
# Clave AGE — solo propietario puede leer
chmod 600 .age/keys.txt

# Secretos cifrados — solo lectura
chmod 400 secrets/*.enc.yaml

# Runtime env — solo propietario
chmod 600 secrets/runtime/*.env
```

---

## Acceso al repositorio en GitHub

1. **Repositorio privado** — mínimo requerido
2. **SSH keys** en lugar de contraseñas: `ssh-keygen -t ed25519 -C "tu@email.com"`
3. **Branch protection en `main`**: requiere al menos un reviewer para cambios en `secrets/` y `scripts/`
4. **No uses GitHub Actions con secretos del repo** sin evaluar el riesgo de exposición en logs de CI

---

## Incidentes — Respuesta

### Si un secreto quedó expuesto en texto plano

1. **Rota inmediatamente** el secreto afectado (ver sección de rotación)
2. Verifica logs de acceso del proveedor (OpenRouter, Anthropic, etc.) para detectar uso no autorizado
3. Si quedó en git history: usa `git filter-repo` para purgar el commit y force push
4. Notifica a colaboradores con acceso al repositorio

### Si `.age/keys.txt` se filtra

1. Asume que todos los secretos están comprometidos
2. Rota **todos** los secretos de todos los agentes desde cero
3. Genera nueva clave AGE y re-cifra los archivos `*.enc.yaml`
4. Revoca tokens y API keys en los paneles de los proveedores

### Reportar vulnerabilidades

Abre un **GitHub Private Security Advisory** en el repositorio. No uses issues públicos para reportar vulnerabilidades de seguridad.

