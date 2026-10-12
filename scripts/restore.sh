#!/usr/bin/env bash
# Restauration d'une sauvegarde créée par scripts/backup.sh.
# Usage : SUPABASE_DB_URL="postgresql://..." bash scripts/restore.sh backups/gft_AAAA-MM-JJ_HHMMSS.dump
set -euo pipefail

FILE="${1:?Indiquez le fichier de sauvegarde à restaurer}"
if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f .env.local ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- || true)
fi
: "${SUPABASE_DB_URL:?Définissez SUPABASE_DB_URL}"

echo "⚠️  Cette opération REMPLACE les données actuelles (clients, programmes, séances, pesées…)"
echo "    par celles de ${FILE}."
read -r -p "Tapez RESTAURER pour confirmer : " ANSWER
[ "$ANSWER" = "RESTAURER" ] || { echo "Annulé."; exit 1; }

echo "→ Sauvegarde de sécurité de l'état actuel…"
BACKUP_PREFIX=avant-restauration bash "$(dirname "$0")/backup.sh"

echo "→ Restauration (transaction unique : tout ou rien)…"
{
  echo "begin;"
  echo "truncate table public.clients, public.exercises, public.programs, public.program_sessions,"
  echo "  public.program_exercises, public.workout_logs, public.workout_sets, public.weight_goals,"
  echo "  public.weight_milestones, public.weigh_ins, public.measurements, public.reviews cascade;"
  pg_restore --data-only --no-owner --no-privileges -f - "$FILE"
  echo "commit;"
} | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --quiet

echo "✓ Restauration terminée."
