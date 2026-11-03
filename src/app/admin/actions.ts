'use server';

import { redirect } from 'next/navigation';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { db, schema } from '@/db';
import type { PackageSpec } from '@/db/schema';
import {
  endSession, hashPassword, recordAttempt, requireAdmin, startSession, tooManyAttempts, verifyPassword,
} from '@/lib/auth';
import { changeOrderStatus, deleteOrders } from '@/lib/orders';
import { deleteUpload, saveProductImage } from '@/lib/uploads';
import { slugify } from '@/lib/format';
import { mailWholesaleDecision } from '@/lib/mail';
import { SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';
import { REGION_NAMES, normalize, REGIONS } from '@/lib/chile';
import { LIGHT_HOURS, hourText } from '@/lib/light';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const int = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/[^\d-]/g, '');
  return v === '' ? null : Number.parseInt(v, 10);
};
const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === '1' || fd.get(k) === 'true';
function go(target: string, params: Record<string, string> = {}): never {
  // El #ancla va siempre al final, después de los parámetros
  const [path, hash] = target.split('#');
  const qs = new URLSearchParams(params).toString();
  redirect((qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path) + (hash ? `#${hash}` : ''));
}

// ─── Sesión ─────────────────────────────────────────────────────────
export async function adminLoginAction(fd: FormData) {
  const email = str(fd, 'email').toLowerCase();
  if (await tooManyAttempts(email)) go('/admin/ingresar', { error: 'Demasiados intentos. Espera 15 minutos.' });
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = !!u && u.role === 'admin' && (await verifyPassword(str(fd, 'password'), u.passwordHash));
  await recordAttempt(email, ok);
  if (!ok) go('/admin/ingresar', { error: 'Datos incorrectos o sin acceso de administrador' });
  await startSession(u!.id);
  redirect('/admin');
}

export async function adminLogoutAction() {
  await endSession();
  redirect('/admin/ingresar');
}

// ─── Pedidos ────────────────────────────────────────────────────────
const STATUSES = ['pendiente_pago', 'pagado', 'en_fabricacion', 'listo_despacho', 'despachado', 'entregado', 'cancelado'] as const;

export async function orderStatusAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const status = str(fd, 'status') as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) go(`/admin/pedidos/${id}`, { error: 'Estado no válido' });
  const carrier = str(fd, 'carrier');
  const tracking = str(fd, 'trackingCode');
  if (carrier || tracking) {
    await db.update(schema.orders).set({ carrier: carrier || null, trackingCode: tracking || null }).where(eq(schema.orders.id, id));
  }
  await changeOrderStatus(id, status, { note: str(fd, 'note') || undefined, notify: bool(fd, 'notify') });
  go(`/admin/pedidos/${id}`, { ok: 'Estado actualizado' });
}

export async function orderInfoAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!o) go('/admin/pedidos');
  const patch: Partial<typeof schema.orders.$inferInsert> = {
    adminNotes: str(fd, 'adminNotes') || null,
    carrier: str(fd, 'carrier') || null,
    trackingCode: str(fd, 'trackingCode') || null,
  };
  const quoted = int(fd, 'shippingCost');
  if (o!.shippingToQuote && quoted != null && quoted >= 0) {
    patch.shippingCost = quoted;
    patch.shippingToQuote = false;
    if (o!.paymentStatus === 'pendiente') patch.total = o!.subtotal - o!.discount + quoted;
    await db.insert(schema.orderEvents).values({
      orderId: id,
      note: o!.paymentStatus === 'pendiente' ? `Despacho cotizado: $${quoted.toLocaleString('es-CL')} (sumado al total)` : `Despacho cotizado: $${quoted.toLocaleString('es-CL')} (cobrar aparte)`,
    });
  }
  await db.update(schema.orders).set(patch).where(eq(schema.orders.id, id));
  go(`/admin/pedidos/${id}`, { ok: 'Pedido guardado' });
}

