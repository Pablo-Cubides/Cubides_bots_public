# Security rules

- Never read or print credentials from `.env`, `.env.*`, `secrets/**`, or `.age/**`.
- Use scripts under `scripts/` for secret setup and runtime env generation.
- Do not hardcode API keys or tokens in source files.
- Prefer least-privilege changes in Docker and scripts.


