# Changelog

## [Unreleased]

### 🔌 Slack Bridge — disponibilidad y diagnóstico (2026-05-07)

- ✅ **Bug preexistente arreglado**: `start-slack-bridge.ps1 -Detached` no escribía el PID al archivo `.tmp/slack-bridge.pid`, así que el dashboard nunca detectaba el bridge corriendo. Ahora lo escribe correctamente.
- ✅ **Auto-start integrado**: `start-academic.ps1`, `start-business.ps1`, `start-personal.ps1` invocan `start-slack-bridge.ps1 -Detached` al final de su flujo. Es idempotente (no-op si ya está vivo). Garantiza que arrancar cualquier agente deja el bridge listo.
- ✅ **Dashboard refleja estado real del bridge**: el status del canal Slack en `dashboard/lib/snapshot.ts` ahora depende de si el proceso del bridge está vivo, no solo de si los secretos están presentes. Antes el dashboard mostraba `active` aunque el bridge estuviera caído (porque solo verificaba Docker + secretos).
  - Bridge corriendo + secretos OK → `active`
  - Secretos OK pero bridge caído → `configured` (en lugar de un falso `active`)

### 💰 Coach: removido `--max-budget-usd` (incompatible con OAuth) (2026-05-07)

- ✅ `slack_bridge/src/index.js`: removido `--max-budget-usd 0.08` del invoker de Coach. Coach usa `CLAUDE_CODE_OAUTH_TOKEN` (plan Pro/Max), donde el uso sale del **cupo del plan** (ventana rodante 5 h + cap semanal), no por token. `--max-budget-usd` cappea el costo *estimado localmente* y aborta respuestas válidas aunque no haya cobro real. El system prompt de Claude Code (~50K tokens en cache) ya estima ~$0.05 antes de generar respuesta, así que cualquier cap < $0.10 reventaba sistemáticamente.
- ✅ `scripts/start-personal.ps1`: removido `--max-budget-usd 0.01` del probe OAuth, por la misma razón. Comentario explicativo agregado.
- ℹ️ **Caps retenidos intencionalmente** en `discover-model-access.ps1` y `audit-model-access.ps1` como salvaguarda defensiva (diagnósticos que prueban modelos arbitrarios — protegen si alguien configura `ANTHROPIC_API_KEY` por error).
- 📚 Doc autoritativa: [code.claude.com/docs/en/costs](https://code.claude.com/docs/en/costs) — *"Claude Max and Pro subscribers have usage included in their subscription, so the session cost figure isn't relevant for billing purposes."*

### 🔒 Seguridad (2026-05-07)

- ✅ `socio` daemon: input de tareas ahora sanitiza caracteres de control y XML-escapa `<`, `>`, `&` antes de escribir en `task_plan.md` (P0-1).
- ✅ `socio` daemon: prompt de Gemini envuelve la tarea en `<TAREA-USUARIO>…</TAREA-USUARIO>` como frontera de confianza (P0-2).
- ✅ `socio` daemon: eliminado `--yolo`; modo predeterminado es `--approval-mode plan`. Optar por auto-aprobación requiere `SOCIO_AUTO_APPROVE=true` explícito (P0-3).
- ✅ `socio heavy`: Dockerfile.heavy ya no corre como root — usuario `socio` (UID 1001) con ownership correcto (P0-4).
- ✅ `socio heavy`: `${VNC_PASSWORD:-socio_heavy}` reemplazado por `${VNC_PASSWORD:?…}` — la contraseña es obligatoria en arranque (P0-4).
- ✅ `coach`: `defaultMode` bajado de `acceptEdits` a `default`; hooks `PreToolUse` reales bloquean accesos shell a `secrets/**`, `.env*`, `.age/**` (P1-1).
- ✅ `coach`: Claude Code CLI pinneado a versión exacta en Dockerfile — sin `curl | bash` ni fallback implícito (P1-3).
- ✅ `coach`: `start-personal.ps1` ahora prueba el OAuth token contra la API real con caché de 24 h (P1-4).

### 🧩 Configuración (2026-05-07)

- ✅ `coach`: corregido scope en `rules/python.md` (cubría solo `business_agent/**` en vez de `personal_agent/**`) (P1-2).
- ✅ `colega`: perfil de usuario montado en `/data/openclaw/profile:ro` para que OpenClaw pueda leerlo (P1-6).
- ✅ Scripts de routing: tabla de modelos extraída a `scripts/lib/routing-models.ps1` — fuente única de verdad (P1-7).
- ✅ Scripts de auditoría: nombres de contenedores ahora configurables via parámetros (`-ColegaContainer`, `-PersonalContainer`, `-DaemonContainer`) con fallback a env vars (P2-3).
- ✅ CI restaurado: `.github/workflows/build.yml` recreado (fue eliminado en commit `14a2c74`); valida los 4 Dockerfiles, `py_compile`, `shellcheck` y `PSScriptAnalyzer` (P2-1).
- ✅ Digest pins: creado `scripts/refresh-image-digests.ps1` para anclar imágenes base por `sha256:` de forma reproducible (P2-2).
- ✅ Eliminado `code_review_audit_report.md` (obsoleto desde 2026-05-03; reemplazado por el plan de mejoras actual) (P2-4).

### 📍 Estado operativo

- ✅ Documentado estado actual del stack en `docs/current-state.md`.
- ✅ `colega`: migrado/recreado desde `D:\Agents` preservando el volumen externo `misbots_openclaw_data`.
- ✅ `colega`: aclarado que el botón interno `Update now` puede quedar en `status=skipped`; la actualización real se hace con `docker compose build --pull colega`.
- ✅ `colega`: routing actualizado por fases `fast`, `standard`, `deep` y `fallback`.
- ✅ `coach`: validado flujo Claude Code con `CLAUDE_CODE_OAUTH_TOKEN` y sin `ANTHROPIC_API_KEY`.
- ✅ `socio`: documentadas fases Gemini `flash-lite`, `flash`, `pro` y pausa esperada de Lite cuando Heavy está activo.
- ✅ `dashboard`: creado Centro de Comando local en Next.js con miniverso estilo AI town, inspector técnico y acciones allowlist.
- ✅ Agregados comandos para rutinas diarias/dominicales y correos propios por agente.
- ✅ Slack preparado por agente con Socket Mode, secretos cifrados, bridge local y estado en dashboard.
- ✅ Dashboard distingue canales `pendiente`, `configurado` y `activo` para evitar falsos `planned` cuando el secreto ya existe cifrado.

### 🧩 Configuración

- ✅ `personal`: el workspace ahora monta el repo completo en `/home/claude/workspace`
- ✅ Bloqueo explícito de escrituras a `.env*`, `secrets/**` y `.age/**` en Claude Code
- ✅ `business_agent`: rutas basadas en `AGENT_DATA_DIR`
- ✅ `heartbeat`: intervalo y timeout configurables por env (`HEARTBEAT_INTERVAL_SECONDS`, `GEMINI_TIMEOUT_SECONDS`)
- ✅ UI de Socio muestra estado “Gemini CLI” para evitar desalineación de modelo

## [v1.0.0] - 2026-04-15

### 🔐 Seguridad

- ✅ Reforzado `.gitignore` con patrones exhaustivos (secretos, binarios, temp files)
- ✅ Agregado `.gitattributes` para marcar cifrados como binarios
- ✅ Creado `SECURITY.md` con política completa de secretos y acceso
- ✅ Agregado `.github/CODEOWNERS` para code review de cambios críticos
- ✅ Agregado `.github/workflows/build.yml` para CI (build + lint, sin secretos)
- ✅ Creados scripts de setup para GitHub: `init-github.ps1`, `init-git.sh`

### 🏗️ Arquitectura

- ✅ Simplificada arquitectura académica: solo OpenClaw (`colega`) en producción
- ✅ Eliminado código legacy `academic_agent` (FastAPI redundante)
- ✅ Ajustados permisos del contenedor `personal`: solo monta `/personal_agent` en modo `read_only`
- ✅ Agregados `healthcheck` automáticos en compose para todos los servicios
- ✅ Confirmado aislamiento de volúmenes: cada agente con almacenamiento dedicado

### 🔒 Permisos y Aislamiento

**`colega` (OpenClaw)**
- User: `root` (necesario para OpenClaw)
- Volumen: `openclaw_data` (solo OpenClaw)
- Puertos: `127.0.0.1:18789` (localhost only)
- Hardening: `cap_drop: ALL`, `no-new-privileges`
- Healthcheck: `GET http://localhost:18789/health`

**`personal` (Claude)**
- User: `claude` (UID 1001, no-root)
- Volumen: `./personal_agent:/home/claude/workspace:ro` (read-only, aislado)
- Puertos: ninguno (interactivo solo)
- Hardening: `cap_drop: ALL`, `no-new-privileges`
- Sin healthcheck (interactivo)

**`business_agent` + `daemon`**
- User: `appuser` (UID 10001, no-root)
- Volumen: `business_agent_data` (solo business)
- Puertos: `127.0.0.1:8003` (API, localhost only)
- Hardening: `cap_drop: ALL`, `no-new-privileges`, `read_only`, `tmpfs /tmp`
- Healthcheck: `GET http://localhost:8003/health`

### 📝 Documentación

- ✅ Actualizado `README.md` con arquitectura clara y referencias a `SECURITY.md`
- ✅ Creado `SECURITY.md` con política de secretos, rotación, exposición a Internet
- ✅ Creado `CONTRIBUTING.md` con guía de desarrollo, flujo Git, debugging
- ✅ Creado `GITHUB-SETUP.md` con pasos exactos para pushear a GitHub

### 🗂️ Cambios en archivos

**Modificados:**
- `docker-compose.yml`: Añadido healthchecks, ajustados volúmenes de `personal`
- `.gitignore`: Reforzado con patrones completos y comentados
- `README.md`: Actualizado con referencias a documentación y cambios de arquitectura

**Creados:**
- `.gitattributes`: Configuración de line endings y tratamiento de binarios
- `.github/CODEOWNERS`: Code owners para cambios críticos
- `.github/workflows/build.yml`: CI básico
- `SECURITY.md`: Política de seguridad completa
- `CONTRIBUTING.md`: Guía para contribuidores
- `GITHUB-SETUP.md`: Paso a paso para GitHub
- `CHANGELOG.md`: Este archivo

**Scripts nuevos:**
- `scripts/init-github.ps1`: Setup de Git + hooks + instrucciones GitHub
- `scripts/init-git.sh`: Equivalente en Bash

**Eliminados (ya) o Retirados:**
- `academic_agent/` (fue retirado antes, solo contenía código legacy no usado)
- `secrets/runtime/academic_agent.env` (legacy)
- `secrets/runtime/openclaw.env` (legacy)

### 🚀 Estado del Repositorio

**Listo para GitHub:**
- ✅ Sin archivos sensibles
- ✅ Secretos cifrados (SOPS+AGE) o no versionados
- ✅ Documentación completa
- ✅ Hooks de seguridad pre-configurados
- ✅ CI/CD básico

**Siguiente paso recomendado:**
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-github.ps1
git add .
git commit -m "chore: security hardening and GitHub preparation"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mis-bots.git
git push -u origin main
```

### ℹ️ Notas

- Todos los puertos están en `127.0.0.1` (localhost) por defecto. No expongas sin túnel/HTTPS.
- Secretos se rotan recomendando cada 90 días.
- `.age/keys.txt` nunca se sube a Git (es local, personal).
- Pre-commit hooks detectan patrones sospechosos automáticamente.

---

## Versiones Anteriores

N/A - Este es el primer setup completo y seguro.


