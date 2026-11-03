'use server';

import { redirect } from 'next/navigation';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { deleteUpload, saveProductImage } from '@/lib/uploads';
import { isCatalogSlug } from '@/lib/catalog-book';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const int = (fd: FormData, k: string) => {
  const n = Number.parseInt(str(fd, k), 10);
  return Number.isFinite(n) ? n : null;
};
const KINDS = ['portada', 'separador', 'producto', 'telas', 'texto'] as const;
type Kind = (typeof KINDS)[number];

function go(path: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(params).toString();
  const [base, hash] = path.split('#');
  redirect((qs ? `${base}?${qs}` : base) + (hash ? `#${hash}` : ''));
}

/** "Catálogo 2026" / "2026" / "catalogo-2026" -> "catalogo-2026" */
function toSlug(v: string) {
  const s = v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.startsWith('catalogo-') ? s : `catalogo-${s.replace(/^catalogo-?/, '')}`;
}

/** Foto subida (opcional): devuelve su URL o null */
async function upload(fd: FormData, key: string) {
  const f = fd.get(key);
  if (!(f instanceof File) || !f.size) return null;
  return (await saveProductImage(f)).url;
}

export async function createCatalogAction(fd: FormData) {
  await requireAdmin();
  const title = str(fd, 'title') || 'Catálogo';
  const slug = toSlug(str(fd, 'slug') || title);
  if (!isCatalogSlug(slug)) go('/admin/catalogos', { error: 'Dirección no válida. Usa algo como catalogo-2026' });
  const [exists] = await db.select({ id: schema.catalogs.id }).from(schema.catalogs).where(eq(schema.catalogs.slug, slug)).limit(1);
  if (exists) go('/admin/catalogos', { error: `Ya existe un catálogo en /${slug}` });
  const [c] = await db.insert(schema.catalogs).values({ slug, title, subtitle: str(fd, 'subtitle') || null }).returning();
  // Parte con una portada lista para completar
  await db.insert(schema.catalogPages).values({ catalogId: c.id, position: 0, kind: 'portada', title, subtitle: str(fd, 'subtitle') || 'Colección' });
  go(`/admin/catalogos/${c.id}`, { ok: 'Catálogo creado. Agrega sus páginas.' });
}

export async function saveCatalogAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const slug = toSlug(str(fd, 'slug'));
  if (!isCatalogSlug(slug)) go(`/admin/catalogos/${id}`, { error: 'Dirección no válida. Usa algo como catalogo-2026' });
  const [other] = await db.select({ id: schema.catalogs.id }).from(schema.catalogs).where(eq(schema.catalogs.slug, slug)).limit(1);
  if (other && other.id !== id) go(`/admin/catalogos/${id}`, { error: `Ya existe otro catálogo en /${slug}` });
  await db
    .update(schema.catalogs)
    .set({ slug, title: str(fd, 'title') || 'Catálogo', subtitle: str(fd, 'subtitle') || null, published: fd.get('published') === 'on', updatedAt: new Date() })
    .where(eq(schema.catalogs.id, id));
  go(`/admin/catalogos/${id}`, { ok: 'Catálogo guardado' });
}

export async function deleteCatalogAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const pages = await db.select({ imageUrl: schema.catalogPages.imageUrl }).from(schema.catalogPages).where(eq(schema.catalogPages.catalogId, id));
  await db.delete(schema.catalogs).where(eq(schema.catalogs.id, id));
  for (const p of pages) await deleteUpload(p.imageUrl);
  go('/admin/catalogos', { ok: 'Catálogo eliminado' });
}

