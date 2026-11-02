# Jamaroff en el VPS (mismo VPS de Cuadra) — www.jamaroff.cl

La tienda corre en Docker (tienda + base de datos) y el **Nginx que ya usa Cuadra** la publica con HTTPS.
No usa Caddy (el `docker-compose.yml` de la raíz es para un VPS propio de la tienda, no para este).

## 1. Subir el código a GitHub (una vez, en tu PC)
1. En github.com crea un repositorio **privado** vacío llamado `jamaroff-tienda` (sin README).
2. En PowerShell, dentro de la carpeta `jamaroff`:
```powershell
git init
git add -A
git commit -m "Tienda Jamaroff"
git branch -M main
git remote add origin https://github.com/FelipeJS1295/jamaroff-tienda.git
git push -u origin main
```
El `.gitignore` deja fuera `node_modules`, `.next`, `uploads` y `.env` (las claves nunca se suben).

## 2. Apuntar el dominio al VPS
En el DNS de `jamaroff.cl` (hPanel › Dominios › DNS):
- Registro **A** `@`   → IP del VPS
- Registro **A** `www` → IP del VPS

Borra otros registros A o AAAA de `@` y `www` que apunten a otro lado (por ejemplo, al hosting de Hostinger).
El cambio puede tardar desde minutos hasta unas horas.

## 3. Instalar (en el VPS)
```bash
sudo git clone https://github.com/FelipeJS1295/jamaroff-tienda.git /opt/jamaroff
cd /opt/jamaroff && sudo bash deploy/instalar-en-vps.sh
```
Como el repo es privado, git te pide usuario y contraseña. La contraseña es un **token** de GitHub
(Settings › Developer settings › Personal access tokens), igual que con Cuadra.

El instalador:
- crea `/opt/jamaroff/.env` con claves nuevas (base de datos, sesiones, clave para Cuadra);
- deja Webpay en **modo de pruebas**;
- levanta la tienda en el puerto interno 3390 (si está ocupado, te avisa: cámbialo en `.env`);
- crea el administrador;
- configura Nginx y el HTTPS para `www.jamaroff.cl` y `jamaroff.cl` (que redirige a www);
- programa un respaldo diario de la base y las fotos.

Al final muestra la contraseña del admin y la clave para conectar Cuadra.
Si el DNS aún no apunta al VPS, el HTTPS falla, pero lo demás queda listo.
Cuando el DNS ya apunte, corre `sudo certbot --nginx -d www.jamaroff.cl -d jamaroff.cl`.

## 4. Productos
- **Desde Cuadra** (recomendado): Configuración › Conexiones › Tienda web.
  Pon la dirección `https://www.jamaroff.cl` y la clave que mostró el instalador (`CUADRA_API_KEY` en `.env`).
  Luego publica desde Productos › Tienda web.
- **Productos de ejemplo**, solo para probar: `cd /opt/jamaroff && sudo SEED=1 bash deploy/instalar-en-vps.sh`.

## 5. Probar Webpay (Transbank, ambiente de integración)
Haz una compra en la tienda y elige Webpay. En la página de Transbank usa sus datos de prueba:
- Tarjeta de crédito VISA `4051 8856 0044 6623`, CVV `123`, cualquier fecha futura → **aprobada**.
- Tarjeta Mastercard `5186 0595 5959 0568`, CVV `123` → **rechazada**.
- Débito (Redcompra): `4051 8842 3993 7763` → **aprobada** · `5186 0085 4123 3829` → **rechazada**.
- Cuando pida RUT y clave: RUT `11.111.111-1`, clave `123`.

Los datos vigentes están en la página de Transbank: https://www.transbankdevelopers.cl/documentacion/como_empezar#tarjetas-de-prueba

Revisa tres casos: un pago aprobado, uno rechazado y uno que anules en Webpay ("Anular compra y volver").
Cada uno debe volver a la página de tu pedido con el mensaje que corresponde.

### Pasar a cobros reales
Cuando Transbank te entregue el código de comercio y la API key de producción, edita `/opt/jamaroff/.env`:
```
WEBPAY_ENV=production
WEBPAY_COMMERCE_CODE=597xxxxxxxxx
WEBPAY_API_KEY=xxxxxxxx
```
Y reinicia con el comando de "Actualizar".

## Actualizar (cada vez que cambies algo)
En tu PC:
```powershell
git add -A
git commit -m "cambios"
git push
```
En el VPS:
```bash
cd /opt/jamaroff && sudo git pull && sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```
La base de datos y las fotos no se tocan. Las migraciones nuevas se aplican solas al partir.

## Comandos útiles (en /opt/jamaroff)
```bash
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env ps            # estado
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env logs -f app   # registros de la tienda
sudo bash deploy/respaldar-vps.sh                                                   # respaldo manual
```
