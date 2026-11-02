import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { cuadraAuth, siteUrl, upsertFromCuadra } from '@/lib/cuadra';

export const dynamic = 'force-dynamic';
// Descargar fotos puede tardar
export const maxDuration = 300;

/** GET /api/cuadra/productos · productos de la tienda (Cuadra ve cuáles ya están publicados) */
export async function GET(req: Request) {
  const denied = cuadraAuth(req);
  if (denied) return denied;
  const rows = await db
    .select({
      id: schema.products.id,
      sku: schema.products.sku,
      slug: schema.products.slug,
      name: schema.products.name,
      price: schema.products.price,
      compareAtPrice: schema.products.compareAtPrice,
      stock: schema.products.stock,
      mode: schema.products.mode,
      active: schema.products.active,
      category: schema.categories.name,
      images: sql<number>`(select count(*) from product_images pi where pi.product_id = ${schema.products.id})::int`,
      image: sql<string | null>`(select coalesce(pi.thumb_url, pi.url) from product_images pi where pi.product_id = ${schema.products.id} order by pi.position limit 1)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .orderBy(asc(schema.products.name));
  const site = siteUrl();
  return Response.json({
    products: rows.map((r) => ({ ...r, url: `${site}/producto/${r.slug}`, image: r.image ? `${site}${r.image}` : null })),
  });
}

const productSchema = z.object({
  sku: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(200),
  description: z.string().max(20000).nullish(),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().nullish(),
  category: z.string().trim().max(80).nullish(),
  stock: z.number().int().min(0).nullish(),
  mode: z.enum(['stock', 'pedido', 'ambos']).nullish(),
  color: z.string().max(80).nullish(),
  material: z.string().max(80).nullish(),
  dimensions: z.string().max(120).nullish(),
  images: z.array(z.string().url().max(1000)).max(12).optional(),
  active: z.boolean().optional(),
});

/** POST /api/cuadra/productos { products: [...] } · crea o actualiza por SKU (máx. 20 por vez) */
export async function POST(req: Request) {
  const denied = cuadraAuth(req);
  if (denied) return denied;
  const parsed = z.object({ products: z.array(productSchema).min(1).max(20) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const results = [];
  for (const p of parsed.data.products) {
    try {
      results.push({ ok: true, ...(await upsertFromCuadra(p)) });
    } catch (err) {
      results.push({ ok: false, sku: p.sku, error: (err as Error).message });
    }
  }
  return Response.json({ results });
}