export async function addPageAction(fd: FormData) {
  await requireAdmin();
  const catalogId = int(fd, 'catalogId')!;
  const kind = str(fd, 'kind') as Kind;
  if (!KINDS.includes(kind)) go(`/admin/catalogos/${catalogId}`, { error: 'Elige el tipo de página' });
  const productIds = fd.getAll('productId').map((v) => Number(v)).filter((n) => n > 0);
  if (kind === 'producto' && !productIds.length) go(`/admin/catalogos/${catalogId}`, { error: 'Elige al menos un producto' });
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.catalogPages.position}), -1)::int` })
    .from(schema.catalogPages)
    .where(eq(schema.catalogPages.catalogId, catalogId));
  let imageUrl: string | null = null;
  try {
    imageUrl = await upload(fd, 'image');
  } catch (e) {
    go(`/admin/catalogos/${catalogId}`, { error: (e as Error).message });
  }
  // Las páginas de producto parten con los datos del producto (se personalizan después, página por página)
  const own = kind !== 'producto';
  const base = { catalogId, kind, title: own ? str(fd, 'title') || null : null, subtitle: own ? str(fd, 'subtitle') || null : null, body: own ? str(fd, 'body') || null : null, imageUrl: own ? imageUrl : null };
  // Varios productos a la vez: una página por producto, en el orden elegido
  const rows = kind === 'producto' ? productIds.map((productId, n) => ({ ...base, productId, position: max + 1 + n })) : [{ ...base, position: max + 1 }];
  await db.insert(schema.catalogPages).values(rows);
  await db.update(schema.catalogs).set({ updatedAt: new Date() }).where(eq(schema.catalogs.id, catalogId));
  go(`/admin/catalogos/${catalogId}#paginas`, { ok: rows.length === 1 ? 'Página agregada' : `${rows.length} páginas agregadas` });
}

export async function savePageAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'pageId')!;
  const [page] = await db.select().from(schema.catalogPages).where(eq(schema.catalogPages.id, id)).limit(1);
  if (!page) go('/admin/catalogos');
  const back = `/admin/catalogos/${page!.catalogId}#p${id}`;
  let imageUrl = page!.imageUrl;
  try {
    const up = await upload(fd, 'image');
    if (up) imageUrl = up;
  } catch (e) {
    go(back, { error: (e as Error).message });
  }
  if (fd.get('removeImage') === 'on' && !fd.get('image')) imageUrl = null;
  if (imageUrl !== page!.imageUrl) await deleteUpload(page!.imageUrl);
  await db
    .update(schema.catalogPages)
    .set({
      title: str(fd, 'title') || null,
      subtitle: str(fd, 'subtitle') || null,
      body: str(fd, 'body') || null,
      imageUrl,
      productId: page!.kind === 'producto' ? int(fd, 'productId') ?? page!.productId : null,
    })
    .where(eq(schema.catalogPages.id, id));
  go(back, { ok: 'Página guardada' });
}

/** Subir, bajar o borrar una página */
export async function pageOpAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'pageId')!;
  const op = str(fd, 'op');
  const [page] = await db.select().from(schema.catalogPages).where(eq(schema.catalogPages.id, id)).limit(1);
  if (!page) go('/admin/catalogos');
  const back = `/admin/catalogos/${page!.catalogId}#paginas`;
  if (op === 'delete') {
    await db.delete(schema.catalogPages).where(eq(schema.catalogPages.id, id));
    await deleteUpload(page!.imageUrl);
    go(back, { ok: 'Página eliminada' });
  }
  const all = await db.select().from(schema.catalogPages).where(eq(schema.catalogPages.catalogId, page!.catalogId)).orderBy(asc(schema.catalogPages.position), asc(schema.catalogPages.id));
  const idx = all.findIndex((p) => p.id === id);
  const to = op === 'up' ? idx - 1 : op === 'down' ? idx + 1 : idx;
  if (to >= 0 && to < all.length && to !== idx) {
    const order = [...all];
    order.splice(idx, 1);
    order.splice(to, 0, page!);
    for (const [n, p] of order.entries()) if (p.position !== n) await db.update(schema.catalogPages).set({ position: n }).where(eq(schema.catalogPages.id, p.id));
  }
  go(`/admin/catalogos/${page!.catalogId}#p${id}`);
}
