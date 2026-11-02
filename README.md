# Jamaroff Home Atelier · Tienda online

Tienda de muebles con venta en stock, a pedido y mayorista, despacho calculado por zona y volumen, pago con Webpay o transferencia, y panel de administración.

## Qué incluye

**Tienda (clientes)**
- Inicio, catálogo con filtros (disponibilidad, material, color, precio), búsqueda y orden.
- Ficha de producto con galería, modalidad *en stock / a pedido*, telas, cantidad y calculadora de despacho.
- Carrito con cupones, checkout con despacho por región y comuna (las 346 comunas), retiro en showroom, factura, Webpay o transferencia.
- Página de seguimiento del pedido, cuentas de cliente, solicitud de cuenta mayorista, formulario de cotización a medida y contacto.
- Correos automáticos: confirmación de compra, datos de transferencia, cambios de estado y aviso de despacho.

**Panel de administración (`/admin`)**
- Resumen de ventas del mes, pedidos por despachar, stock bajo.
- Pedidos: filtros por estado, cambio de estado (pagado → en fabricación → listo → despachado → entregado), transporte y n° de seguimiento, exportar a Excel.
- Productos: crear, editar, duplicar, fotos (se optimizan solas), telas, bultos para despacho, precio mayorista, importación y exportación masiva por Excel.
- Categorías, mayoristas (aprobar/rechazar), cotizaciones y mensajes, zonas y tarifas de despacho, cupones, usuarios administradores y ajustes (WhatsApp, datos de transferencia, fotos de portada).

## Tecnología

| Parte | Herramienta |
|---|---|
| Tienda, admin y API | Next.js 16 (React 19, TypeScript) |
| Base de datos | PostgreSQL 16 con Drizzle ORM |
| Pagos | Webpay Plus (SDK oficial de Transbank) + transferencia |
| Correo | SMTP (por ejemplo el correo de Hostinger) |
| Servidor | Docker Compose en tu VPS: app + PostgreSQL + Caddy (HTTPS automático) |

---

## Instalación en el VPS de Hostinger

Necesitas acceso SSH al VPS (lo ves en hPanel › VPS › Acceso SSH).

### 1. Apuntar el dominio al VPS
En hPanel › Dominios › DNS de `jamaroff.cl`, crea o edita:
- Registro **A** `@` → IP de tu VPS
- Registro **A** `www` → IP de tu VPS

Los cambios pueden tardar hasta unas horas en propagarse.

### 2. Instalar Docker (una sola vez)
Conéctate por SSH y ejecuta:
```bash
curl -fsSL https://get.docker.com | sh
```
> Si tu VPS ya tiene otro sitio usando los puertos 80/443 (por ejemplo Nginx o un panel), avísanos: hay que ajustar Caddy para que convivan.

### 3. Subir el proyecto
Sube la carpeta del proyecto a `/opt/jamaroff` (por SFTP con FileZilla, o con `git clone` si lo dejas en GitHub).

### 4. Configurar
```bash
cd /opt/jamaroff
cp .env.example .env
nano .env
```
Completa como mínimo: `DOMAIN`, `SITE_URL`, `POSTGRES_PASSWORD`, `AUTH_SECRET` (genérala con `openssl rand -hex 32`) y los datos SMTP.

### 5. Arrancar
```bash
docker compose up -d --build
```
La primera vez tarda unos minutos. Caddy obtiene el certificado HTTPS automáticamente.

### 6. Datos iniciales y tu usuario administrador
```bash
# (opcional) carga los 5 sofás de ejemplo, categorías, zonas de despacho y el cupón BIENVENIDA10
docker compose exec app npx tsx scripts/seed.ts

# crea tu usuario administrador
docker compose exec app npx tsx scripts/create-admin.ts tu@correo.cl "Tu Nombre" "una-clave-larga-y-segura"
```
Entra a `https://jamaroff.cl/admin`.

### 7. Respaldos automáticos (recomendado)
```bash
crontab -e
# agrega esta línea (respaldo diario 4:30 am, guarda 14 días):
30 4 * * * cd /opt/jamaroff && sh scripts/backup.sh >> backups/backup.log 2>&1
```
Copia de vez en cuando la carpeta `backups/` fuera del VPS.

### Actualizar la tienda después de cambios en el código
```bash
cd /opt/jamaroff
docker compose up -d --build app
```
Las migraciones de base de datos se aplican solas al arrancar.

