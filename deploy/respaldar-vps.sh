#!/usr/bin/env bash
# Respaldo diario de la tienda: base de datos y fotos (guarda 14 días en deploy/respaldos).
# Lo deja programado el instalador; también se puede correr a mano.
set -euo pipefail
cd "$(dirname "$0")/.."
DC="docker compose -f deploy/docker-compose.prod.yml --env-file .env"
STAMP=$(date +%Y%m%d-%H%M)
$DC exec -T db pg_dump -U jamaroff -d jamaroff -Fc -f "/respaldos/jamaroff-$STAMP.dump"
$DC exec -T app tar czf - -C /app uploads > "deploy/respaldos/fotos-$STAMP.tar.gz"
find deploy/respaldos -name 'jamaroff-*.dump' -mtime +14 -delete
find deploy/respaldos -name 'fotos-*.tar.gz' -mtime +14 -delete
echo "Respaldo listo: deploy/respaldos/jamaroff-$STAMP.dump y fotos-$STAMP.tar.gz"
