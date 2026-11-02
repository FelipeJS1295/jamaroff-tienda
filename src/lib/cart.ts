import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { User } from '@/db/schema';
import { packagesVolume } from './shipping';
import { isApprovedWholesale } from './auth';

export type CartLineInput = { productId: number; variantId: number | null; mode: 'stock' | 'pedido'; qty: number };

export type PricedLine = CartLineInput & {
  key: string;
  name: string;
  slug: string;
  variantName: string | null;
  imageUrl: string | null;
  unitPrice: number;
  retailUnitPrice: number;
  lineTotal: number;
  leadTimeDays: number | null;
  volume: number;
  maxQty: number | null;
  wholesaleApplied: boolean;
  wholesaleMinQty: number | null;
  error: string | null;
};

export function lineKey(l: Pick<CartLineInput, 'productId' | 'variantId' | 'mode'>) {
  return `${l.productId}:${l.variantId ?? 0}:${l.mode}`;
}

export function sanitizeLines(input: unknown): CartLineInput[] {
  if (!Array.isArray(input)) return [];
  const out: CartLineInput[] = [];
  for (const raw of input.slice(0, 50)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const productId = Number(r.productId);
    const variantId = r.variantId == null ? null : Number(r.variantId);
    const mode = r.mode === 'pedido' ? 'pedido' : 'stock';
    const qty = Math.min(999, Math.max(1, Math.floor(Number(r.qty) || 1)));
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) continue;
    out.push({ productId, variantId, mode, qty });
  }
  return out;
}

/** Recalcula precios y valida el carrito en el servidor (nunca confiar en el navegador) */
export async function priceCart(lines: CartLineInput[], user: User | null) {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = ids.length
    ? await db.select().from(schema.products).where(inArray(schema.products.id, ids))
    : [];
  const variants = ids.length
    ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, ids))
    : [];
  const images = ids.length
    ? await db
        .select()
        .from(schema.productImages)
        .where(inArray(schema.productImages.productId, ids))
        .orderBy(schema.productImages.position)
    : [];

  const wholesale = isApprovedWholesale(user);
  // cantidad total por producto (para el mínimo mayorista)
  const qtyByProduct = new Map<number, number>();
  for (const l of lines) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qty);

  const priced: PricedLine[] = lines.map((l) => {
    const p = products.find((x) => x.id === l.productId);
    const base = {
      ...l,
      key: lineKey(l),
      name: p?.name ?? 'Producto no disponible',
      slug: p?.slug ?? '',
      variantName: null as string | null,
      imageUrl: null as string | null,
      unitPrice: 0,
      retailUnitPrice: 0,
      lineTotal: 0,
      leadTimeDays: null as number | null,
      volume: 0,
      maxQty: null as number | null,
      wholesaleApplied: false,
      wholesaleMinQty: null as number | null,
      error: null as string | null,
    };
    if (!p || !p.active) return { ...base, error: 'Este producto ya no está disponible' };
    const img = images.find((i) => i.productId === p.id);
    base.imageUrl = img?.thumbUrl ?? img?.url ?? null;

    const allowsStock = p.mode === 'stock' || p.mode === 'ambos';
    const allowsPedido = p.mode === 'pedido' || p.mode === 'ambos';
    if (l.mode === 'stock' && !allowsStock) return { ...base, error: 'Este producto solo se vende a pedido' };
    if (l.mode === 'pedido' && !allowsPedido) return { ...base, error: 'Este producto solo se vende en stock' };

    let delta = 0;
    if (l.variantId) {
      const v = variants.find((x) => x.id === l.variantId && x.productId === p.id);
      if (!v) return { ...base, error: 'La tela elegida ya no está disponible' };
      if (v.madeToOrderOnly && l.mode === 'stock') return { ...base, error: `La tela ${v.name} es solo a pedido` };
      base.variantName = v.name;
      delta = v.priceDelta;
    }

    const retail = p.price + delta;
    const totalQty = qtyByProduct.get(p.id) ?? l.qty;
    const wholesaleOk = wholesale && p.wholesalePrice != null && totalQty >= p.wholesaleMinQty;
    const unit = wholesaleOk ? (p.wholesalePrice as number) + delta : retail;

    let error: string | null = null;
    if (l.mode === 'stock') {
      base.maxQty = p.stock;
      if (p.stock <= 0) error = 'Sin stock. Puedes encargarlo a pedido si está disponible';
      else if (l.qty > p.stock) error = `Solo quedan ${p.stock} en stock`;
    }

    return {
      ...base,
      unitPrice: unit,
      retailUnitPrice: retail,
      lineTotal: unit * l.qty,
      leadTimeDays: l.mode === 'pedido' ? p.leadTimeDays : null,
      volume: packagesVolume(p.packages, l.qty),
      wholesaleApplied: wholesaleOk,
      wholesaleMinQty: wholesale && p.wholesalePrice != null ? p.wholesaleMinQty : null,
      error,
    };
  });

  const valid = priced.filter((l) => !l.error);
  const subtotal = valid.reduce((a, l) => a + l.lineTotal, 0);
  const volume = Math.round(valid.reduce((a, l) => a + l.volume, 0) * 100) / 100;
  const leadTime = valid.reduce<number | null>((a, l) => (l.leadTimeDays != null ? Math.max(a ?? 0, l.leadTimeDays) : a), null);
  return { lines: priced, subtotal, volume, leadTime, hasErrors: priced.some((l) => l.error), wholesale };
}

export async function applyCoupon(code: string | null | undefined, subtotal: number) {
  if (!code) return { discount: 0, coupon: null as null | typeof schema.coupons.$inferSelect, error: null as string | null };
  const clean = code.trim().toUpperCase();
  const [c] = await db
    .select()
    .from(schema.coupons)
    .where(and(eq(schema.coupons.code, clean), eq(schema.coupons.active, true)))
    .limit(1);
  if (!c) return { discount: 0, coupon: null, error: 'Cupón no válido' };
  if (c.expiresAt && c.expiresAt < new Date()) return { discount: 0, coupon: null, error: 'Este cupón expiró' };
  if (c.usageLimit != null && c.used >= c.usageLimit) return { discount: 0, coupon: null, error: 'Este cupón ya fue usado' };
  if (subtotal < c.minSubtotal) return { discount: 0, coupon: null, error: `Válido para compras sobre $${c.minSubtotal.toLocaleString('es-CL')}` };
  const discount = c.type === 'percent' ? Math.round((subtotal * Math.min(100, c.value)) / 100) : Math.min(subtotal, c.value);
  return { discount, coupon: c, error: null };
}

export async function useCoupon(id: number) {
  await db.update(schema.coupons).set({ used: sql`${schema.coupons.used} + 1` }).where(eq(schema.coupons.id, id));
}
