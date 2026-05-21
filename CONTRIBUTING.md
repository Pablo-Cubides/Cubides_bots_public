# Contribuciones

## Flujo de desarrollo

1. **Fork** el repo en GitHub.
2. **Clone** tu fork localmente:
   ```bash
   git clone https://github.com/tu-usuario/mis-bots.git
   cd mis-bots
   ```

3. **Setup inicial**:
   ```powershell
   # Windows
   powershell -ExecutionPolicy Bypass -File .\scripts\secrets-setup.ps1
   
   # Linux/WSL
   ./scripts/secrets-setup.sh  # (si existe)
   ```

4. **Crea rama** para tu cambio:
   ```bash
   git checkout -b feature/mi-cambio
   ```

5. **Haz tu cambio** y **testa localmente**:
   ```bash
   docker compose build
   docker compose up -d colega
   docker logs -f colega
   ```

6. **Commit** con mensajes claros:
   ```bash
   git commit -m "feat: nuevo modelo en colega"
   git commit -m "fix: healthcheck en business_agent"
   git commit -m "docs: actualiza README con permisos"
   ```

7. **Push** a tu fork:
   ```bash
   git push origin feature/mi-cambio
   ```

8. **Pull Request** a `main` con descripción clara.

## Reglas importantes

- ✅ **Nunca commitees secretos**. Si ves que algo se filtró, avisa inmediatamente.
- ✅ **Tests locales antes de PR**. Asegúrate de que Docker builds sin errores.
- ✅ **Docs actualizadas**. Si cambias arquitectura, actualiza README/SECURITY.
- ✅ **Mensajes de commit claros**. Usa: `feat:`, `fix:`, `docs:`, `refactor:`.

## Estructura del proyecto

```
├── colega/                  # OpenClaw académico (Node.js)
├── personal_agent/          # Claude interactivo (Node.js)
├── business_agent/          # API + daemon (Python)
├── scripts/                 # Setup y lanzamiento
├── secrets/                 # Secretos cifrados (NO editar manualmente)
├── docker-compose.yml       # Orquestación
├── SECURITY.md              # Política de secretos
└── README.md                # Documentación principal
```

## Cómo agregar un nuevo secreto

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\add-secret.ps1 -KeyName MI_NUEVO_SECRETO
```

Luego, restarta el agente afectado:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-academic.ps1
```

## Debugging

**Ver logs en tiempo real**:
```bash
docker compose logs -f colega
docker compose logs -f business_agent
```

**Conectar al contenedor**:
```bash
docker compose exec colega bash
docker compose exec personal bash
docker compose exec business_agent bash
```

**Verificar secretos cargados**:
```bash
docker compose exec colega env | grep OPENCLAW
docker compose exec business_agent env | grep AGENT
```

## Preguntas?

Abre un **issue** o un **discussion** en GitHub. No dudes en preguntar.


