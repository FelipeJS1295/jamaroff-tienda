import { and, asc, desc, eq, gte, inArray, isNotNull, lt, ne, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { cuadraAuth, siteUrl } from '@/lib/cuadra';

export const dynamic = 'force-dynamic';

/** "2026-10-31" en Chile → instante UTC del inicio de ese día */
function chileDayStart(day: string) {
  // Chile está entre UTC-3 y UTC-4: se busca la hora que cae a las 00:00 en Santiago
  for (const off of [3, 4]) {
    const d = new Date(`${day}T0${off}:00:00Z`);
    const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', hourCycle: 'h23' }).format(d);
    if (h === '00') return d;
  }
  return new Date(`${day}T03:00:00Z`);
}

/**
 * GET /api/cuadra/pedidos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 * Pedidos pagados (y los cancelados después de pagar) creados entre esas fechas, con sus productos.
 * Los pedidos sin pagar no son ventas todavía y no se entregan.
 */
export async function GET(req: Request) {
  const denied = cuadraAuth(req);
  if (denied) return denied;
  const u = new URL(req.url);
  const desde = u.searchParams.get('desde') ?? '';
  const hasta = u.searchParams.get('hasta') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return Response.json({ error: 'Usa ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD' }, { status: 400 });
  }
  const end = chileDayStart(hasta);
  end.setUTCDate(end.getUTCDate() + 1);

  const orders = await db
    .select()
    .from(schema.orders)
    .where(
      and(
        gte(schema.orders.createdAt, chileDayStart(desde)),
        lt(schema.orders.createdAt, end),
        or(ne(schema.orders.status, 'pendiente_pago'), isNotNull(schema.orders.paidAt)),
        or(ne(schema.orders.status, 'cancelado'), isNotNull(schema.orders.paidAt)),
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(2000);

  const ids = orders.map((o) => o.id);
  const items = ids.length
    ? await db
        .select({
          id: schema.orderItems.id,
          orderId: schema.orderItems.orderId,
          sku: schema.products.sku,
          productId: schema.orderItems.productId,
          name: schema.orderItems.name,
          variantName: schema.orderItems.variantName,
          mode: schema.orderItems.mode,
          unitPrice: schema.orderItems.unitPrice,
          quantity: schema.orderItems.quantity,
          leadTimeDays: schema.orderItems.leadTimeDays,
        })
        .from(schema.orderItems)
        .leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
        .where(inArray(schema.orderItems.orderId, ids))
        .orderBy(asc(schema.orderItems.id))
    : [];

  const site = siteUrl();
  return Response.json({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      customer: { name: o.name, email: o.email, phone: o.phone, rut: o.rut },
      invoice: o.invoice,
      isWholesale: o.isWholesale,
      delivery: { method: o.deliveryMethod, region: o.region, comuna: o.comuna, address: [o.address, o.addressExtra].filter(Boolean).join(', ') || null },
      subtotal: o.subtotal,
      discount: o.discount,
      shippingCost: o.shippingCost,
      total: o.total,
      couponCode: o.couponCode,
      carrier: o.carrier,
      trackingCode: o.trackingCode,
      url: `${site}/admin/pedidos/${o.id}`,
      items: items.filter((i) => i.orderId === o.id).map(({ orderId: _o, ...i }) => i),
    })),
  });
}
