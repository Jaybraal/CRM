#!/bin/bash
# Arranque local del CRM-Auto completo
# Levanta: CRM (Next.js :3001) + Baileys (WhatsApp :3002) + N8N (bot :5678)

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
N8N_BIN="/tmp/n8n-prefix/bin/n8n"

# Leer GROQ_API_KEY desde .env.local (nunca hardcodear claves)
GROQ_KEY=""
if [ -f "$DIR/.env.local" ]; then
  GROQ_KEY=$(grep -E '^GROQ_API_KEY=' "$DIR/.env.local" | head -1 | cut -d'=' -f2- | tr -d '"')
fi
if [ -z "$GROQ_KEY" ]; then
  warn "GROQ_API_KEY no encontrado en .env.local — N8N arrancará sin acceso a Groq"
fi

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[CRM]${NC} $*"; }
warn() { echo -e "${YELLOW}[CRM]${NC} $*"; }
err()  { echo -e "${RED}[CRM]${NC} $*"; }

# Verificar que N8N está instalado
if [ ! -f "$N8N_BIN" ]; then
  warn "N8N no encontrado en $N8N_BIN. Instalando..."
  mkdir -p /tmp/npm-cache /tmp/n8n-prefix
  npm_config_cache=/tmp/npm-cache npm_config_prefix=/tmp/n8n-prefix npm install -g n8n 2>&1 | tail -3
  log "N8N instalado"
fi

# Función para matar procesos al salir (Ctrl+C)
cleanup() {
  echo ""
  warn "Deteniendo todos los servicios..."
  kill "$PID_N8N" "$PID_BAILEYS" "$PID_CRM" 2>/dev/null || true
  wait 2>/dev/null
  log "Servicios detenidos. Hasta luego."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. N8N ───────────────────────────────────────────────────────────────────
log "Iniciando N8N en http://localhost:5678 ..."
N8N_PORT=5678 \
N8N_DIAGNOSTICS_ENABLED=false \
N8N_VERSION_NOTIFICATIONS_ENABLED=false \
GROQ_API_KEY="$GROQ_KEY" \
"$N8N_BIN" start > /tmp/n8n.log 2>&1 &
PID_N8N=$!

# Esperar a que N8N arranque
for i in {1..20}; do
  if curl -s http://localhost:5678/healthz | grep -q ok 2>/dev/null; then
    log "N8N listo ✓"
    break
  fi
  sleep 1
done

# ── 2. Baileys (WhatsApp) ────────────────────────────────────────────────────
log "Iniciando Baileys en http://localhost:3002 ..."
node "$DIR/baileys-server/index.js" > /tmp/baileys.log 2>&1 &
PID_BAILEYS=$!
sleep 2
log "Baileys listo ✓"

# ── 3. CRM (Next.js) ─────────────────────────────────────────────────────────
log "Iniciando CRM en http://localhost:3001 ..."
cd "$DIR"
PORT=3001 npm run dev > /tmp/crm.log 2>&1 &
PID_CRM=$!

# Esperar a que el CRM arranque
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null | grep -qE "200|307|302"; then
    break
  fi
  sleep 1
done
log "CRM listo ✓"

# ── Resumen ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  CRM-Auto corriendo localmente${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  CRM        →  http://localhost:3001"
echo -e "  Baileys    →  http://localhost:3002"
echo -e "  N8N        →  http://localhost:5678"
echo ""
echo -e "  Logs:"
echo -e "    CRM:     tail -f /tmp/crm.log"
echo -e "    Baileys: tail -f /tmp/baileys.log"
echo -e "    N8N:     tail -f /tmp/n8n.log"
echo ""
echo -e "  Presiona ${YELLOW}Ctrl+C${NC} para detener todo."
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Mantener vivo (esperar a que los hijos terminen o Ctrl+C)
wait
