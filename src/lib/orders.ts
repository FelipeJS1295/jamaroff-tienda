import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Order } from '@/db/schema';
import { mailAdminNewOrder, mailOrderReceived, mailStatusChange } from './mail';
import { getSettings } from './settings';
import { useCoupon } from './cart';

export async function getOrderWithItems(id: number) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
  return { order, items };
}

/** Descuenta stock de las líneas "en stock" (una sola vez por pedido) */
async function applyStock(order: Order) {
  if (order.stockApplied) return;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  const problems: string[] = [];
  await db.transaction(async (tx) => {
    for (const it of items) {
      if (it.mode !== 'stock' || !it.productId) continue;
      const res = await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} - ${it.quantity}` })
        .where(and(eq(schema.products.id, it.productId), gte(schema.products.stock, it.quantity)))
        .returning({ id: schema.products.id });
      if (res.length === 0) problems.push(`${it.name}: stock insuficiente al confirmar el pago`);
    }
    await tx.update(schema.orders).set({ stockApplied: true }).where(eq(schema.orders.id, order.id));
    if (problems.length) {
      await tx.insert(schema.orderEvents).values({ orderId: order.id, note: `Revisar: ${problems.join('; ')}` });
    }
  });
}

async function restoreStock(order: Order) {
  if (!order.stockApplied) return;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  await db.transaction(async (tx) => {
    for (const it of items) {
      if (it.mode !== 'stock' || !it.productId) continue;
      await tx
        .update(schema.products)
        .set({ stock: sql`${schema.products.stock} + ${it.quantity}` })
        .where(eq(schema.products.id, it.productId));
    }
    await tx.update(schema.orders).set({ stockApplied: false }).where(eq(schema.orders.id, order.id));
  });
}

/** Marca un pedido como pagado: descuenta stock, cuenta el cupón y envía correos */
export async function markOrderPaid(orderId: number, note: string) {
  const [updated] = await db
    .update(schema.orders)
    .set({ paymentStatus: 'pagado', status: 'pagado', paidAt: new Date() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.paymentStatus, 'pendiente')))
    .returning();
  if (!updated) return null; // ya estaba pagado o no existe (evita doble proceso)
  await db.insert(schema.orderEvents).values({ orderId, status: 'pagado', note });
  await applyStock(updated);
  if (updated.couponCode) {
    const [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, updated.couponCode)).limit(1);
    if (c) await useCoupon(c.id);
  }
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  await mailOrderReceived(updated, items);
  await mailAdminNewOrder(updated, items);
  return updated;
}

/** Aviso inicial para pedidos por transferencia (aún sin pagar) */
export async function notifyTransferOrder(order: Order) {
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  const settings = await getSettings();
  await mailOrderReceived(order, items, settings.bankTransferInfo);
  await mailAdminNewOrder(order, items);
}

export async function changeOrderStatus(orderId: number, status: Order['status'], opts: { note?: string; notify?: boolean } = {}) {
  const [before] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!before || before.status === status) return before ?? null;

  // Pasar a "pagado" o más allá desde pendiente implica registrar el pago
  if (before.paymentStatus === 'pendiente' && status !== 'cancelado' && status !== 'pendiente_pago') {
    const paid = await markOrderPaid(orderId, `Pago confirmado manualmente desde el admin${opts.note ? ` · ${opts.note}` : ''}`);
    if (status === 'pagado') return paid; // markOrderPaid ya registró el evento y avisó al cliente
  }
  if (status === 'cancelado') await restoreStock(before);

  const [after] = await db.update(schema.orders).set({ status }).where(eq(schema.orders.id, orderId)).returning();
  await db.insert(schema.orderEvents).values({ orderId, status, note: opts.note ?? null });
  if (opts.notify !== false && status !== 'pagado' && status !== 'pendiente_pago') await mailStatusChange(after);
  return after;
}
