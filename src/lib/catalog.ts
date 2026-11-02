import 'server-only';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';

const { products, productImages, productVariants, categories, productLightImages } = schema;

export async function getMenuCategories() {
  return db.select().from(categories).where(eq(categories.showInMenu, true)).orderBy(asc(categories.position), asc(categories.name));
}

export type ProductCardData = {
  id: number;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  wholesalePrice: number | null;
  wholesaleMinQty: number;
  mode: 'stock' | 'pedido' | 'ambos';
  stock: number;
  material: string | null;
  color: string | null;
  image: string | null;
  categoryName: string | null;
};

const cardFields = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  wholesalePrice: products.wholesalePrice,
  wholesaleMinQty: products.wholesaleMinQty,
  mode: products.mode,
  stock: products.stock,
  material: products.material,
  color: products.color,
  categoryName: categories.name,
  image: sql<string | null>`(select coalesce(pi.thumb_url, pi.url) from product_images pi where pi.product_id = "products"."id" order by pi.position limit 1)`,
};

export type CatalogFilters = {
  categoria?: string;
  disp?: 'stock' | 'pedido';
  material?: string[];
  color?: string[];
  min?: number;
  max?: number;
  q?: string;
  orden?: 'destacados' | 'precio-asc' | 'precio-desc' | 'nuevos';
  page?: number;
};

export const PAGE_SIZE = 24;

export async function listProducts(f: CatalogFilters) {
  const where: SQL[] = [eq(products.active, true)];
  if (f.categoria) where.push(eq(categories.slug, f.categoria));
  if (f.disp === 'stock') where.push(and(inArray(products.mode, ['stock', 'ambos']), sql`${products.stock} > 0`)!);
  if (f.disp === 'pedido') where.push(inArray(products.mode, ['pedido', 'ambos']));
  if (f.material?.length) where.push(inArray(products.material, f.material));
  if (f.color?.length) where.push(inArray(products.color, f.color));
  if (f.min) where.push(gte(products.price, f.min));
  if (f.max) where.push(lte(products.price, f.max));
  if (f.q) {
    const term = `%${f.q.replace(/[%_]/g, '')}%`;
    where.push(or(ilike(products.name, term), ilike(products.description, term), ilike(products.sku, term), ilike(categories.name, term))!);
  }
  const order =
    f.orden === 'precio-asc' ? [asc(products.price)]
    : f.orden === 'precio-desc' ? [desc(products.price)]
    : f.orden === 'nuevos' ? [desc(products.createdAt)]
    : [desc(products.featured), desc(products.createdAt)];

  const page = Math.max(1, f.page ?? 1);
  const cond = and(...where);
  const [rows, [{ total }]] = await Promise.all([
    db.select(cardFields).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(cond).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(cond),
  ]);
  return { rows: rows as ProductCardData[], total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getFacets(categorySlug?: string) {
  const cond = categorySlug
    ? and(eq(products.active, true), eq(categories.slug, categorySlug))
    : eq(products.active, true);
  const rows = await db
    .selectDistinct({ material: products.material, color: products.color })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(cond);
  const materials = [...new Set(rows.map((r) => r.material).filter(Boolean) as string[])].sort();
  const colors = [...new Set(rows.map((r) => r.color).filter(Boolean) as string[])].sort();
  return { materials, colors };
}

export async function getFeatured(limit = 8) {
  const rows = await db
    .select(cardFields)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.active, true))
    .orderBy(desc(products.featured), desc(products.createdAt))
    .limit(limit);
  return rows as ProductCardData[];
}

/** Categorías con al menos un producto, con la foto del primero para la portada */
export async function getCategoryTiles(limit = 4) {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      count: sql<number>`(select count(*)::int from products p where p.category_id = "categories"."id" and p.active)`,
      fallback: sql<string | null>`(select coalesce(pi.thumb_url, pi.url) from product_images pi join products p on p.id = pi.product_id where p.category_id = "categories"."id" and p.active order by p.featured desc, pi.position limit 1)`,
    })
    .from(categories)
    .orderBy(asc(categories.position));
  return rows.filter((r) => r.count > 0).slice(0, limit);
}

export async function getProductBySlug(slug: string) {
  const [p] = await db
    .select({ product: products, category: categories })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);
  if (!p) return null;
  const [images, variants, light] = await Promise.all([
    db.select().from(productImages).where(eq(productImages.productId, p.product.id)).orderBy(asc(productImages.position)),
    db.select().from(productVariants).where(eq(productVariants.productId, p.product.id)).orderBy(asc(productVariants.position)),
    db.select({ hour: productLightImages.hour, url: productLightImages.url }).from(productLightImages).where(eq(productLightImages.productId, p.product.id)),
  ]);
  return { ...p, images, variants, light };
}

export async function getRelated(productId: number, categoryId: number | null, limit = 4) {
  const rows = await db
    .select(cardFields)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.active, true), sql`${products.id} <> ${productId}`, categoryId ? eq(products.categoryId, categoryId) : undefined))
    .orderBy(desc(products.featured))
    .limit(limit);
  return rows as ProductCardData[];
}
