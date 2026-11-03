import Link from 'next/link';
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clp, fecha, ORDER_STATUS_LABEL } from '@/lib/format';
import { Flash } from '@/components/admin-flash';
import { DeleteSelected, SelectAll } from '@/components/admin-select';
import { deleteOrdersAction } from '../../actions';

export const metadata = { title: 'Pedidos' };

const TABS: [string, string][] = [
  ['todos', 'Todos'], ['pendiente_pago', 'Esperando pago'], ['por-despachar', 'Por despachar'], ['en_fabricacion', 'En fabricación'],
  ['despachado', 'Despachados'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados'],
];

export default async function PedidosAdmin({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string; tipo?: string; page?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { orders } = schema;
  const estado = sp.estado ?? 'todos';
  const where: SQL[] = [];
  if (estado === 'por-despachar') where.push(inArray(orders.status, ['pagado', 'listo_despacho']));
  else if (estado !== 'todos') where.push(eq(orders.status, estado as typeof orders.status.enumValues[number]));
  if (sp.tipo === 'mayorista') where.push(eq(orders.isWholesale, true));
  if (sp.q) {
    const t = `%${sp.q.replace(/[%_]/g, '')}%`;
    where.push(or(ilike(orders.number, t), ilike(orders.name, t), ilike(orders.email, t), ilike(orders.phone, t))!);
  }
  const page = Math.max(1, Number(sp.page) || 1);
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }], countsRaw] = await Promise.all([
    db.select().from(orders).where(cond).orderBy(desc(orders.createdAt)).limit(50).offset((page - 1) * 50),
    db.select({ total: sql<number>`count(*)::int` }).from(orders).where(cond),
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
  ]);
  const count = (k: string) => k === 'todos' ? countsRaw.reduce((a, r) => a + r.n, 0)
    : k === 'por-despachar' ? countsRaw.filter((r) => r.status === 'pagado' || r.status === 'listo_despacho').reduce((a, r) => a + r.n, 0)
    : countsRaw.find((r) => r.status === k)?.n ?? 0;
  const items = rows.length ? await db.select({ orderId: schema.orderItems.orderId, n: sql<number>`sum(${schema.orderItems.quantity})::int`, pedido: sql<boolean>`bool_or(${schema.orderItems.mode} = 'pedido')` })
    .from(schema.orderItems).where(inArray(schema.orderItems.orderId, rows.map((r) => r.id))).groupBy(schema.orderItems.orderId) : [];
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ estado, q: sp.q, tipo: sp.tipo, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/pedidos?${p}`;
  };

  return (
    <>
      <div className="admin-head">
        <h1>Pedidos</h1>
        <a className="btn btn-outline btn-sm" href={`/admin/pedidos/exportar?${new URLSearchParams(Object.entries({ estado, q: sp.q ?? '', tipo: sp.tipo ?? '' }))}`}>Exportar Excel</a>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="pills">
        {TABS.map(([k, l]) => <Link key={k} className="pill" aria-current={estado === k ? 'true' : undefined} href={qs({ estado: k, page: undefined })}>{l} · {count(k)}</Link>)}
      </div>
      <form className="row" style={{ marginBottom: 16 }} action="/admin/pedidos">
        <input type="hidden" name="estado" value={estado} />
        <label className="sr-only" htmlFor="q">Buscar</label>
        <input id="q" name="q" className="input" style={{ maxWidth: 320 }} placeholder="N°, nombre, correo o teléfono" defaultValue={sp.q} />
        <label className="check small"><input type="checkbox" name="tipo" value="mayorista" defaultChecked={sp.tipo === 'mayorista'} /> Solo mayoristas</label>
        <button className="btn btn-dark btn-sm" type="submit">Buscar</button>
        <span style={{ marginLeft: 'auto' }}><DeleteSelected form="pedidos-sel" name="orderId" formAction={deleteOrdersAction} /></span>
      </form>
      <form id="pedidos-sel"><input type="hidden" name="back" value={qs({ page: sp.page })} /></form>
      <div className="table-wrap box" style={{ padding: 0 }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead><tr><th style={{ width: 36 }}><SelectAll form="pedidos-sel" name="orderId" label="Marcar todos los pedidos de esta página" /></th><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Productos</th><th>Total</th><th>Pago</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.map((o) => {
              const it = items.find((i) => i.orderId === o.id);
              return (
                <tr key={o.id}>
                  <td><input type="checkbox" name="orderId" value={o.id} form="pedidos-sel" aria-label={`Marcar pedido ${o.number}`} /></td>
                  <td><Link href={`/admin/pedidos/${o.id}`} style={{ fontWeight: 500 }}>{o.number}</Link><div className="small muted">{fecha(o.createdAt)}</div></td>
                  <td>{o.name}{o.isWholesale ? <> <span className="tag tag-yellow">Mayorista</span></> : null}<div className="small muted">{o.email}</div></td>
                  <td className="small">{o.deliveryMethod === 'retiro' ? 'Retiro' : `${o.comuna}, ${o.region}`}{o.shippingToQuote ? <><br /><span className="tag tag-red">Despacho a cotizar</span></> : null}</td>
                  <td className="small">{it?.n ?? 0} un.{it?.pedido ? <> · <span className="tag tag-yellow">A pedido</span></> : null}</td>
                  <td>{clp(o.total)}</td>
                  <td className="small">{o.paymentMethod === 'webpay' ? 'Webpay' : 'Transf.'}<br /><span className={`tag ${o.paymentStatus === 'pagado' ? 'tag-green' : o.paymentStatus === 'fallido' ? 'tag-red' : ''}`}>{o.paymentStatus}</span></td>
                  <td><span className={`status st-${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                </tr>
              );
            })}
            {!rows.length ? <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>No hay pedidos con estos filtros.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {total > 50 ? (
        <div className="row" style={{ marginTop: 16 }}>
          {page > 1 ? <Link className="pill" href={qs({ page: String(page - 1) })}>← Anterior</Link> : null}
          <span className="small muted">Página {page} de {Math.ceil(total / 50)}</span>
          {page * 50 < total ? <Link className="pill" href={qs({ page: String(page + 1) })}>Siguiente →</Link> : null}
        </div>
      ) : null}
    </>
  );
}