// ─── Productos ──────────────────────────────────────────────────────
const ProductSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto').max(160),
  sku: z.string().max(60).optional(),
  description: z.string().max(10000),
  categoryId: z.number().int().positive().nullable(),
  price: z.number().int().min(0, 'Precio no válido'),
  compareAtPrice: z.number().int().min(0).nullable(),
  wholesalePrice: z.number().int().min(0).nullable(),
  wholesaleMinQty: z.number().int().min(1),
  mode: z.enum(['stock', 'pedido', 'ambos']),
  stock: z.number().int().min(0),
  leadTimeDays: z.number().int().min(0).nullable(),
  material: z.string().max(80).nullable(),
  color: z.string().max(80).nullable(),
  dimensions: z.string().max(120).nullable(),
  featured: z.boolean(),
  active: z.boolean(),
});

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

async function uniqueSlug(base: string, exceptId?: number) {
  const root = slugify(base) || 'producto';
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const [hit] = await db.select({ id: schema.products.id }).from(schema.products)
      .where(exceptId ? and(eq(schema.products.slug, slug), ne(schema.products.id, exceptId)) : eq(schema.products.slug, slug)).limit(1);
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function saveProductAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id');
  const back = id ? `/admin/productos/${id}` : '/admin/productos/nuevo';
  const parsed = ProductSchema.safeParse({
    name: str(fd, 'name'),
    sku: str(fd, 'sku') || undefined,
    description: str(fd, 'description'),
    categoryId: int(fd, 'categoryId'),
    price: int(fd, 'price') ?? -1,
    compareAtPrice: int(fd, 'compareAtPrice'),
    wholesalePrice: int(fd, 'wholesalePrice'),
    wholesaleMinQty: int(fd, 'wholesaleMinQty') ?? 1,
    mode: str(fd, 'mode'),
    stock: int(fd, 'stock') ?? 0,
    leadTimeDays: int(fd, 'leadTimeDays'),
    material: str(fd, 'material') || null,
    color: str(fd, 'color') || null,
    dimensions: str(fd, 'dimensions') || null,
    featured: bool(fd, 'featured'),
    active: bool(fd, 'active'),
  });
  if (!parsed.success) go(back, { error: parsed.error.issues[0].message });
  const p = parsed.data!;

  const packages = parseJson<PackageSpec[]>(str(fd, 'packagesJson'), [])
    .map((x) => ({ largo: Number(x.largo) || 0, ancho: Number(x.ancho) || 0, alto: Number(x.alto) || 0, peso: Number(x.peso) || 0 }))
    .filter((x) => x.largo && x.ancho && x.alto);
  const specs = parseJson<{ label: string; value: string }[]>(str(fd, 'specsJson'), [])
    .map((x) => ({ label: String(x.label ?? '').trim().slice(0, 80), value: String(x.value ?? '').trim().slice(0, 200) }))
    .filter((x) => x.label && x.value);
  const variants = parseJson<{ id?: number; name: string; hex: string; priceDelta: number; madeToOrderOnly: boolean }[]>(str(fd, 'variantsJson'), [])
    .map((v) => ({ id: Number(v.id) || undefined, name: String(v.name ?? '').trim().slice(0, 80), hex: /^#[0-9a-f]{6}$/i.test(v.hex) ? v.hex : '#cccccc', priceDelta: Math.round(Number(v.priceDelta) || 0), madeToOrderOnly: !!v.madeToOrderOnly }))
    .filter((v) => v.name);

  const values = { ...p, sku: p.sku ?? null, packages, specs, updatedAt: new Date() };
  let productId = id;
  if (id) {
    await db.update(schema.products).set(values).where(eq(schema.products.id, id));
  } else {
    const [row] = await db.insert(schema.products).values({ ...values, slug: await uniqueSlug(p.name) }).returning({ id: schema.products.id });
    productId = row.id;
  }

  // Variantes: actualiza las existentes, crea nuevas y elimina las quitadas
  const existing = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, productId!));
  const keep = new Set<number>();
  for (const [pos, v] of variants.entries()) {
    if (v.id && existing.some((e) => e.id === v.id)) {
      keep.add(v.id);
      await db.update(schema.productVariants).set({ name: v.name, hex: v.hex, priceDelta: v.priceDelta, madeToOrderOnly: v.madeToOrderOnly, position: pos }).where(eq(schema.productVariants.id, v.id));
    } else {
      await db.insert(schema.productVariants).values({ productId: productId!, name: v.name, hex: v.hex, priceDelta: v.priceDelta, madeToOrderOnly: v.madeToOrderOnly, position: pos });
    }
  }
  const remove = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (remove.length) await db.delete(schema.productVariants).where(inArray(schema.productVariants.id, remove));

  go(`/admin/productos/${productId}`, { ok: id ? 'Producto guardado' : 'Producto creado. Ahora sube sus fotos.' });
}

export async function productSlugAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const slug = await uniqueSlug(str(fd, 'slug'), id);
  await db.update(schema.products).set({ slug }).where(eq(schema.products.id, id));
  go(`/admin/productos/${id}`, { ok: `Dirección actualizada: /producto/${slug}` });
}

