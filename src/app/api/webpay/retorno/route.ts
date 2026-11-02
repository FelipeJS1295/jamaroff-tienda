import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { webpayTx } from '@/lib/webpay';
import { markOrderPaid } from '@/lib/orders';

const siteUrl = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/**
 * Transbank vuelve aquí después del pago.
 * - Pago normal: llega token_ws → se confirma (commit).
 * - Pago abortado por el cliente: llegan TBK_TOKEN + TBK_ORDEN_COMPRA (sin token_ws).
 * - Timeout: llegan solo TBK_ORDEN_COMPRA y TBK_ID_SESION.
 */
async function handle(params: URLSearchParams) {
  const token = params.get('token_ws');
  const tbkToken = params.get('TBK_TOKEN');
  const buyOrder = params.get('TBK_ORDEN_COMPRA');

  if (!token) {
    const ref = tbkToken ?? null;
    const [pay] = ref ? await db.select().from(schema.payments).where(eq(schema.payments.token, ref)).limit(1) : [];
    const [order] = pay
      ? await db.select().from(schema.orders).where(eq(schema.orders.id, pay.orderId)).limit(1)
      : buyOrder ? await db.select().from(schema.orders).where(eq(schema.orders.number, buyOrder.split('-R')[0])).limit(1) : [];
    if (pay) await db.update(schema.payments).set({ status: 'fallido' }).where(eq(schema.payments.id, pay.id));
    if (order) {
      await db.insert(schema.orderEvents).values({ orderId: order.id, note: 'Pago anulado o expirado en Webpay' });
      return NextResponse.redirect(`${siteUrl()}/pedido/${order.number}?t=${order.accessToken}&pago=anulado`, 303);
    }
    return NextResponse.redirect(`${siteUrl()}/carrito`, 303);
  }

  const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.token, token)).limit(1);
  if (!pay) return NextResponse.redirect(`${siteUrl()}/carrito`, 303);
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, pay.orderId)).limit(1);
  const back = `${siteUrl()}/pedido/${order.number}?t=${order.accessToken}`;

  if (pay.status === 'pagado') return NextResponse.redirect(`${back}&pago=ok`, 303);

  try {
    const res = await webpayTx().commit(token);
    const approved = res?.status === 'AUTHORIZED' && res?.response_code === 0 && Number(res?.amount) === order.total && String(res?.buy_order ?? '').split('-R')[0] === order.number;
    await db.update(schema.payments).set({ status: approved ? 'pagado' : 'fallido', raw: res }).where(eq(schema.payments.id, pay.id));
    if (approved) {
      const cuotas = res.installments_number ? ` · ${res.installments_number} cuotas` : '';
      await markOrderPaid(order.id, `Pago Webpay aprobado · ${res.payment_type_code ?? ''} ****${res.card_detail?.card_number ?? ''}${cuotas} · autorización ${res.authorization_code}`);
      return NextResponse.redirect(`${back}&pago=ok`, 303);
    }
    await db.insert(schema.orderEvents).values({ orderId: order.id, note: `Pago Webpay rechazado (código ${res?.response_code})` });
    return NextResponse.redirect(`${back}&pago=rechazado`, 303);
  } catch (e) {
    console.error('Webpay commit', e);
    await db.update(schema.payments).set({ status: 'fallido' }).where(eq(schema.payments.id, pay.id));
    await db.insert(schema.orderEvents).values({ orderId: order.id, note: 'Error al confirmar el pago con Webpay' });
    return NextResponse.redirect(`${back}&pago=rechazado`, 303);
  }
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const p = new URLSearchParams();
  for (const [k, v] of form.entries()) p.set(k, String(v));
  return handle(p);
}
