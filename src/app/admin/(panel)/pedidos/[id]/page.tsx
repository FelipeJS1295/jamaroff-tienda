import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clp, fechaHora, ORDER_STATUS_LABEL } from '@/lib/format';
import { orderInfoAction, orderStatusAction } from '../../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Pedido' };

const NEXT: Record<string, string[]> = {
  pendiente_pago: ['pagado', 'cancelado'],
  pagado: ['en_fabricacion', 'listo_despacho', 'despachado', 'cancelado'],
  en_fabricacion: ['listo_despacho', 'despachado', 'cancelado'],
  listo_despacho: ['despachado', 'entregado', 'cancelado'],
  despachado: ['entregado'],
  entregado: [],
  cancelado: ['pendiente_pago'],
};

export default async function PedidoAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const oid = Number(id);
  if (!oid) notFound();
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, oid)).limit(1);
  if (!order) notFound();
  const [items, events, payments] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, oid)),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, oid)).orderBy(asc(schema.orderEvents.createdAt)),
    db.select().from(schema.payments).where(eq(schema.payments.orderId, oid)).orderBy(asc(schema.payments.createdAt)),
  ]);
  const options = NEXT[order.status] ?? [];
  const hasPedido = items.some((i) => i.mode === 'pedido');
  const wa = order.phone.replace(/\D/g, '');

  return (
    <>
      <div className="admin-head">
        <div>
          <Link href="/admin/pedidos" className="small">← Pedidos</Link>
          <h1>{order.number}</h1>
          <div className="small muted">{fechaHora(order.createdAt)} · <span className={`status st-${order.status}`}>{ORDER_STATUS_LABEL[order.status]}</span>{order.isWholesale ? <> · <span className="tag tag-yellow">Mayorista</span></> : null}</div>
        </div>
        <a className="btn btn-outline btn-sm" href={`/pedido/${order.number}?t=${order.accessToken}`} target="_blank">Ver como cliente ↗</a>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid-2">
        <div className="stack">
          <section className="box">
            <h2>Productos</h2>
            <table className="table">
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ width: 60 }}>{i.imageUrl ? <img className="thumb" src={i.imageUrl} alt="" /> : null}</td>
                    <td>
                      <strong style={{ fontWeight: 500 }}>{i.quantity} × {i.name}</strong>
                      <div className="small muted">{i.variantName ? `${i.variantName} · ` : ''}{i.mode === 'stock' ? 'En stock' : <span className="tag tag-yellow">A pedido{i.leadTimeDays ? ` · ${i.leadTimeDays} días` : ''}</span>}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{clp(i.unitPrice * i.quantity)}<div className="small muted">{clp(i.unitPrice)} c/u</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <div className="summary-row"><span>Subtotal</span><span>{clp(order.subtotal)}</span></div>
              {order.discount ? <div className="summary-row"><span>Descuento {order.couponCode ? `(${order.couponCode})` : ''}</span><span>-{clp(order.discount)}</span></div> : null}
              <div className="summary-row"><span>Despacho {order.shippingZone ? `· ${order.shippingZone}` : ''}</span><span>{order.deliveryMethod === 'retiro' ? 'Retiro' : order.shippingToQuote ? 'A cotizar' : clp(order.shippingCost)}</span></div>
              <div className="summary-row summary-total"><span>Total</span><span>{clp(order.total)}</span></div>
            </div>
          </section>

          <section className="box">
            <h2>Cliente y entrega</h2>
            <p style={{ margin: '0 0 6px' }}><strong style={{ fontWeight: 500 }}>{order.name}</strong>{order.rut ? ` · RUT ${order.rut}` : ''}</p>
            <p style={{ margin: '0 0 6px' }}><a href={`mailto:${order.email}`}>{order.email}</a> · <a href={`tel:${order.phone}`}>{order.phone}</a>{wa ? <> · <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener">WhatsApp</a></> : null}</p>
            <p style={{ margin: '12px 0 6px' }}>{order.deliveryMethod === 'retiro' ? 'Retiro en showroom' : <>{order.address}{order.addressExtra ? `, ${order.addressExtra}` : ''}<br />{order.comuna}, {order.region}</>}</p>
            {order.customerNotes ? <p className="alert alert-info small" style={{ margin: '10px 0 0' }}>Nota del cliente: {order.customerNotes}</p> : null}
            {order.invoice ? <p className="small" style={{ margin: '12px 0 0' }}><strong style={{ fontWeight: 500 }}>Factura:</strong> {order.invoice.razonSocial} · RUT {order.invoice.rut} · {order.invoice.giro}</p> : <p className="small muted" style={{ margin: '12px 0 0' }}>Boleta</p>}
          </section>

          <section className="box">
            <h2>Historial</h2>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }} className="small">
              {events.map((e) => <li key={e.id}><span className="muted">{fechaHora(e.createdAt)}</span> · {e.status ? <strong style={{ fontWeight: 500 }}>{ORDER_STATUS_LABEL[e.status]}</strong> : null}{e.status && e.note ? ' · ' : ''}{e.note}</li>)}
            </ul>
            {payments.length ? (
              <>
                <h2 style={{ marginTop: 18 }}>Pagos Webpay</h2>
                <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
                  {payments.map((p) => <li key={p.id}>{fechaHora(p.createdAt)} · {clp(p.amount)} · {p.status}</li>)}
                </ul>
              </>
            ) : null}
          </section>
        </div>

        <div className="stack">
          {options.length ? (
            <section className="box">
              <h2>Cambiar estado</h2>
              <form action={orderStatusAction} className="stack">
                <input type="hidden" name="id" value={order.id} />
                <label className="field"><span>Nuevo estado</span>
                  <select className="select" name="status" defaultValue={options.find((o) => o !== 'cancelado' && (hasPedido || o !== 'en_fabricacion')) ?? options[0]}>
                    {options.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
                {order.status === 'pendiente_pago' ? <p className="small muted" style={{ margin: 0 }}>Al marcar “Pagado” se descuenta el stock y se envía la confirmación al cliente (úsalo al recibir una transferencia).</p> : null}
                <div className="row">
                  <label className="field" style={{ flex: 1 }}><span>Transporte</span><input className="input" name="carrier" defaultValue={order.carrier ?? ''} placeholder="Ej: TVP, flete propio" /></label>
                  <label className="field" style={{ flex: 1 }}><span>N° de seguimiento</span><input className="input" name="trackingCode" defaultValue={order.trackingCode ?? ''} /></label>
                </div>
                <label className="field"><span>Nota interna (opcional)</span><input className="input" name="note" /></label>
                <label className="check small"><input type="checkbox" name="notify" defaultChecked /> Avisar al cliente por correo</label>
                <button className="btn btn-dark btn-sm" type="submit">Guardar estado</button>
              </form>
            </section>
          ) : null}

          <section className="box">
            <h2>Notas y despacho</h2>
            <form action={orderInfoAction} className="stack">
              <input type="hidden" name="id" value={order.id} />
              {order.shippingToQuote ? (
                <label className="field"><span>Costo de despacho cotizado (CLP)</span><input className="input" name="shippingCost" inputMode="numeric" placeholder="Ej: 85000" /></label>
              ) : null}
              <input type="hidden" name="carrier" value={order.carrier ?? ''} />
              <input type="hidden" name="trackingCode" value={order.trackingCode ?? ''} />
              <label className="field"><span>Notas internas</span><textarea className="textarea" name="adminNotes" defaultValue={order.adminNotes ?? ''} style={{ minHeight: 90 }} /></label>
              <button className="btn btn-outline btn-sm" type="submit">Guardar</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
