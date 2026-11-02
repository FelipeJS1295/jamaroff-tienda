// Carga datos iniciales: categorías, los 5 sofás de ejemplo con sus fotos,
// zonas de despacho de ejemplo y un cupón. Solo se ejecuta si la tienda está vacía.
// Uso: npm run db:seed
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgres://jamaroff:jamaroff@localhost:5432/jamaroff';
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
const sql = postgres(url, { max: 1 });

async function saveImage(file: string) {
  const buf = await readFile(path.join(process.cwd(), 'seed-assets', file));
  const dir = path.join(UPLOAD_DIR, 'products');
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const img = sharp(buf).rotate();
  await writeFile(path.join(dir, `${id}.webp`), await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
  await writeFile(path.join(dir, `${id}-t.webp`), await img.clone().resize({ width: 600, height: 750, fit: 'cover' }).webp({ quality: 78 }).toBuffer());
  return { url: `/uploads/products/${id}.webp`, thumbUrl: `/uploads/products/${id}-t.webp` };
}

const FABRICS = [
  { name: 'Beige arena', hex: '#D9C4A8', priceDelta: 0, madeToOrderOnly: false },
  { name: 'Gris perla', hex: '#A8A29A', priceDelta: 0, madeToOrderOnly: false },
  { name: 'Grafito', hex: '#2D2B28', priceDelta: 0, madeToOrderOnly: true },
  { name: 'Coñac', hex: '#9A5428', priceDelta: 0, madeToOrderOnly: true },
  { name: 'Verde salvia', hex: '#6E9A74', priceDelta: 0, madeToOrderOnly: true },
];

async function main() {
  const [{ n }] = await sql`select count(*)::int as n from products`;
  if (n > 0) {
    console.log('La tienda ya tiene productos; no se cargan datos de ejemplo.');
    await sql.end();
    return;
  }

  const cats = [
    { name: 'Seccionales', slug: 'seccionales', description: 'Seccionales y sofás con chaise para livings amplios.', position: 1 },
    { name: 'Modulares', slug: 'modulares', description: 'Módulos que se adaptan a tu espacio.', position: 2 },
    { name: 'Cuero', slug: 'cuero', description: 'Sofás de cuero con terminaciones a mano.', position: 3 },
    { name: 'Poltronas', slug: 'poltronas', description: 'Poltronas y sillones individuales.', position: 4 },
    { name: 'DecoHogar', slug: 'decohogar', description: 'Decoración y complementos para el hogar.', position: 5 },
  ];
  const catIds: Record<string, number> = {};
  for (const c of cats) {
    const [row] = await sql`insert into categories (name, slug, description, position) values (${c.name}, ${c.slug}, ${c.description}, ${c.position})
      on conflict (slug) do update set name = excluded.name returning id`;
    catIds[c.slug] = row.id;
  }

  // Precios, medidas y bultos son DE EJEMPLO: edítalos desde Admin › Productos.
  const products = [
    {
      slug: 'seccional-beige-con-chaise', sku: 'JAM-SEC-001', name: 'Seccional beige con chaise', cat: 'seccionales',
      price: 899990, compareAt: null, wholesale: 690000, wholesaleMin: 3, mode: 'ambos', stock: 4, lead: 25,
      material: 'Tela', color: 'Beige', dims: '260 × 165 × 85 cm', featured: true, img: 'sofa-beige.jpg',
      packages: [{ largo: 200, ancho: 100, alto: 90, peso: 55 }, { largo: 170, ancho: 100, alto: 90, peso: 45 }],
    },
    {
      slug: 'sofa-modular-gris', sku: 'JAM-MOD-001', name: 'Sofá modular gris', cat: 'modulares',
      price: 1049990, compareAt: 1199990, wholesale: 820000, wholesaleMin: 3, mode: 'ambos', stock: 3, lead: 30,
      material: 'Tela', color: 'Gris', dims: '290 × 160 × 75 cm', featured: true, img: 'sofa-gris.jpg',
      packages: [{ largo: 145, ancho: 105, alto: 80, peso: 40 }, { largo: 145, ancho: 160, alto: 80, peso: 55 }],
    },
    {
      slug: 'seccional-negro-con-chaise', sku: 'JAM-SEC-002', name: 'Seccional negro con chaise', cat: 'seccionales',
      price: 749990, compareAt: null, wholesale: 580000, wholesaleMin: 3, mode: 'stock', stock: 6, lead: null,
      material: 'Lino', color: 'Negro', dims: '220 × 150 × 85 cm', featured: true, img: 'sofa-negro.jpg',
      packages: [{ largo: 160, ancho: 95, alto: 85, peso: 45 }, { largo: 95, ancho: 150, alto: 60, peso: 25 }],
    },
    {
      slug: 'esquinero-de-cuero-conac', sku: 'JAM-CUE-001', name: 'Esquinero de cuero coñac', cat: 'cuero',
      price: 1890000, compareAt: null, wholesale: 1490000, wholesaleMin: 2, mode: 'pedido', stock: 0, lead: 35,
      material: 'Cuero', color: 'Coñac', dims: '280 × 280 × 90 cm', featured: true, img: 'sofa-cuero.jpg',
      packages: [{ largo: 200, ancho: 100, alto: 90, peso: 60 }, { largo: 200, ancho: 100, alto: 90, peso: 60 }, { largo: 90, ancho: 90, alto: 90, peso: 25 }],
    },
    {
      slug: 'seccional-cobre-con-chaise', sku: 'JAM-SEC-003', name: 'Seccional cobre con chaise', cat: 'seccionales',
      price: 949990, compareAt: null, wholesale: 730000, wholesaleMin: 3, mode: 'pedido', stock: 0, lead: 25,
      material: 'Tela', color: 'Café', dims: '250 × 160 × 88 cm', featured: false, img: 'sofa-cobre.jpg',
      packages: [{ largo: 180, ancho: 100, alto: 90, peso: 50 }, { largo: 100, ancho: 160, alto: 70, peso: 30 }],
    },
  ];

  for (const p of products) {
    const description =
      '[Escribe aquí la descripción del producto: estructura, relleno, comodidad y cuidados. Puedes editarla desde Admin › Productos.]';
    const specs = [
      { label: 'Estructura', value: '[Material de la estructura]' },
      { label: 'Relleno', value: '[Tipo de espuma / densidad]' },
      { label: 'Patas', value: '[Material de las patas]' },
    ];
    const [row] = await sql`
      insert into products (slug, sku, name, description, category_id, price, compare_at_price, wholesale_price, wholesale_min_qty,
        mode, stock, lead_time_days, material, color, dimensions, specs, packages, featured, active)
      values (${p.slug}, ${p.sku}, ${p.name}, ${description}, ${catIds[p.cat]}, ${p.price}, ${p.compareAt}, ${p.wholesale}, ${p.wholesaleMin},
        ${p.mode}, ${p.stock}, ${p.lead}, ${p.material}, ${p.color}, ${p.dims}, ${sql.json(specs)}, ${sql.json(p.packages)}, ${p.featured}, true)
      returning id`;
    const saved = await saveImage(p.img);
    await sql`insert into product_images (product_id, url, thumb_url, alt, position) values (${row.id}, ${saved.url}, ${saved.thumbUrl}, ${p.name}, 0)`;
    const fabrics = p.mode === 'stock' ? FABRICS.slice(0, 1) : FABRICS;
    let pos = 0;
    for (const f of fabrics) {
      await sql`insert into product_variants (product_id, name, hex, price_delta, made_to_order_only, position)
        values (${row.id}, ${f.name}, ${f.hex}, ${f.priceDelta}, ${f.madeToOrderOnly}, ${pos++})`;
    }
  }

  // Zonas de despacho DE EJEMPLO: reemplaza las tarifas por las que negocies con tu transportista.
  const zones = [
    { name: 'Santiago oriente y centro', regions: [], comunas: ['Santiago', 'Providencia', 'Ñuñoa', 'Las Condes', 'Vitacura', 'La Reina', 'Lo Barnechea', 'Macul', 'Peñalolén', 'San Miguel', 'Estación Central', 'Independencia', 'Recoleta'], base: 15000, m3: 0, min: 15000, eta: '2 a 4 días hábiles', carrier: 'Flete propio', quote: false },
    { name: 'Región Metropolitana', regions: ['Metropolitana'], comunas: [], base: 25000, m3: 0, min: 25000, eta: '3 a 5 días hábiles', carrier: 'Flete propio', quote: false },
    { name: 'Zona central', regions: ['Valparaíso', "O'Higgins", 'Maule', 'Ñuble', 'Biobío'], comunas: [], base: 20000, m3: 25000, min: 39990, eta: '4 a 8 días hábiles', carrier: '[Empresa de carga]', quote: false },
    { name: 'Zona sur', regions: ['La Araucanía', 'Los Ríos', 'Los Lagos'], comunas: [], base: 25000, m3: 30000, min: 49990, eta: '5 a 10 días hábiles', carrier: '[Empresa de carga]', quote: false },
    { name: 'Zona norte', regions: ['Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo'], comunas: [], base: 30000, m3: 35000, min: 59990, eta: '6 a 12 días hábiles', carrier: '[Empresa de carga]', quote: false },
    { name: 'Zonas extremas', regions: ['Aysén', 'Magallanes'], comunas: [], base: 0, m3: 0, min: 0, eta: 'Te contactamos con el costo y plazo', carrier: null, quote: true },
  ];
  let zpos = 0;
  for (const z of zones) {
    await sql`insert into shipping_zones (name, regions, comunas, base_rate, rate_per_m3, min_rate, eta_text, carrier, quote_only, position)
      values (${z.name}, ${z.regions}, ${z.comunas}, ${z.base}, ${z.m3}, ${z.min}, ${z.eta}, ${z.carrier}, ${z.quote}, ${zpos++})`;
  }

  await sql`insert into coupons (code, type, value, min_subtotal) values ('BIENVENIDA10', 'percent', 10, 0) on conflict do nothing`;

  console.log('✓ Datos de ejemplo cargados (5 categorías, 5 productos, 6 zonas de despacho, 1 cupón)');
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