export async function deleteProductAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const imgs = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, id));
  const lights = await db.select().from(schema.productLightImages).where(eq(schema.productLightImages.productId, id));
  await db.delete(schema.products).where(eq(schema.products.id, id));
  for (const i of [...imgs, ...lights]) { await deleteUpload(i.url); await deleteUpload(i.thumbUrl); }
  go('/admin/productos', { ok: 'Producto eliminado' });
}

export async function duplicateProductAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!p) go('/admin/productos');
  const { id: _omit, createdAt: _c, updatedAt: _u, slug: _s, ...rest } = p!;
  const [copy] = await db.insert(schema.products).values({ ...rest, name: `${p!.name} (copia)`, sku: p!.sku ? `${p!.sku}-COPIA` : null, slug: await uniqueSlug(`${p!.name} copia`), active: false }).returning();
  const vs = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, id));
  if (vs.length) await db.insert(schema.productVariants).values(vs.map(({ id: _i, productId: _p, ...v }) => ({ ...v, productId: copy.id })));
  go(`/admin/productos/${copy.id}`, { ok: 'Copia creada (oculta). Revisa los datos y sube fotos.' });
}

export async function quickStockAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  const stock = Math.max(0, int(fd, 'stock') ?? 0);
  await db.update(schema.products).set({ stock, updatedAt: new Date() }).where(eq(schema.products.id, id));
  go(str(fd, 'back') || '/admin/productos', { ok: 'Stock actualizado' });
}

