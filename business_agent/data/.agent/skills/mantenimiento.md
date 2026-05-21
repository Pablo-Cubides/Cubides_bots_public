# SKILL: Mantenimiento del Sistema
**Descripción**: Este skill permite al agente revisar el estado del sistema, listar tareas pendientes y purgar logs antiguos.

## Comandos permitidos (CLI)
- `listar_procesos`
- `limpiar_logs`
- `verificar_estado`

## Ejecución
Cuando se invoque este skill, el agente debe:
1. Leer los archivos en `.agent/state/`
2. Si hay errores, registrarlo en `findings.md`.
3. Actualizar `progress.md` informando de la rutina exitosa.
