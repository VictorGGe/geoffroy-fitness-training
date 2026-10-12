#!/usr/bin/env bash
# Sauvegarde complète des données de Geoffroy Fitness Training.
# La structure (tables, sécurité) est recréée par les migrations de supabase/migrations.
# Usage : SUPABASE_DB_URL="postgresql://..." bash scripts/backup.sh
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f .env.local ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- || true)
fi
: "${SUPABASE_DB_URL:?Définissez SUPABASE_DB_URL (Supabase > Project Settings > Database > Connection string)}"

mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H%M%S)
FILE="backups/${BACKUP_PREFIX:-gft}_${STAMP}.dump"

echo "→ Sauvegarde en cours vers ${FILE}…"
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --data-only \
  --format=custom \
  --no-owner --no-privileges \
  --file="$FILE"

echo "✓ Sauvegarde terminée : ${FILE} ($(du -h "$FILE" | cut -f1))"
echo "  Conservez ce fichier en lieu sûr (disque chiffré, cloud privé). Il contient des données personnelles."
