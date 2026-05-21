FROM alpine/openclaw:latest@sha256:1af3f457a2d5a1d210f4d95634fa5da6e23f9c0ac7b52ef4bc38e2ecf09704fd

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        pkg-config \
        python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir -p /opt/openclaw-local-embeddings \
    && cd /opt/openclaw-local-embeddings \
    && npm init -y \
    && npm install --omit=dev --no-audit --no-fund node-llama-cpp \
    && ln -s /opt/openclaw-local-embeddings/node_modules/node-llama-cpp /app/node_modules/node-llama-cpp \
    && npm cache clean --force \
    && chown -R node:node /opt/openclaw-local-embeddings /app/node_modules/node-llama-cpp

USER node
