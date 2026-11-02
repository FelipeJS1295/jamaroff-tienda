import { desc, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clp, fecha } from '@/lib/format';
import { wholesaleDecisionAction } from '../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Mayoristas' };

export default async function MayoristasAdmin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const users = await db.select({
    u: schema.users,
    pedidos: sql<number>`(select count(*)::int from orders o where o.user_id = "users"."id" and o.payment_status = 'pagado')`,
    total: sql<number>`(select coalesce(sum(o.total),0)::int from orders o where o.user_id = "users"."id" and o.payment_status = 'pagado')`,
  }).from(schema.users).where(inArray(schema.users.wholesaleStatus, ['pending', 'approved', 'rejected'])).orderBy(desc(schema.users.createdAt));
  const groups = [
    { key: 'pending', title: 'Solicitudes pendientes' },
    { key: 'approved', title: 'Mayoristas activos' },
    { key: 'rejected', title: 'Rechazados' },
  ] as const;
  return (
    <>
      <div className="admin-head"><h1>Mayoristas</h1></div>
      <Flash ok={sp.ok} />
      <p className="small muted">Los mayoristas aprobados ven el “precio mayorista” de cada producto cuando compran la cantidad mínima. Se configura en cada producto.</p>
      {groups.map((g) => {
        const list = users.filter((x) => x.u.wholesaleStatus === g.key);
        if (!list.length && g.key !== 'pending') return null;
        return (
          <section key={g.key} className="box" style={{ marginBottom: 20 }}>
            <h2>{g.title} ({list.length})</h2>
            {list.length ? (
              <div className="table-wrap"><table className="table" style={{ minWidth: 760 }}>
                <thead><tr><th>Empresa</th><th>Contacto</th><th>Desde</th><th>Compras</th><th></th></tr></thead>
                <tbody>
                  {list.map(({ u, pedidos, total }) => (
                    <tr key={u.id}>
                      <td><strong style={{ fontWeight: 500 }}>{u.companyName}</strong><div className="small muted">RUT {u.companyRut} · {u.companyGiro}</div></td>
                      <td>{u.name}<div className="small"><a href={`mailto:${u.email}`}>{u.email}</a>{u.phone ? ` · ${u.phone}` : ''}</div></td>
                      <td className="small">{fecha(u.createdAt)}</td>
                      <td className="small">{pedidos} pedidos · {clp(total)}</td>
                      <td>
                        <form action={wholesaleDecisionAction} className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <input type="hidden" name="userId" value={u.id} />
                          {u.wholesaleStatus !== 'approved' ? <button className="mini-btn" name="decision" value="approve" type="submit">Aprobar</button> : null}
                          {u.wholesaleStatus !== 'rejected' ? <button className="mini-btn danger" name="decision" value="reject" type="submit">{u.wholesaleStatus === 'approved' ? 'Quitar' : 'Rechazar'}</button> : null}
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <p className="muted small" style={{ margin: 0 }}>No hay solicitudes pendientes.</p>}
          </section>
        );
      })}
    </>
  );
}
