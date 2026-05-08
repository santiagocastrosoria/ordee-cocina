#!/usr/bin/env bash
# Copia las variables publicas de Supabase desde ordee-mvp a este proyecto.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/../ordee-mvp/.env.local"
DST="$ROOT/.env.local"

if [[ ! -f "$SRC" ]]; then
  echo "No existe $SRC. Crea ordee-mvp/.env.local primero."
  exit 1
fi

grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=' "$SRC" > "$DST" || true
if [[ ! -s "$DST" ]]; then
  echo "No se encontraron NEXT_PUBLIC_SUPABASE_* en $SRC"
  exit 1
fi

echo "Escrito $DST. Reinicia: npm run dev"