export async function uploadImagesAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'productId')!;
  const files = fd.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) go(`/admin/productos/${id}`, { error: 'Elige al menos una foto' });
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${schema.productImages.position}), -1)::int` }).from(schema.productImages).where(eq(schema.productImages.productId, id));
  const [prod] = await db.select({ name: schema.products.name }).from(schema.products).where(eq(schema.products.id, id)).limit(1);
  let pos = max + 1;
  try {
    for (const f of files.slice(0, 20)) {
      const saved = await saveProductImage(f);
      await db.insert(schema.productImages).values({ productId: id, url: saved.url, thumbUrl: saved.thumbUrl, alt: prod?.name ?? null, position: pos++ });
    }
  } catch (e) {
    go(`/admin/productos/${id}`, { error: (e as Error).message });
  }
  go(`/admin/productos/${id}`, { ok: `${files.length} foto(s) subida(s)` });
}

export async function imageAction(fd: FormData) {
  await requireAdmin();
  const imgId = int(fd, 'imageId')!;
  const op = str(fd, 'op');
  const [img] = await db.select().from(schema.productImages).where(eq(schema.productImages.id, imgId)).limit(1);
  if (!img) go('/admin/productos');
  const back = `/admin/productos/${img!.productId}`;
  if (op === 'delete') {
    await db.delete(schema.productImages).where(eq(schema.productImages.id, imgId));
    await deleteUpload(img!.url);
    await deleteUpload(img!.thumbUrl);
    go(back, { ok: 'Foto eliminada' });
  }
  // Reordenar: 'first' la deja como principal, 'left'/'right' la mueve
  const all = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, img!.productId)).orderBy(asc(schema.productImages.position));
  const idx = all.findIndex((x) => x.id === imgId);
  const order = [...all];
  order.splice(idx, 1);
  const to = op === 'first' ? 0 : op === 'left' ? Math.max(0, idx - 1) : Math.min(all.length - 1, idx + 1);
  order.splice(to, 0, img!);
  for (const [i, x] of order.entries()) await db.update(schema.productImages).set({ position: i }).where(eq(schema.productImages.id, x.id));
  go(back);
}

// ─── Luz del día: la misma escena a distintas horas ─────────────────
export async function uploadLightAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'productId')!;
  const back = `/admin/productos/${id}#luz`;
  // Se pueden subir varias horas de una vez: un campo por hora (luz_8, luz_10, …)
  const files = LIGHT_HOURS.map((h) => ({ h, f: fd.get(`luz_${h}`) })).filter((x): x is { h: (typeof LIGHT_HOURS)[number]; f: File } => x.f instanceof File && x.f.size > 0);
  if (!files.length) go(back, { error: 'Elige al menos una foto' });
  try {
    for (const { h, f } of files) {
      const saved = await saveProductImage(f);
      const [old] = await db.select().from(schema.productLightImages).where(and(eq(schema.productLightImages.productId, id), eq(schema.productLightImages.hour, h))).limit(1);
      if (old) {
        await db.update(schema.productLightImages).set({ url: saved.url, thumbUrl: saved.thumbUrl, createdAt: new Date() }).where(eq(schema.productLightImages.id, old.id));
        await deleteUpload(old.url);
        await deleteUpload(old.thumbUrl);
      } else {
        await db.insert(schema.productLightImages).values({ productId: id, hour: h, url: saved.url, thumbUrl: saved.thumbUrl });
      }
    }
  } catch (e) {
    go(back, { error: (e as Error).message });
  }
  go(back, { ok: files.length === 1 ? `Foto de las ${hourText(files[0].h)} guardada` : `${files.length} fotos de luz guardadas` });
}

export async function deleteLightAction(fd: FormData) {
  await requireAdmin();
  const lightId = int(fd, 'lightId')!;
  const [img] = await db.select().from(schema.productLightImages).where(eq(schema.productLightImages.id, lightId)).limit(1);
  if (!img) go('/admin/productos');
  await db.delete(schema.productLightImages).where(eq(schema.productLightImages.id, lightId));
  await deleteUpload(img!.url);
  await deleteUpload(img!.thumbUrl);
  go(`/admin/productos/${img!.productId}#luz`, { ok: `Foto de las ${hourText(img!.hour)} eliminada` });
}

