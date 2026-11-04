'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { deleteUpload, saveSwatchImage } from '@/lib/uploads';

const { products, productVariants } = schema;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const int = (fd: FormData, k: string) => {
  const n = Number.parseInt(str(fd, k), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const file = (fd: FormData, k: string) => {
  const f = fd.get(k);
  return f instanceof File && f.size ? f : null;
};

function go(path: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(params).toString();
  const [base, hash] = path.split('#');
  redirect((qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base) + (hash ? `#${hash}` : ''));
}

/** El catálogo digital y la tienda leen telas y variantes: que se vean los cambios al tiro */
function refresh() {
  revalidatePath('/', 'layout');
}

/* ─── Muestrario de telas ──────────────────────────────────────────── */

export async function addSwatchAction(fd: FormData) {
  await requireAdmin();
  const productId = int(fd, 'productId');
  if (!productId) go('/admin/muestrario', { error: 'Elige un producto' });
  const back = `/admin/muestrario?producto=${productId}`;
  const name = str(fd, 'name');
  const photo = file(fd, 'image');
  if (!name) go(back, { error: 'Escribe el nombre del color' });
  if (!photo) go(back, { error: 'Sube la foto de la tela' });
  let saved: { url: string; hex: string };
  try {
    saved = await saveSwatchImage(photo!);
  } catch (e) {
    go(back, { error: (e as Error).message });
  }
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${productVariants.position}), -1)::int` })
    .from(productVariants)
    .where(eq(productVariants.productId, productId!));
  await db.insert(productVariants).values({ productId: productId!, name, fabric: str(fd, 'fabric') || null, imageUrl: saved!.url, hex: saved!.hex, position: max + 1 });
  refresh();
  go(`${back}#telas`, { ok: `Tela agregada: ${str(fd, 'fabric') ? `${str(fd, 'fabric')} · ` : ''}${name}` });
}

export async function saveSwatchAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'swatchId');
  const [v] = id ? await db.select().from(productVariants).where(eq(productVariants.id, id)).limit(1) : [];
  if (!v) go('/admin/muestrario', { error: 'La tela ya no existe' });
  const back = `/admin/muestrario?producto=${v!.productId}`;
  const name = str(fd, 'name');
  if (!name) go(back, { error: 'El nombre del color no puede quedar vacío' });
  let imageUrl = v!.imageUrl;
  let hex = v!.hex;
  const photo = file(fd, 'image');
  if (photo) {
    try {
      const saved = await saveSwatchImage(photo);
      await deleteUpload(v!.imageUrl);
      imageUrl = saved.url;
      hex = saved.hex;
    } catch (e) {
      go(back, { error: (e as Error).message });
    }
  }
  await db.update(productVariants).set({ name, fabric: str(fd, 'fabric') || null, imageUrl, hex }).where(eq(productVariants.id, v!.id));
  refresh();
  go(`${back}#s${v!.id}`, { ok: 'Tela guardada' });
}

/** Borrar, o mover a la izquierda / derecha */
export async function swatchOpAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'swatchId');
  const op = str(fd, 'op');
  const [v] = id ? await db.select().from(productVariants).where(eq(productVariants.id, id)).limit(1) : [];
  if (!v) go('/admin/muestrario');
  const back = `/admin/muestrario?producto=${v!.productId}`;
  if (op === 'delete') {
    // Los pedidos antiguos guardan el nombre de la tela, así que se puede borrar sin perder el historial
    await db.delete(productVariants).where(eq(productVariants.id, v!.id));
    await deleteUpload(v!.imageUrl);
    refresh();
    go(`${back}#telas`, { ok: 'Tela eliminada' });
  }
  const all = await db.select().from(productVariants).where(eq(productVariants.productId, v!.productId)).orderBy(productVariants.position, productVariants.id);
  const from = all.findIndex((x) => x.id === v!.id);
  const to = op === 'left' ? from - 1 : op === 'right' ? from + 1 : from;
  if (to >= 0 && to < all.length && to !== from) {
    const [moved] = all.splice(from, 1);
    all.splice(to, 0, moved);
    for (const [n, x] of all.entries()) if (x.position !== n) await db.update(productVariants).set({ position: n }).where(eq(productVariants.id, x.id));
    refresh();
  }
  go(`${back}#s${v!.id}`);
}

/* ─── Variantes de color (el mismo producto en otro color) ─────────── */

export async function linkVariantAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'productId');
  const otherId = int(fd, 'otherId');
  const back = `/admin/productos/${id}#variantes`;
  if (!id) go('/admin/productos');
  if (!otherId || otherId === id) go(back, { error: 'Elige el producto que es la variante' });
  const both = await db.select({ id: products.id, group: products.variantGroup }).from(products).where(inArray(products.id, [id!, otherId!]));
  if (both.length < 2) go(back, { error: 'Ese producto ya no existe' });
  const groups = [...new Set(both.map((p) => p.group).filter((g): g is string => !!g))];
  // Si los dos ya tenían grupo, se juntan en uno: todos quedan como variantes entre sí
  const group = groups[0] ?? randomUUID();
  await db
    .update(products)
    .set({ variantGroup: group })
    .where(groups.length ? or(inArray(products.id, [id!, otherId!]), inArray(products.variantGroup, groups)) : inArray(products.id, [id!, otherId!]));
  refresh();
  go(back, { ok: 'Variante agregada' });
}

export async function unlinkVariantAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'productId');
  const otherId = int(fd, 'otherId');
  const back = `/admin/productos/${id}#variantes`;
  const [o] = otherId ? await db.select({ group: products.variantGroup }).from(products).where(eq(products.id, otherId)).limit(1) : [];
  if (!o?.group) go(back);
  await db.update(products).set({ variantGroup: null }).where(eq(products.id, otherId!));
  // Un grupo de un solo producto no tiene variantes
  const rest = await db.select({ id: products.id }).from(products).where(and(eq(products.variantGroup, o!.group!), ne(products.id, otherId!)));
  if (rest.length < 2) await db.update(products).set({ variantGroup: null }).where(eq(products.variantGroup, o!.group!));
  refresh();
  go(back, { ok: 'Variante quitada' });
}
