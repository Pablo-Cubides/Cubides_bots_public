# Tabla canónica de modelos para Colega (OpenClaw).
# Dot-source este archivo en switch-routing-profile.ps1 y apply-routing-policy.ps1
# para evitar duplicar las cadenas de modelo.
#
# Uso: . (Join-Path $PSScriptRoot 'lib\routing-models.ps1')

$ROUTE_FAST              = 'openai-codex/gpt-5.4-mini'
$ROUTE_STANDARD          = 'openai-codex/gpt-5.4'
$ROUTE_DEEP              = 'openai-codex/gpt-5.3-codex'
$ROUTE_FALLBACK          = 'openrouter/free'
$ROUTE_FREE_SECONDARY    = 'openrouter/google/gemma-4-26b-a4b-it:free'
$ROUTE_ECONOMIC          = 'openrouter/google/gemma-4-26b-a4b-it'

