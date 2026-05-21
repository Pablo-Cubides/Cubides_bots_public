---
paths:
  - "scripts/**/*.ps1"
  - "docker-compose.yml"
  - "**/Dockerfile*"
---

# Operations rules

- Keep startup scripts idempotent and safe to rerun.
- Fail fast with actionable error messages.
- Validate required tools and secrets before starting services.
- Preserve existing service names and network bindings unless required.