// Importación masiva desde Excel (columnas de la plantilla)
export async function importProductsAction(fd: FormData) {
  await requireAdmin();
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) go('/admin/productos/importar', { error: 'Elige un archivo .xlsx' });
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await (file as File).arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    go('/admin/productos/importar', { error: 'No pudimos leer el archivo. Usa la plantilla en formato .xlsx' });
  }
  const ws = wb.worksheets[0];
  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => { header[normalize(String(cell.value ?? ''))] = col; });
  const need = ['sku', 'nombre', 'precio'];
  const missing = need.filter((k) => !header[k]);
  if (missing.length) go('/admin/productos/importar', { error: `Faltan columnas: ${missing.join(', ')}` });

  const cats = await db.select().from(schema.categories);
  const get = (row: ExcelJS.Row, key: string) => {
    const c = header[key];
    if (!c) return '';
    const v = row.getCell(c).value as unknown;
    if (v && typeof v === 'object' && 'result' in (v as object)) return String((v as { result: unknown }).result ?? '').trim();
    if (v && typeof v === 'object' && 'text' in (v as object)) return String((v as { text: unknown }).text ?? '').trim();
    return String(v ?? '').trim();
  };
  const num = (s: string) => (s === '' ? null : Number(String(s).replace(/[^\d]/g, '')) || 0);

  let created = 0, updated = 0;
  const errors: string[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sku = get(row, 'sku');
    const name = get(row, 'nombre');
    if (!sku && !name) continue;
    if (!sku || !name) { errors.push(`Fila ${r}: falta SKU o nombre`); continue; }
    const price = num(get(row, 'precio'));
    if (price == null) { errors.push(`Fila ${r}: falta precio`); continue; }
    const catName = get(row, 'categoria');
    let categoryId: number | null = null;
    if (catName) {
      let c = cats.find((x) => normalize(x.name) === normalize(catName));
      if (!c) {
        [c] = await db.insert(schema.categories).values({ name: catName, slug: slugify(catName) || `cat-${Date.now()}`, position: cats.length + 1 }).onConflictDoNothing().returning();
        if (!c) [c] = await db.select().from(schema.categories).where(eq(schema.categories.slug, slugify(catName))).limit(1);
        if (c) cats.push(c);
      }
      categoryId = c?.id ?? null;
    }
    const modeRaw = normalize(get(row, 'modalidad'));
    const mode = modeRaw.startsWith('pedido') || modeRaw === 'a pedido' ? 'pedido' : modeRaw.startsWith('ambos') ? 'ambos' : 'stock';
    const bultos: PackageSpec[] = get(row, 'bultos (largoxanchoxalto cm; kg)')
      .split(';').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const m = s.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)(?:\s*[,/]\s*(\d+))?/i); return m ? { largo: +m[1], ancho: +m[2], alto: +m[3], peso: +(m[4] ?? 0) } : null; })
      .filter((x): x is PackageSpec => !!x);
    const values = {
      sku, name, price, categoryId, mode: mode as 'stock' | 'pedido' | 'ambos',
      description: get(row, 'descripcion'),
      compareAtPrice: num(get(row, 'precio antes')),
      wholesalePrice: num(get(row, 'precio mayorista')),
      wholesaleMinQty: num(get(row, 'minimo mayorista')) || 1,
      stock: num(get(row, 'stock')) ?? 0,
      leadTimeDays: num(get(row, 'dias fabricacion')),
      material: get(row, 'material') || null,
      color: get(row, 'color') || null,
      dimensions: get(row, 'medidas') || null,
      active: normalize(get(row, 'activo') || 'si') !== 'no',
      updatedAt: new Date(),
      ...(bultos.length ? { packages: bultos } : {}),
    };
    const [existing] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.sku, sku)).limit(1);
    if (existing) { await db.update(schema.products).set(values).where(eq(schema.products.id, existing.id)); updated++; }
    else { await db.insert(schema.products).values({ ...values, slug: await uniqueSlug(name) }); created++; }
  }
  go('/admin/productos/importar', { ok: `Importación lista: ${created} creados, ${updated} actualizados${errors.length ? `. ${errors.length} filas con error` : ''}`, ...(errors.length ? { detalle: errors.slice(0, 15).join(' · ') } : {}) });
}

// ─── Categorías ─────────────────────────────────────────────────────
export async function saveCategoryAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id');
  const name = str(fd, 'name');
  if (name.length < 2) go('/admin/categorias', { error: 'Nombre muy corto' });
  const values = { name, description: str(fd, 'description') || null, position: int(fd, 'position') ?? 0, showInMenu: bool(fd, 'showInMenu') };
  if (id) await db.update(schema.categories).set(values).where(eq(schema.categories.id, id));
  else {
    let slug = slugify(name);
    const [hit] = await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1);
    if (hit) slug = `${slug}-${Date.now() % 10000}`;
    await db.insert(schema.categories).values({ ...values, slug });
  }
  go('/admin/categorias', { ok: 'Categoría guardada' });
}

