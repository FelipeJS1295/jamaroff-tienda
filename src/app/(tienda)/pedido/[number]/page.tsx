import Link from 'next/link';
import { notFound } from 'next/navigation';
import { timingSafeEqual } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getCurrentUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { clp, fechaHora, ORDER_FLOW, ORDER_STATUS_LABEL } from '@/lib/format';
import { ClearCart, RetryWebpay } from './client';

export const metadata = { title: 'Tu pedido', robots: { index: false } };

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function PedidoPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; pago?: string; nuevo?: string }> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.number, number)).limit(1);
  if (!order) notFound();
  const user = await getCurrentUser();
  const allowed = (sp.t && same(order.accessToken, sp.t)) || (user && (user.id === order.userId || user.role === 'admin'));
  if (!allowed) notFound();

  const [items, events, settings] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id)),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id)).orderBy(asc(schema.orderEvents.createdAt)),
    getSettings(),
  ]);

  const paid = order.paymentStatus === 'pagado';
  const pending = order.paymentStatus === 'pendiente' && order.status !== 'cancelado';
  const clearCart = sp.pago === 'ok' || sp.nuevo === '1';
  const stepIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const hasMadeToOrder = items.some((i) => i.mode === 'pedido');
  const flow = ORDER_FLOW.filter((s) => s !== 'en_fabricacion' || hasMadeToOrder);
  const statusDate = (s: string) => events.find((e) => e.status === s)?.createdAt;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 1040 }}>
      {clearCart ? <ClearCart /> : null}
      <span className="eyebrow">Pedido {order.number}</span>
      <h1 className="display" style={{ fontSize: 'clamp(36px,5vw,52px)', margin: '8px 0 20px' }}>
        {paid ? '¡Gracias por tu compra!' : order.status === 'cancelado' ? 'Pedido cancelado' : order.paymentMethod === 'transferencia' ? 'Recibimos tu pedido' : 'Tu pedido está pendiente de pago'}
      </h1>

      {sp.pago === 'ok' ? <p className="alert alert-ok">Pago aprobado. Te enviamos la confirmación a {order.email}.</p> : null}
      {sp.pago === 'rechazado' ? <p className="alert alert-error">El pago no fue aprobado. Puedes intentarlo nuevamente o pagar por transferencia.</p> : null}
      {sp.pago === 'anulado' ? <p className="alert alert-info">Anulaste el pago en Webpay. Tu pedido sigue guardado: puedes pagarlo cuando quieras.</p> : null}

      {pending && order.paymentMethod === 'transferencia' ? (
        <section className="card" style={{ margin: '20px 0' }}>
          <h2 className="display h3" style={{ marginBottom: 12 }}>Datos para transferir</h2>
          <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: '0 0 12px', background: 'var(--ground)', padding: 14 }}>{settings.bankTransferInfo}</pre>
          <p style={{ margin: 0 }}>Monto: <strong>{clp(order.total)}</strong> · Indica <strong>{order.number}</strong> en el asunto. Confirmamos tu pedido apenas veamos el pago.</p>
        </section>
      ) : null}
      {pending ? <RetryWebpay number={order.number} token={sp.t ?? order.accessToken} label={order.paymentMethod === 'transferencia' ? 'Prefiero pagar con Webpay' : 'Pagar con Webpay'} /> : null}

      <div className="cart-layout" style={{ marginTop: 32 }}>
        <div className="cart-main">
          <section className="card" style={{ marginBottom: 24 }}>
            <h2 className="display h3" style={{ marginBottom: 18 }}>Estado</h2>
            {order.status === 'cancelado' ? <p>Este pedido fue cancelado.</p> : (
              <ol className="timeline">
                {flow.map((s) => {
                  const idx = ORDER_FLOW.indexOf(s);
                  const done = stepIndex >= idx;
                  const d = statusDate(s);
                  return (
                    <li key={s}>
                      <span className={`dot ${done ? 'done' : ''}`} aria-hidden="true" />
                      <span>
                        <strong style={{ fontWeight: done ? 500 : 400, color: done ? 'var(--ink)' : 'var(--muted)' }}>{ORDER_STATUS_LABEL[s]}</strong>
                        {d && done ? <span className="small muted"> · {fechaHora(d)}</span> : null}
                        {s === 'despachado' && done && (order.carrier || order.trackingCode) ? (
                          <span className="small" style={{ display: 'block' }}>{order.carrier}{order.trackingCode ? ` · N° seguimiento ${order.trackingCode}` : ''}</span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section className="card">
            <h2 className="display h3" style={{ marginBottom: 12 }}>Productos</h2>
            {items.map((i) => (
              <div key={i.id} className="cart-line" style={{ gridTemplateColumns: '80px minmax(0,1fr) auto' }}>
                {i.imageUrl ? <img src={i.imageUrl} alt="" style={{ width: 80, height: 96 }} /> : <div />}
                <div>
                  <div style={{ fontWeight: 500 }}>{i.quantity} × {i.name}</div>
                  <div className="small muted">{i.variantName ? `${i.variantName} · ` : ''}{i.mode === 'stock' ? 'En stock' : `A pedido${i.leadTimeDays ? ` · fabricación ${i.leadTimeDays} días` : ''}`}</div>
                </div>
                <div style={{ fontWeight: 500 }}>{clp(i.unitPrice * i.quantity)}</div>
              </div>
            ))}
          </section>
        </div>
        <aside className="cart-side card">
          <h2 className="display h3" style={{ marginBottom: 12 }}>Resumen</h2>
          <div className="summary-row"><span>Subtotal</span><span>{clp(order.subtotal)}</span></div>
          {order.discount ? <div className="summary-row"><span>Descuento</span><span>-{clp(order.discount)}</span></div> : null}
          <div className="summary-row"><span>Despacho</span><span>{order.deliveryMethod === 'retiro' ? 'Retiro' : order.shippingToQuote ? 'A cotizar' : clp(order.shippingCost)}</span></div>
          <div className="summary-row summary-total"><span>Total</span><span>{clp(order.total)}</span></div>
          <div className="small" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontWeight: 500 }}>Entrega</strong>
            {order.deliveryMethod === 'retiro' ? <span>Retiro en showroom{settings.showroomAddress ? ` · ${settings.showroomAddress}` : ''}</span> : <span>{order.address}{order.addressExtra ? `, ${order.addressExtra}` : ''}<br />{order.comuna}, {order.region}</span>}
            <strong style={{ fontWeight: 500, marginTop: 10 }}>Pago</strong>
            <span>{order.paymentMethod === 'webpay' ? 'Webpay' : 'Transferencia'} · {paid ? 'Pagado' : order.status === 'cancelado' ? 'Cancelado' : 'Pendiente'}</span>
          </div>
          <Link href="/catalogo" className="btn btn-outline btn-block" style={{ marginTop: 20 }}>Seguir comprando</Link>
        </aside>
      </div>
    </div>
  );
}
