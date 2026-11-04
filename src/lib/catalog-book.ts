import 'server-only';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db, schema } from '@/db';

const { catalogs, catalogPages, products, productImages, productVariants, categories } = schema;

/** Una tela del muestrario: nombre del color, tipo (Felpa, Lino…) y foto */
export type BookSwatch = { name: string; hex: string; fabric: string | null; image: string | null };
export type BookProduct = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  description: string;
  dimensions: string | null;
  material: string | null;
  color: string | null;
  specs: { label: string; value: string }[];
  mode: 'stock' | 'pedido' | 'ambos';
  leadTimeDays: number | null;
  images: string[];
  swatches: BookSwatch[];
  /** El mismo producto en otros colores (incluye a este, en orden) */
  variants: BookVariant[];
};
export type BookVariant = Omit<BookProduct, 'variants'>;
export type BookPage = {
  id: number;
  kind: 'portada' | 'separador' | 'producto' | 'telas' | 'texto';
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  product: BookProduct | null;
  swatches: BookSwatch[];
};
export type Book = { id: number; slug: string; title: string; subtitle: string | null; published: boolean; pages: BookPage[] };

/** Las direcciones de catálogo siempre empiezan con "catalogo-" (ej. catalogo-2026) */
export const isCatalogSlug = (s: string) => /^catalogo-[a-z0-9-]{1,40}$/.test(s);

/**
 * El catálogo con sus páginas listas para mostrar: cada página de producto trae sus fotos,
 * telas y medidas desde la tienda, así el catálogo se actualiza solo si cambias el producto.
 */
export async function getBook(slug: string, opts: { includeDraft?: boolean } = {}): Promise<Book | null> {
  if (!isCatalogSlug(slug)) return null;
  const [c] = await db.select().from(catalogs).where(eq(catalogs.slug, slug)).limit(1);
  if (!c || (!c.published && !opts.includeDraft)) return null;
  const pages = await db.select().from(catalogPages).where(eq(catalogPages.catalogId, c.id)).orderBy(asc(catalogPages.position), asc(catalogPages.id));

  const pageIds = [...new Set(pages.map((p) => p.productId).filter((x): x is number => x != null))];
  // Variantes de color: los productos del mismo grupo también se cargan (aunque no tengan página)
  const groups = pageIds.length
    ? (await db.select({ g: products.variantGroup }).from(products).where(and(inArray(products.id, pageIds), isNotNull(products.variantGroup)))).map((r) => r.g!)
    : [];
  const mates = groups.length
    ? await db.select({ id: products.id }).from(products).where(and(inArray(products.variantGroup, groups), eq(products.active, true)))
    : [];
  const ids = [...new Set([...pageIds, ...mates.map((m) => m.id)])];
  const [prods, imgs, vars] = ids.length
    ? await Promise.all([
        db
          .select({ p: products, category: categories.name })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .where(and(inArray(products.id, ids), eq(products.active, true))),
        db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position), asc(productImages.id)),
        db.select().from(productVariants).where(inArray(productVariants.productId, ids)).orderBy(asc(productVariants.position), asc(productVariants.id)),
      ])
    : [[], [], []];

  const toSwatch = (v: (typeof vars)[number]): BookSwatch => ({ name: v.name, hex: v.hex, fabric: v.fabric, image: v.imageUrl });
  const base = new Map<number, BookVariant & { group: string | null }>();
  for (const { p, category } of prods) {
    base.set(p.id, {
      id: p.id,
      slug: p.slug,
      name: p.name,
      category,
      description: p.description,
      dimensions: p.dimensions,
      material: p.material,
      color: p.color,
      specs: p.specs,
      mode: p.mode,
      leadTimeDays: p.leadTimeDays,
      images: imgs.filter((i) => i.productId === p.id).map((i) => i.url),
      swatches: vars.filter((v) => v.productId === p.id).map(toSwatch),
      group: p.variantGroup,
    });
  }
  const strip = ({ group: _g, ...v }: BookVariant & { group: string | null }): BookVariant => v;
  const byId = new Map<number, BookProduct>();
  for (const b of base.values()) {
    const variants = b.group ? [...base.values()].filter((x) => x.group === b.group).sort((x, y) => x.name.localeCompare(y.name, 'es')).map(strip) : [];
    byId.set(b.id, { ...strip(b), variants: variants.length > 1 ? variants : [] });
  }

  // Muestrario: todas las telas de los productos del catálogo (sin repetir nombre)
  let fabrics: BookSwatch[] = [];
  if (pages.some((p) => p.kind === 'telas')) {
    const source = pageIds.length ? vars.filter((v) => pageIds.includes(v.productId)) : await db.select().from(productVariants).orderBy(asc(productVariants.name));
    const seen = new Map<string, BookSwatch>();
    for (const v of source) {
      const k = `${v.fabric ?? ''}|${v.name}`.toLowerCase();
      if (!seen.has(k)) seen.set(k, toSwatch(v));
    }
    fabrics = [...seen.values()];
  }

  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    published: c.published,
    pages: pages
      // Una página de producto cuyo producto se borró u ocultó no se muestra
      .filter((p) => p.kind !== 'producto' || (p.productId != null && byId.has(p.productId)))
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        subtitle: p.subtitle,
        body: p.body,
        imageUrl: p.imageUrl,
        product: p.productId != null ? (byId.get(p.productId) ?? null) : null,
        swatches: p.kind === 'telas' ? fabrics : [],
      })),
  };
}
