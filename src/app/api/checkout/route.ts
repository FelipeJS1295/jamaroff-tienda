import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/db';
import { applyCoupon, priceCart, sanitizeLines } from '@/lib/cart';
import { getCurrentUser } from '@/lib/auth';
import { quoteShipping } from '@/lib/shipping';
import { isValidComuna } from '@/lib/chile';
import { validRut } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { webpayTx } from '@/lib/webpay';
import { notifyTransferOrder } from '@/lib/orders';

const Form = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre').max(120),
  email: z.string().trim().toLowerCase().email('Correo no válido').max(160),
  phone: z.string().trim().min(8, 'Ingresa un teléfono válido').max(30),
  rut: z.string().trim().max(15).optional().or(z.literal('')),
  deliveryMethod: z.enum(['despacho', 'retiro']),
  region: z.string().trim().max(60).optional(),
  comuna: z.string().trim().max(60).optional(),
  address: z.string().trim().max(200).optional(),
  addressExtra: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(['webpay', 'transferencia']),
  wantsInvoice: z.boolean().optional(),
  invoiceRazonSocial: z.string().trim().max(160).optional(),
  invoiceRut: z.string().trim().max(15).optional(),
  invoiceGiro: z.string().trim().max(160).optional(),
  acceptTerms: z.literal(true, { message: 'Debes aceptar los términos y condiciones' }),
});

const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = Form.safeParse(body.form);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisa el formulario' }, { status: 400 });
  const f = parsed.data;

  if (f.rut && !validRut(f.rut)) return NextResponse.json({ error: 'El RUT no es válido' }, { status: 400 });
  const settings = await getSettings();
  if (f.deliveryMethod === 'retiro' && settings.pickupEnabled !== '1') return NextResponse.json({ error: 'El retiro en tienda no está disponible' }, { status: 400 });
  if (f.deliveryMethod === 'despacho') {
    if (!f.region || !f.comuna || !isValidComuna(f.region, f.comuna)) return NextResponse.json({ error: 'Elige región y comuna' }, { status: 400 });
    if (!f.address || f.address.length < 5) return NextResponse.json({ error: 'Ingresa la dirección de despacho' }, { status: 400 });
  }
  if (f.wantsInvoice) {
    if (!f.invoiceRazonSocial || !f.invoiceRut || !f.invoiceGiro) return NextResponse.json({ error: 'Completa los datos de facturación' }, { status: 400 });
    if (!validRut(f.invoiceRut)) return NextResponse.json({ error: 'El RUT de la empresa no es válido' }, { status: 400 });
  }

  const lines = sanitizeLines(body.lines);
  if (!lines.length) return NextResponse.json({ error: 'Tu carrito está vacío' }, { status: 400 });
  const user = await getCurrentUser();
  const cart = await priceCart(lines, user);
  if (cart.hasErrors) return NextResponse.json({ error: 'Algunos productos cambiaron. Revisa tu carrito.' }, { status: 409 });

  const coupon = await applyCoupon(typeof body.coupon === 'string' ? body.coupon : null, cart.subtotal);

  let shippingCost = 0;
  let shippingToQuote = false;
  let shippingZone: string | null = null;
  if (f.deliveryMethod === 'despacho') {
    const zones = await db.select().from(schema.shippingZones);
    const q = quoteShipping(zones, f.region!, f.comuna!, cart.volume, cart.subtotal);
    shippingZone = q.zone;
    if (q.kind === 'price') shippingCost = q.cost;
    else shippingToQuote = true;
  }
  const total = Math.max(0, cart.subtotal - coupon.discount) + shippingCost;
  if (total <= 0) return NextResponse.json({ error: 'El total del pedido no es válido' }, { status: 400 });

  const accessToken = randomBytes(18).toString('base64url');
  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(schema.orders)
      .values({
        number: `TMP-${accessToken.slice(0, 10)}`,
        accessToken,
        userId: user?.id ?? null,
        isWholesale: cart.wholesale,
        email: f.email,
        name: f.name,
        phone: f.phone,
        rut: f.rut || null,
        deliveryMethod: f.deliveryMethod,
        region: f.deliveryMethod === 'despacho' ? f.region : null,
        comuna: f.deliveryMethod === 'despacho' ? f.comuna : null,
        address: f.deliveryMethod === 'despacho' ? f.address : null,
        addressExtra: f.deliveryMethod === 'despacho' ? f.addressExtra || null : null,
        customerNotes: f.notes || null,
        subtotal: cart.subtotal,
        discount: coupon.discount,
        shippingCost,
        shippingToQuote,
        shippingZone,
        total,
        couponCode: coupon.coupon?.code ?? null,
        paymentMethod: f.paymentMethod,
        invoice: f.wantsInvoice ? { razonSocial: f.invoiceRazonSocial!, rut: f.invoiceRut!, giro: f.invoiceGiro! } : null,
      })
      .returning();
    const number = `JAM-${String(1000 + o.id)}`;
    const [o2] = await tx.update(schema.orders).set({ number }).where(eq(schema.orders.id, o.id)).returning();
    await tx.insert(schema.orderItems).values(
      cart.lines.map((l) => ({
        orderId: o.id,
        productId: l.productId,
        variantId: l.variantId,
        name: l.name,
        variantName: l.variantName,
        mode: l.mode,
        unitPrice: l.unitPrice,
        quantity: l.qty,
        leadTimeDays: l.leadTimeDays,
        imageUrl: l.imageUrl,
      })),
    );
    await tx.insert(schema.orderEvents).values({ orderId: o.id, status: 'pendiente_pago', note: `Pedido creado · pago por ${f.paymentMethod}` });
    return o2;
  });

  const orderUrl = `/pedido/${order.number}?t=${order.accessToken}`;

  if (f.paymentMethod === 'transferencia') {
    await notifyTransferOrder(order);
    return NextResponse.json({ kind: 'redirect', url: `${orderUrl}&nuevo=1` });
  }

  try {
    const res = await webpayTx().create(order.number, String(order.id), order.total, `${siteUrl()}/api/webpay/retorno`);
    await db.insert(schema.payments).values({ orderId: order.id, provider: 'webpay', token: res.token, amount: order.total, raw: res });
    return NextResponse.json({ kind: 'webpay', url: res.url, token: res.token });
  } catch (e) {
    console.error('Webpay create', e);
    await db.insert(schema.orderEvents).values({ orderId: order.id, note: 'No se pudo iniciar Webpay' });
    return NextResponse.json({ error: 'No pudimos conectar con Webpay. Intenta nuevamente o elige transferencia.' }, { status: 502 });
  }
}
