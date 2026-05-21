# GitHub Setup - Guía Rápida

## ✅ Estado Actual (Seguro)

Tu repositorio está listo para GitHub con máximas garantías de seguridad:

### Archivos de Seguridad Agregados

- **`.gitignore`**: Excluye todos los archivos sensibles
- **`.gitattributes`**: Marca secretos cifrados como binarios
- **`.github/CODEOWNERS`**: Define quién revisa cambios críticos
- **`.github/workflows/build.yml`**: CI básico (build + lint, sin secretos)
- **`SECURITY.md`**: Política completa de secretos y acceso
- **`CONTRIBUTING.md`**: Guía para colaboradores

### Cambios en Arquitectura

- ✅ **Personal**: Solo monta `/personal_agent`, no todo el repo (`read_only`)
- ✅ **Colega**: OpenClaw directo, sin legacy de `academic_agent`
- ✅ **Healthchecks**: Automáticos en compose para todos los servicios
- ✅ **Secretos**: Cada agente con `*.env` aislado y propio

### No se subirá a GitHub

- ❌ `.age/keys.txt` (tu clave privada)
- ❌ `secrets/runtime/*.env` (secretos en runtime)
- ❌ `.env` (variables locales)
- ❌ `__pycache__`, `node_modules`, `.venv`

---

## 🚀 Pasos para Subir a GitHub

### Opción 1: CLI (recomendado)

```powershell
# 1. Inicializa Git con hooks de seguridad
powershell -ExecutionPolicy Bypass -File .\scripts\init-github.ps1

# 2. Verifica qué se va a subir
git status

# 3. Añade TODO
git add .

# 4. Primer commit
git commit -m "chore: initial multi-agent setup with OpenClaw + Personal + Business"

# 5. Renombra rama a main (si estás en master)
git branch -M main

# 6. Conecta a GitHub (reemplaza TU-USUARIO)
git remote add origin https://github.com/TU-USUARIO/mis-bots.git

# 7. Pushea (verifica que sea repo PRIVADO en GitHub)
git push -u origin main
```

### Opción 2: GitHub Desktop

1. File → Clone Repository → Paste URL
2. O File → Initialize → Selecciona carpeta `/mis bots`
3. Publish → Asegúrate que es "Private"

### Opción 3: Web (Simple)

1. https://github.com/new
2. Nombre: `mis-bots`
3. **Privado** ✓
4. Crea repo
5. Sigue instrucciones setup

---

## 🔐 Verificación Pre-Push

Antes de hacer push, verifica:

```powershell
# 1. ¿Están excluidos los secretos?
git check-ignore -v .age/keys.txt
git check-ignore -v secrets/runtime/personal.env

# 2. ¿Qué vamos a subir?
git diff --cached --name-only

# 3. ¿Tiene patrones sospechosos?
git diff --cached | Select-String -Pattern "OPENCLAW_GATEWAY_TOKEN|OPENROUTER_API_KEY|Bearer"

# 4. ¿Está vacío?
git diff --cached | Measure-Object -Line
```

---

## 📋 Configuración de GitHub (Después de subir)

### 1. Haz el repo PRIVADO

Settings → General → Visibility → Private ✓

### 2. Branch Protection

Settings → Branches → Add Rule:
- Branch name pattern: `main`
- Require pull request before merging: ✓
- Require status checks to pass: ✓ (cuando tengas CI)
- Require code review: ✓ (si trabajas en equipo)

### 3. Secret Scanning (GitHub Enterprise o Free?)

Si tienes Secret Scanning habilitado, GitHub detectará patrones de secretos automáticamente.

---

## 🔄 Flujo de desarrollo normal

```bash
# Crear rama
git checkout -b feature/mi-cambio

# Hacer cambios
# ... edita archivos ...

# Commit (hooks validan seguridad)
git add .
git commit -m "feat: nuevo modelo en business_agent"

# Push
git push origin feature/mi-cambio

# En GitHub: crea Pull Request
# Review + Merge a main
```

---

## 🆘 ¿Accidentalmente commitee un secreto?

Si hiciste `git push` con un secreto:

### Opción 1: Rota el secreto (recomendado)

```powershell
# 1. Genera nuevo token
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$newToken = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')

# 2. Actualiza en SOPS
powershell -ExecutionPolicy Bypass -File .\scripts\add-secret.ps1 -KeyName OPENCLAW_GATEWAY_TOKEN -KeyValue $newToken

# 3. Reinicia servicio
powershell -ExecutionPolicy Bypass -File .\scripts\start-academic.ps1
```

El token viejo en el history de GitHub queda inútil. ✅ Problema resuelto.

### Opción 2: Force-push (último recurso, solo en privado)

⚠️ Solo si absolutamente necesario y es un repo privado único.

```bash
# Revertir último commit
git reset --soft HEAD~1

# Limpiar archivos sensibles
git reset HEAD .env
git checkout -- .env

# Reconmitear sin secretos
git add .
git commit -m "fix: remove accidental secrets"

# Force push (¡PELIGRO!)
git push -f origin main
```

---

## ✨ Checkpoints

- [ ] Repo creado en GitHub (privado)
- [ ] Primer push ejecutado
- [ ] `.gitignore` funcionando (verifica con `git check-ignore`)
- [ ] Secretos cifrados en `secrets/*.enc.yaml`
- [ ] Runtime envs no versionados
- [ ] README, SECURITY.md, CONTRIBUTING.md visibles en GitHub
- [ ] Hooks pre-commit configurados localmente

---

## 📚 Documentación final

Después de pushear, verifica que tus colaboradores pueden:

1. Clonar el repo: `git clone https://github.com/TU-USUARIO/mis-bots.git`
2. Setup local: `powershell -ExecutionPolicy Bypass -File .\scripts\secrets-setup.ps1`
3. Arrancar agentes: `powershell -ExecutionPolicy Bypass -File .\scripts\start-academic.ps1`

Si todo funciona, ¡listo! 🎉

---

## Dudas?

- Revisa `CONTRIBUTING.md` para colaboradores
- Revisa `SECURITY.md` para política de secretos
- GitHub Docs: https://docs.github.com/en/get-started


