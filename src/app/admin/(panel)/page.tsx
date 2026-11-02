import Link from 'next/link';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clp, fecha, ORDER_STATUS_LABEL } from '@/lib/format';

export const metadata = { title: 'Resumen' };

function monthStart() {
  const now = new Date();
  const cl = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  return new Date(Date.UTC(cl.getFullYear(), cl.getMonth(), 1, 3)); // 00:00 Chile ≈ 03:00 UTC
}

export default async function AdminHome() {
  const { orders, products } = schema;
  const since = monthStart();
  const [[month], [counts], recent, lowStock, [ws]] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${orders.total}),0)::int`, n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.paymentStatus, 'pagado'), gte(orders.paidAt, since))),
    db.select({
      porDespachar: sql<number>`count(*) filter (where ${orders.status} in ('pagado','listo_despacho'))::int`,
      fabricacion: sql<number>`count(*) filter (where ${orders.status} = 'en_fabricacion')::int`,
      pendientes: sql<number>`count(*) filter (where ${orders.status} = 'pendiente_pago')::int`,
    }).from(orders),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
    db.select({ id: products.id, name: products.name, stock: products.stock }).from(products)
      .where(and(eq(products.active, true), inArray(products.mode, ['stock', 'ambos']), lte(products.stock, 2))).limit(10),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.wholesaleStatus, 'pending')),
  ]);

  return (
    <>
      <div className="admin-head"><h1>Resumen</h1><Link href="/admin/productos/nuevo" className="btn btn-primary btn-sm">+ Nuevo producto</Link></div>
      <div className="tiles" style={{ marginBottom: 24 }}>
        <div className="tile"><div className="label">Ventas pagadas este mes</div><div className="value">{clp(month.total)}</div><div className="small muted">{month.n} pedidos</div></div>
        <Link className="tile" href="/admin/pedidos?estado=por-despachar"><div className="label">Por despachar</div><div className="value">{counts.porDespachar}</div></Link>
        <Link className="tile" href="/admin/pedidos?estado=en_fabricacion"><div className="label">En fabricación</div><div className="value">{counts.fabricacion}</div></Link>
        <Link className="tile" href="/admin/pedidos?estado=pendiente_pago"><div className="label">Esperando pago</div><div className="value">{counts.pendientes}</div></Link>
        <Link className="tile" href="/admin/mayoristas"><div className="label">Solicitudes mayoristas</div><div className="value">{ws.n}</div></Link>
      </div>

      <div className="grid-2">
        <section className="box">
          <h2>Últimos pedidos</h2>
          {recent.length ? (
            <div className="table-wrap"><table className="table">
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/pedidos/${o.id}`} style={{ fontWeight: 500 }}>{o.number}</Link><div className="small muted">{fecha(o.createdAt)}</div></td>
                    <td>{o.name}{o.isWholesale ? <> <span className="tag tag-yellow">Mayorista</span></> : null}</td>
                    <td>{clp(o.total)}</td>
                    <td><span className={`status st-${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <p className="muted">Aún no hay pedidos.</p>}
        </section>
        <section className="box">
          <h2>Stock bajo (2 o menos)</h2>
          {lowStock.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lowStock.map((p) => <li key={p.id}><Link href={`/admin/productos/${p.id}`}>{p.name}</Link> · <strong>{p.stock}</strong></li>)}
            </ul>
          ) : <p className="muted">Todo con stock.</p>}
        </section>
      </div>
    </>
  );
}