export async function deleteCategoryAction(fd: FormData) {
  await requireAdmin();
  await db.delete(schema.categories).where(eq(schema.categories.id, int(fd, 'id')!));
  go('/admin/categorias', { ok: 'Categoría eliminada (sus productos quedaron sin categoría)' });
}

// ─── Mayoristas y solicitudes ───────────────────────────────────────
export async function wholesaleDecisionAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'userId')!;
  const approve = str(fd, 'decision') === 'approve';
  const [u] = await db.update(schema.users).set({ wholesaleStatus: approve ? 'approved' : 'rejected' }).where(eq(schema.users.id, id)).returning();
  if (u) await mailWholesaleDecision(u.email, u.name, approve);
  go('/admin/mayoristas', { ok: approve ? `Aprobado: ${u?.companyName ?? u?.email}` : 'Solicitud rechazada' });
}

export async function quoteStatusAction(fd: FormData) {
  await requireAdmin();
  const status = str(fd, 'status');
  if (!['nueva', 'respondida', 'cerrada'].includes(status)) go('/admin/solicitudes');
  await db.update(schema.quoteRequests).set({ status: status as 'nueva' | 'respondida' | 'cerrada' }).where(eq(schema.quoteRequests.id, int(fd, 'id')!));
  go('/admin/solicitudes', { ok: 'Solicitud actualizada' });
}

// ─── Despachos ──────────────────────────────────────────────────────
export async function saveZoneAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id');
  const name = str(fd, 'name');
  if (name.length < 2) go('/admin/despachos', { error: 'Ponle un nombre a la zona' });
  const regions = fd.getAll('regions').map(String).filter((r) => REGION_NAMES.includes(r));
  const allComunas = REGIONS.flatMap((r) => r.comunas);
  const typed = str(fd, 'comunas').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const comunas: string[] = [];
  const unknown: string[] = [];
  for (const t of typed) {
    const hit = allComunas.find((c) => normalize(c) === normalize(t));
    if (hit) comunas.push(hit); else unknown.push(t);
  }
  if (unknown.length) go('/admin/despachos', { error: `Comunas no reconocidas: ${unknown.join(', ')}` });
  if (!regions.length && !comunas.length) go('/admin/despachos', { error: 'Elige al menos una región o comuna' });
  const values = {
    name, regions, comunas,
    baseRate: int(fd, 'baseRate') ?? 0,
    ratePerM3: int(fd, 'ratePerM3') ?? 0,
    minRate: int(fd, 'minRate') ?? 0,
    freeOver: int(fd, 'freeOver'),
    etaText: str(fd, 'etaText'),
    carrier: str(fd, 'carrier') || null,
    quoteOnly: bool(fd, 'quoteOnly'),
    active: bool(fd, 'active'),
    position: int(fd, 'position') ?? 0,
  };
  if (id) await db.update(schema.shippingZones).set(values).where(eq(schema.shippingZones.id, id));
  else await db.insert(schema.shippingZones).values(values);
  go('/admin/despachos', { ok: 'Zona guardada' });
}

export async function deleteZoneAction(fd: FormData) {
  await requireAdmin();
  await db.delete(schema.shippingZones).where(eq(schema.shippingZones.id, int(fd, 'id')!));
  go('/admin/despachos', { ok: 'Zona eliminada' });
}

