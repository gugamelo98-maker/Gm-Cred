#!/usr/bin/env bash
# Remonta o projeto completo a partir das partes em ./partes
# Uso: ./remontar.sh [pasta_destino] [ate_parte]
#   pasta_destino  padrão: ./app
#   ate_parte      opcional: monta só até essa parte (ex: 06) para montagem incremental
set -euo pipefail
cd "$(dirname "$0")"
DEST="${1:-app}"
ATE="${2:-99}"
mkdir -p "$DEST"
for parte in partes/*/; do
  num="$(basename "$parte" | cut -d- -f1)"
  if [ "$num" \> "$ATE" ]; then continue; fi
  echo "→ $(basename "$parte")"
  cp -a "$parte/arquivos/." "$DEST/"
done
if [ ! -f "$DEST/.env" ]; then cp .env.example "$DEST/.env"; echo "→ .env criado a partir de .env.example (preencha os valores)"; fi
echo "Pronto. Próximos passos:  cd $DEST && npm install && npm run dev"
