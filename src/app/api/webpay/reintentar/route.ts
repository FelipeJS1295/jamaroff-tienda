import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { db, schema } from '@/db';
import { webpayTx } from '@/lib/webpay';

const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Reintenta el pago Webpay de un pedido que quedó pendiente
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.number, String(body.number ?? ''))).limit(1);
  if (!order || !sameToken(order.accessToken, String(body.t ?? ''))) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  if (order.paymentStatus !== 'pendiente' || order.status === 'cancelado') return NextResponse.json({ error: 'Este pedido ya no está pendiente de pago' }, { status: 409 });

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.payments).where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.provider, 'webpay')));
  if (n >= 10) return NextResponse.json({ error: 'Demasiados intentos. Escríbenos para ayudarte.' }, { status: 429 });
  try {
    const res = await webpayTx().create(`${order.number}-R${n + 1}`, String(order.id), order.total, `${siteUrl()}/api/webpay/retorno`);
    await db.insert(schema.payments).values({ orderId: order.id, provider: 'webpay', token: res.token, amount: order.total, raw: res });
    if (order.paymentMethod !== 'webpay') await db.update(schema.orders).set({ paymentMethod: 'webpay' }).where(eq(schema.orders.id, order.id));
    return NextResponse.json({ url: res.url, token: res.token });
  } catch (e) {
    console.error('Webpay retry', e);
    return NextResponse.json({ error: 'No pudimos conectar con Webpay. Intenta en unos minutos.' }, { status: 502 });
  }
}