---

## Conexión con Cuadra (ERP)

La tienda se conecta con Cuadra en los dos sentidos:
- **Productos Cuadra → tienda**: en Cuadra, *Productos → Tienda web*, eliges productos (los de Paris, Falabella, etc., agrupados por SKU padre/color), les pones precio, categoría y stock, y se publican aquí con sus fotos y descripción. Si los publicas de nuevo, se actualizan.
- **Pedidos tienda → Cuadra**: los pedidos pagados llegan a *Ventas* de Cuadra como el canal "Tienda web" cuando tocas *Actualizar ventas* (boleta, maestra de despachos, cobros).

Para activarla:
1. En el `.env` de la tienda agrega una clave larga: `CUADRA_API_KEY=` (genérala con `openssl rand -hex 24`) y reinicia: `docker compose up -d app`.
2. En Cuadra: *Configuración → Conexiones → Tienda web → Conectar por API*, con la dirección de la tienda (ej. `https://jamaroff.cl`) y la misma clave.

Sin `CUADRA_API_KEY` la conexión queda apagada. Probando en tu computador, `docker-compose.local.yml` ya trae la clave `cuadra-local-123` (dirección `http://localhost:3080`).

## Antes de vender: lista de verificación

1. **Ajustes** (`/admin/ajustes`): WhatsApp, correo, dirección del showroom, datos de transferencia y fotos de portada.
2. **Productos**: reemplaza precios, descripciones, medidas y bultos de ejemplo (o importa tu catálogo con la plantilla Excel).
3. **Despachos** (`/admin/despachos`): las tarifas cargadas son **de ejemplo**. Reemplázalas por las que negocies con tu transportista. Fórmula: tarifa base + ($ por m³ × volumen embalado), con un mínimo.
4. **Textos legales** (`src/app/(tienda)/ayuda/[slug]/page.tsx`): completa lo que está entre [corchetes] en despachos, cambios y devoluciones y términos.
5. **Webpay**:
   - Mientras `WEBPAY_ENV=integration`, la tienda usa el ambiente de pruebas de Transbank: no hay cobros reales. Usa las tarjetas de prueba publicadas en la documentación de Transbank Developers.
   - Para cobrar de verdad: contrata Webpay Plus con Transbank, completa su proceso de validación, y cuando te entreguen el **código de comercio** y la **API key**, ponlos en `.env` con `WEBPAY_ENV=production` y reinicia: `docker compose up -d app`.
6. **Correo**: haz una compra de prueba y revisa que lleguen los correos al cliente y a `ADMIN_NOTIFY_EMAIL`.

## Probar en tu computador (recomendado antes de subir al VPS)
1. Instala **Docker Desktop** (Windows o Mac) desde docker.com y ábrelo.
2. Descomprime el proyecto, abre una terminal en la carpeta `jamaroff` y ejecuta:
   ```bash
   docker compose -f docker-compose.local.yml up --build
   ```
   La primera vez tarda unos minutos. Cuando veas `Ready`, abre:
   - Tienda: http://localhost:3080
   - Admin: http://localhost:3080/admin · usuario `admin@jamaroff.cl` · contraseña `admin-local-123`
3. Para detenerla: `Ctrl + C`. Para empezar de cero (borra los datos de prueba): `docker compose -f docker-compose.local.yml down -v`.

Webpay funciona en modo de pruebas: al pagar te lleva al sitio de pruebas de Transbank.

## Desarrollo local sin Docker (para programadores)
```bash
npm install
cp .env.example .env   # usa DATABASE_URL=postgres://jamaroff:jamaroff@localhost:5432/jamaroff
npm run db:migrate && npm run db:seed
npm run admin:create -- tu@correo.cl "Tu Nombre" "clave-segura-123"
npm run dev
```
Si cambias `src/db/schema.ts`, genera la migración con `npm run db:generate`.

## Estructura
```
src/app/(tienda)/   páginas de la tienda
src/app/admin/      panel de administración y sus acciones
src/app/api/        carrito, despacho, checkout y retorno de Webpay
src/lib/            precios, despacho, pedidos, correos, Webpay, sesiones
src/db/schema.ts    tablas de la base de datos
drizzle/            migraciones SQL
scripts/            migrar, datos de ejemplo, crear admin, respaldo
```
