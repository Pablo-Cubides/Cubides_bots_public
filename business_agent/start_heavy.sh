#!/bin/bash
set -e

export USER=socio
export DISPLAY=:1
export AGENT_DATA_DIR=/app/data

echo "========================================="
echo " SOCIO V2.0 - MODO AVANZADO (HEAVY)"
echo " Inicializando Entorno Gráfico (XFCE4)"
echo "========================================="

# Crear el Lock preventivo para detener a Socio Lite
touch /app/data/.heavy_lock
echo ">>> Lock de seguridad activado (/app/data/.heavy_lock). Socio Lite pausado."

# Configurar VNC password desde variable de entorno (usa secrets-setup-business.ps1)
if [ -z "${VNC_PASSWORD:-}" ]; then
    echo "ERROR: VNC_PASSWORD no está definida. Ejecuta scripts/secrets-setup-business.ps1 y vuelve a intentarlo." >&2
    exit 1
fi
mkdir -p ~/.vnc
printf '%s' "${VNC_PASSWORD}" | vncpasswd -f > ~/.vnc/passwd
chmod 600 ~/.vnc/passwd

# Limpiar puertos huérfanos si los hubiera
rm -f /tmp/.X1-lock
rm -f /tmp/.X11-unix/X1

# Iniciar servidor VNC con geometría estándar para navegador
vncserver :1 -geometry 1280x800 -depth 24

# Enlazar habilidades a heavy también
mkdir -p ~/.gemini/skills
if [ ! -L ~/.gemini/skills/antigravity-swarm ]; then
    ln -s /app/swarm ~/.gemini/skills/antigravity-swarm
fi

# Iniciar WebSocket para ver VNC en navegador en el puerto 6080
echo ">>> Consola visual disponible en http://localhost:6080"
websockify --web /usr/share/novnc 6080 localhost:5901 &

# Limpiar lock y VNC al apagar el contenedor (debe declararse ANTES del blocking command)
trap 'echo ">>> Apagando heavy mode..."; rm -f /app/data/.heavy_lock; vncserver -kill :1' EXIT

# Mantener vivo el contenedor para control manual via noVNC
tail -f /dev/null


