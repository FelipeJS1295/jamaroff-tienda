#!/usr/bin/env bash
# =============================================================================
# Jamaroff · instalación / actualización en el VPS (mismo VPS de Cuadra)
#   Primera vez:  git clone https://github.com/FelipeJS1295/jamaroff-tienda.git /opt/jamaroff
#                 cd /opt/jamaroff && sudo bash deploy/instalar-en-vps.sh
#   Actualizar:   cd /opt/jamaroff && sudo git pull && sudo bash deploy/instalar-en-vps.sh
# - Primera vez: crea el .env con claves nuevas, la base, el administrador, Nginx + HTTPS
#   (www.jamaroff.cl) y el respaldo diario. Webpay queda en modo de PRUEBAS (integración).
# - Las veces siguientes: solo recompila y reinicia (la base y las fotos no se tocan).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DC="docker compose -f deploy/docker-compose.prod.yml --env-file .env"
DOMAIN=www.jamaroff.cl
APEX=jamaroff.cl
ok()   { echo -e "\e[32m✔\e[0m $*"; }
info() { echo -e "\e[36m→\e[0m $*"; }
fail() { echo -e "\e[31m✘ $*\e[0m"; exit 1; }

# --- 0. Requisitos y .env ---------------------------------------------------
command -v docker >/dev/null || fail "No está Docker. Instálalo con:  curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || fail "Falta 'docker compose' (plugin v2). Instálalo con:  apt install docker-compose-plugin"
mkdir -p deploy/respaldos

if [ ! -f .env ]; then
  info "Creando .env con claves nuevas…"
  rnd() { openssl rand -hex "$1"; }
  sed -e "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" \
      -e "s|^SITE_URL=.*|SITE_URL=https://$DOMAIN|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rnd 18)|" \
      -e "s|^AUTH_SECRET=.*|AUTH_SECRET=$(rnd 32)|" \
      -e "s|^WEBPAY_ENV=.*|WEBPAY_ENV=integration|" \
      -e "s|^CUADRA_API_KEY=.*|CUADRA_API_KEY=$(rnd 24)|" \
      .env.example > .env
  {
    echo
    echo "# ─── VPS ───────────────────────────────────────────────────────────"
    echo "# Puerto interno de la tienda (Nginx lo publica en https://$DOMAIN)"
    echo "APP_HOST_PORT=3390"
    echo "# Administrador de la tienda (se crea la primera vez)"
    echo "ADMIN_EMAIL=${ADMIN_EMAIL:-admin@jamaroff.cl}"
    echo "ADMIN_PASSWORD=$(rnd 8)"
  } >> .env
  ok ".env creado (revisa los datos de correo SMTP cuando quieras: nano /opt/jamaroff/.env)"
fi
chmod 600 .env
set -a; . ./.env; set +a
[ -n "${AUTH_SECRET:-}" ] || fail "AUTH_SECRET vacío en .env"
[ -n "${POSTGRES_PASSWORD:-}" ] || fail "POSTGRES_PASSWORD vacío en .env"
APP_HOST_PORT=${APP_HOST_PORT:-3390}

# Puerto libre (Cuadra y los otros sistemas del VPS ya usan algunos)
if ! $DC ps -q app 2>/dev/null | grep -q .; then
  ss -ltn "( sport = :$APP_HOST_PORT )" | grep -q LISTEN && fail "El puerto $APP_HOST_PORT ya está ocupado. Cambia APP_HOST_PORT en .env y vuelve a correr."
fi

# --- 1. Base de datos y tienda ----------------------------------------------
info "Compilando y levantando la tienda (la primera vez tarda unos minutos)…"
$DC up -d --build
for i in $(seq 1 60); do
  curl -fs -o /dev/null "http://127.0.0.1:$APP_HOST_PORT/" && break
  sleep 3
done
curl -fs -o /dev/null "http://127.0.0.1:$APP_HOST_PORT/" && ok "Tienda respondiendo en el puerto $APP_HOST_PORT" \
  || { $DC logs --tail 40 app; fail "La tienda no partió (logs arriba)"; }

# Administrador: solo si aún no hay ninguno
ADMINS=$($DC exec -T db psql -U jamaroff -d jamaroff -tA -c "select count(*) from users where role='admin'" | tr -d '[:space:]')
if [ "$ADMINS" = "0" ] && [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  $DC exec -T app npx tsx scripts/create-admin.ts "$ADMIN_EMAIL" "Admin Jamaroff" "$ADMIN_PASSWORD" && ok "Administrador creado: $ADMIN_EMAIL"
fi
# Productos de ejemplo: solo si se pide (sudo SEED=1 bash deploy/instalar-en-vps.sh)
[ "${SEED:-0}" = "1" ] && $DC exec -T app npx tsx scripts/seed.ts

# --- 2. Nginx + HTTPS -------------------------------------------------------
if [ -d /etc/nginx/sites-available ]; then
  CONF=/etc/nginx/sites-available/jamaroff
  if [ ! -f "$CONF" ]; then
    sed -e "s/__APP_PORT__/$APP_HOST_PORT/g" deploy/nginx-jamaroff.conf > "$CONF"
    ln -sf "$CONF" /etc/nginx/sites-enabled/jamaroff
    nginx -t && systemctl reload nginx && ok "Nginx configurado para $DOMAIN y $APEX"
    MYIP=$(curl -fs4 https://ifconfig.me || true)
    for d in $DOMAIN $APEX; do
      IP=$(getent ahostsv4 "$d" | awk 'NR==1{print $1}')
      [ -n "$MYIP" ] && [ "$IP" != "$MYIP" ] && info "Ojo: $d apunta a '${IP:-nada}' y este VPS es $MYIP. Corrige el DNS antes del HTTPS."
    done
    if command -v certbot >/dev/null; then
      certbot --nginx -d $DOMAIN -d $APEX --non-interactive --agree-tos --redirect -m "${CERTBOT_EMAIL:-${ADMIN_NOTIFY_EMAIL:-$ADMIN_EMAIL}}" \
        && ok "HTTPS activo" \
        || info "certbot falló: cuando el DNS de $APEX y $DOMAIN apunte a este VPS, corre:  certbot --nginx -d $DOMAIN -d $APEX"
    else
      info "No está certbot. Instálalo y activa HTTPS:  apt install certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN -d $APEX"
    fi
  else
    ok "Nginx ya tenía la tienda (no se modifica)"
  fi
else
  info "No encontré Nginx. Apunta tu proxy de $DOMAIN a 127.0.0.1:$APP_HOST_PORT"
fi

# --- 3. Respaldo diario -----------------------------------------------------
if [ -d /etc/cron.d ] && [ ! -f /etc/cron.d/jamaroff-respaldo ]; then
  echo "45 3 * * * root bash $ROOT/deploy/respaldar-vps.sh >> $ROOT/deploy/respaldos/cron.log 2>&1" > /etc/cron.d/jamaroff-respaldo
  ok "Respaldo diario programado (3:45 AM, guarda 14 días en deploy/respaldos)"
fi

echo
ok "Listo: https://$DOMAIN   ·   admin: https://$DOMAIN/admin"
echo "   Usuario admin:   ${ADMIN_EMAIL:-}"
echo "   Contraseña:      ${ADMIN_PASSWORD:-(la que ya tenías)}   (está en /opt/jamaroff/.env)"
echo "   Webpay:          ${WEBPAY_ENV:-integration} (pruebas con tarjetas de Transbank)"
echo "   Clave para Cuadra (Conexiones → Tienda web): ${CUADRA_API_KEY:-}"
