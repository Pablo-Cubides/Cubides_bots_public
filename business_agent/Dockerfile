FROM python:3.11-slim@sha256:6d85378d88a19cd4d76079817532d62232be95757cb45945a99fec8e8084b9c2

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias de sistema: curl, git, nodejs, npm y herramientas de busqueda/proceso
RUN apt-get update && apt-get install -y curl git gnupg2 ripgrep procps \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Crear usuario seguro
RUN groupadd -g 10001 appgroup && useradd -u 10001 -g appgroup -m -s /bin/bash appuser

# Instalar Gemini CLI oficial globalmente y validar que npm no haya dejado
# metadatos truncados en la imagen.
RUN npm install -g @google/gemini-cli \
    && node -e "JSON.parse(require('fs').readFileSync('/usr/lib/node_modules/@google/gemini-cli/package.json','utf8'))" \
    && mkdir -p /usr/lib/node_modules/@google/gemini-cli/bundle/vendor/ripgrep \
    && ln -sf /usr/bin/rg /usr/lib/node_modules/@google/gemini-cli/bundle/vendor/ripgrep/rg-linux-x64 \
    && npm cache clean --force

# Clonar Antigravity Swarm pinado a commit verificado
RUN git clone https://github.com/wjgoarxiv/antigravity-swarm.git /app/swarm \
    && cd /app/swarm && git checkout 8ad0b88ef364a9f6c00a05b6e251e937a1ce481d \
    && pip install --no-cache-dir -r /app/swarm/requirements.txt

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app
RUN mkdir -p /app/data

# Ajustar permisos para el usuario appuser
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8003

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
