import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { and, asc, eq, ilike, ne, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { slugify } from '@/lib/format';
import { deleteUpload, saveImageBuffer } from '@/lib/uploads';

/**
 * Conexión con Cuadra (el ERP): Cuadra publica productos en la tienda y lee los pedidos.
 * Se protege con la clave CUADRA_API_KEY del .env, que también se anota en Cuadra
 * (Configuración → Conexiones → Tienda web). Sin esa clave, la conexión queda apagada.
 */
export function cuadraAuth(req: Request): Response | null {
  const key = process.env.CUADRA_API_KEY?.trim();
  if (!key) return Response.json({ error: 'La conexión con Cuadra no está activada: falta CUADRA_API_KEY en el .env de la tienda' }, { status: 503 });
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: 'Clave de Cuadra inválida' }, { status: 401 });
  return null;
}

export const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Producto que llega desde Cuadra. La clave es el SKU (el SKU padre/color de Cuadra). */
export type CuadraProduct = {
  sku: string;
  name: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  category?: string | null;
  stock?: number | null;
  mode?: 'stock' | 'pedido' | 'ambos' | null;
  color?: string | null;
  material?: string | null;
  dimensions?: string | null;
  images?: string[];
  active?: boolean;
};

async function uniqueSlug(base: string, exceptId?: number) {
  const root = slugify(base) || 'producto';
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const [hit] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(exceptId ? and(eq(schema.products.slug, slug), ne(schema.products.id, exceptId)) : eq(schema.products.slug, slug))
      .limit(1);
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

/** Categoría por nombre (se crea si no existe) */
async function categoryId(name: string) {
  const clean = name.trim();
  const [c] = await db.select().from(schema.categories).where(ilike(schema.categories.name, clean)).limit(1);
  if (c) return c.id;
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${schema.categories.position}), 0)::int` }).from(schema.categories);
  const [created] = await db
    .insert(schema.categories)
    .values({ name: clean, slug: slugify(clean) || `cat-${Date.now()}`, position: max + 1 })
    .onConflictDoNothing()
    .returning();
  if (created) return created.id;
  const [again] = await db.select().from(schema.categories).where(eq(schema.categories.slug, slugify(clean))).limit(1);
  return again?.id ?? null;
}

/** Descarga una foto (máx. 15 MB) y la guarda optimizada como las del admin */
async function download(url: string) {
  if (!/^https?:\/\//i.test(url)) throw new Error('dirección inválida');
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Mozilla/5.0 (Jamaroff tienda)' } });
  if (!res.ok) throw new Error(`respondió ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > 15 * 1024 * 1024) throw new Error('pesa más de 15 MB');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new Error('pesa más de 15 MB');
  return saveImageBuffer(buf);
}

/**
 * Fotos de Cuadra: van primero, en su orden. Las que ya estaban (misma dirección original) no se
 * descargan de nuevo; las que Cuadra ya no manda se borran. Las subidas a mano en el admin se
 * conservan después de las de Cuadra.
 */
async function syncImages(productId: number, alt: string, urls: string[], warnings: string[]) {
  const wanted = [...new Set(urls.filter(Boolean))].slice(0, 12);
  const current = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, productId)).orderBy(asc(schema.productImages.position));
  const fromCuadra = current.filter((i) => i.sourceUrl);
  const manual = current.filter((i) => !i.sourceUrl);

  for (const old of fromCuadra.filter((i) => !wanted.includes(i.sourceUrl!))) {
    await db.delete(schema.productImages).where(eq(schema.productImages.id, old.id));
    await deleteUpload(old.url);
    await deleteUpload(old.thumbUrl);
  }
  let pos = 0;
  for (const url of wanted) {
    const have = fromCuadra.find((i) => i.sourceUrl === url);
    if (have) {
      await db.update(schema.productImages).set({ position: pos++, alt }).where(eq(schema.productImages.id, have.id));
      continue;
    }
    try {
      const saved = await download(url);
      await db.insert(schema.productImages).values({ productId, url: saved.url, thumbUrl: saved.thumbUrl, alt, position: pos++, sourceUrl: url });
    } catch (err) {
      warnings.push(`Foto ${url.slice(0, 80)}: ${(err as Error).message}`);
    }
  }
  for (const m of manual) await db.update(schema.productImages).set({ position: pos++ }).where(eq(schema.productImages.id, m.id));
  return pos;
}

/** Crea o actualiza un producto por su SKU */
export async function upsertFromCuadra(p: CuadraProduct) {
  const warnings: string[] = [];
  const sku = p.sku.trim();
  const [existing] = await db.select().from(schema.products).where(ilike(schema.products.sku, sku)).limit(1);
  const fields = {
    name: p.name.trim(),
    price: Math.round(p.price),
    ...(p.description !== undefined ? { description: p.description ?? '' } : {}),
    ...(p.compareAtPrice !== undefined ? { compareAtPrice: p.compareAtPrice && p.compareAtPrice > p.price ? Math.round(p.compareAtPrice) : null } : {}),
    ...(p.stock !== undefined && p.stock !== null ? { stock: Math.max(0, Math.round(p.stock)) } : {}),
    ...(p.mode ? { mode: p.mode } : {}),
    ...(p.color !== undefined ? { color: p.color || null } : {}),
    ...(p.material !== undefined ? { material: p.material || null } : {}),
    ...(p.dimensions !== undefined ? { dimensions: p.dimensions || null } : {}),
    ...(p.active !== undefined ? { active: p.active } : {}),
    ...(p.category ? { categoryId: await categoryId(p.category) } : {}),
    updatedAt: new Date(),
  };
  let id: number;
  let slug: string;
  let created = false;
  if (existing) {
    await db.update(schema.products).set(fields).where(eq(schema.products.id, existing.id));
    id = existing.id;
    slug = existing.slug;
  } else {
    slug = await uniqueSlug(p.name);
    const [row] = await db
      .insert(schema.products)
      .values({ ...fields, sku, slug, description: p.description ?? '', active: p.active ?? true })
      .returning({ id: schema.products.id });
    id = row.id;
    created = true;
  }
  const images = p.images ? await syncImages(id, p.name, p.images, warnings) : undefined;
  return { sku, id, slug, url: `${siteUrl()}/producto/${slug}`, created, images, warnings };
}