// ─── Cupones ────────────────────────────────────────────────────────
export async function saveCouponAction(fd: FormData) {
  await requireAdmin();
  const code = str(fd, 'code').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const type = str(fd, 'type') === 'amount' ? 'amount' : 'percent';
  const value = int(fd, 'value') ?? 0;
  if (code.length < 3) go('/admin/cupones', { error: 'El código debe tener al menos 3 caracteres' });
  if (value <= 0 || (type === 'percent' && value > 90)) go('/admin/cupones', { error: 'Valor de descuento no válido' });
  const exp = str(fd, 'expiresAt');
  await db.insert(schema.coupons).values({
    code, type, value, minSubtotal: int(fd, 'minSubtotal') ?? 0, usageLimit: int(fd, 'usageLimit'),
    expiresAt: exp ? new Date(`${exp}T23:59:59-03:00`) : null,
  }).onConflictDoUpdate({ target: schema.coupons.code, set: { type, value, minSubtotal: int(fd, 'minSubtotal') ?? 0, usageLimit: int(fd, 'usageLimit'), expiresAt: exp ? new Date(`${exp}T23:59:59-03:00`) : null, active: true } });
  go('/admin/cupones', { ok: `Cupón ${code} guardado` });
}

export async function couponToggleAction(fd: FormData) {
  await requireAdmin();
  const id = int(fd, 'id')!;
  if (str(fd, 'op') === 'delete') await db.delete(schema.coupons).where(eq(schema.coupons.id, id));
  else await db.update(schema.coupons).set({ active: sql`not ${schema.coupons.active}` }).where(eq(schema.coupons.id, id));
  go('/admin/cupones');
}

// ─── Usuarios administradores ───────────────────────────────────────
export async function createAdminAction(fd: FormData) {
  const me = await requireAdmin();
  const email = str(fd, 'email').toLowerCase();
  const name = str(fd, 'name');
  const password = str(fd, 'password');
  if (!z.string().email().safeParse(email).success) go('/admin/usuarios', { error: 'Correo no válido' });
  if (password.length < 10) go('/admin/usuarios', { error: 'La contraseña debe tener al menos 10 caracteres' });
  const [exists] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (exists) await db.update(schema.users).set({ role: 'admin', passwordHash: await hashPassword(password), name: name || exists.name }).where(eq(schema.users.id, exists.id));
  else await db.insert(schema.users).values({ email, name: name || email, role: 'admin', passwordHash: await hashPassword(password) });
  void me;
  go('/admin/usuarios', { ok: `${email} ahora es administrador` });
}

export async function removeAdminAction(fd: FormData) {
  const me = await requireAdmin();
  const id = int(fd, 'id')!;
  if (id === me.id) go('/admin/usuarios', { error: 'No puedes quitarte el acceso a ti mismo' });
  await db.update(schema.users).set({ role: 'customer' }).where(eq(schema.users.id, id));
  go('/admin/usuarios', { ok: 'Acceso de administrador quitado' });
}

export async function changePasswordAction(fd: FormData) {
  const me = await requireAdmin();
  const current = str(fd, 'current');
  const next = str(fd, 'next');
  if (!(await verifyPassword(current, me.passwordHash))) go('/admin/usuarios', { error: 'Tu contraseña actual no coincide' });
  if (next.length < 10) go('/admin/usuarios', { error: 'La nueva contraseña debe tener al menos 10 caracteres' });
  await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, me.id));
  go('/admin/usuarios', { ok: 'Contraseña actualizada' });
}

// ─── Ajustes ────────────────────────────────────────────────────────
export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    const value = key === 'pickupEnabled' ? (bool(fd, key) ? '1' : '0') : str(fd, key);
    await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }
  go('/admin/ajustes', { ok: 'Ajustes guardados' });
}

// ─── Eliminar pedidos (compras de prueba, duplicados) ───────────────
export async function deleteOrdersAction(fd: FormData) {
  await requireAdmin();
  const ids = fd.getAll('orderId').map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  const back = str(fd, 'back') || '/admin/pedidos';
  if (!ids.length) go(back, { error: 'Marca al menos un pedido para eliminar' });
  const n = await deleteOrders(ids);
  go(back.startsWith('/admin/pedidos/') ? '/admin/pedidos' : back, { ok: n === 1 ? 'Pedido eliminado' : `${n} pedidos eliminados` });
}
