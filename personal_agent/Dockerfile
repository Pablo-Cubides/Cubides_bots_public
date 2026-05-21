FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0

ARG CLAUDE_UID=1001
ARG CLAUDE_GID=1001

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
	   bash \
	   ca-certificates \
	   curl \
	   git \
	   less \
	   openssh-client \
	   ripgrep \
	   tini \
	   tzdata \
	&& rm -rf /var/lib/apt/lists/*

RUN groupadd --gid ${CLAUDE_GID} claude \
	&& useradd --uid ${CLAUDE_UID} --gid ${CLAUDE_GID} --create-home --shell /bin/bash claude

ENV HOME=/home/claude \
	CLAUDE_HOME=/home/claude/.claude \
	PATH=/home/claude/.local/bin:${PATH}

RUN mkdir -p /home/claude/workspace /home/claude/.claude \
	&& chown -R claude:claude /home/claude/workspace /home/claude

WORKDIR /home/claude/workspace
USER claude

# Pinnear versión exacta. Para actualizar: docker build --build-arg CLAUDE_CODE_VERSION=<nueva>
ARG CLAUDE_CODE_VERSION=2.1.126
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} --prefix /home/claude/.local && \
    /home/claude/.local/bin/claude --version

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "-lc", "echo 'personal listo. Ejecuta: claude'; sleep infinity"]
