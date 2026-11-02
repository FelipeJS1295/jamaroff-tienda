#!/usr/bin/env sh
# Respaldo diario de la base de datos y las fotos. Guarda 14 días.
# Programarlo (como root en el VPS):  crontab -e
#   30 4 * * * cd /opt/jamaroff && sh scripts/backup.sh >> backups/backup.log 2>&1
set -e
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y-%m-%d_%H%M)
docker compose exec -T db pg_dump -U jamaroff -d jamaroff --no-owner | gzip > "backups/db_$STAMP.sql.gz"
docker compose run --rm --no-deps -v "$(pwd)/backups:/backups" --entrypoint sh app -c "tar czf /backups/fotos_$STAMP.tar.gz -C /app uploads"
find backups -name 'db_*.sql.gz' -mtime +14 -delete
find backups -name 'fotos_*.tar.gz' -mtime +14 -delete
echo "✓ Respaldo $STAMP listo"
