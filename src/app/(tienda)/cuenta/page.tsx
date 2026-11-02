import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireUser } from '@/lib/auth';
import { clp, fecha, ORDER_STATUS_LABEL } from '@/lib/format';
import { logoutAction } from './actions';

export const metadata = { title: 'Mi cuenta', robots: { index: false } };

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ mayorista?: string }> }) {
  const user = await requireUser('/cuenta');
  const sp = await searchParams;
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.userId, user.id)).orderBy(desc(schema.orders.createdAt)).limit(50);

  const ws = user.wholesaleStatus;
  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <span className="eyebrow">Mi cuenta</span>
          <h1 className="display" style={{ fontSize: 'clamp(36px,5vw,52px)', margin: '8px 0 0' }}>Hola, {user.name.split(' ')[0]}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {user.role === 'admin' ? <Link href="/admin" className="btn btn-dark btn-sm">Ir al admin</Link> : null}
          <form action={logoutAction}><button className="btn btn-outline btn-sm" type="submit">Cerrar sesión</button></form>
        </div>
      </div>

      {sp.mayorista === 'enviada' ? <p className="alert alert-ok">Recibimos tu solicitud mayorista. Te avisaremos por correo cuando la aprobemos.</p> : null}
      {ws === 'pending' ? <p className="alert alert-info">Tu solicitud de cuenta mayorista está en revisión.</p> : null}
      {ws === 'approved' ? <p className="alert alert-ok">Cuenta mayorista activa{user.companyName ? ` · ${user.companyName}` : ''}. Verás tus precios mayoristas en el catálogo y el carrito.</p> : null}
      {ws === 'none' || ws === 'rejected' ? <p className="small muted">¿Compras para una empresa? <Link href="/mayoristas">Solicita tu cuenta mayorista</Link>.</p> : null}

      <section className="card" style={{ marginTop: 20 }}>
        <h2 className="display h3" style={{ marginBottom: 12 }}>Mis pedidos</h2>
        {orders.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Pedido</th><th>Fecha</th><th>Total</th><th>Estado</th><th><span className="sr-only">Ver</span></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500 }}>{o.number}</td>
                    <td>{fecha(o.createdAt)}</td>
                    <td>{clp(o.total)}</td>
                    <td><span className={`status st-${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                    <td><Link href={`/pedido/${o.number}`}>Ver detalle</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Aún no tienes pedidos. <Link href="/catalogo">Ver catálogo</Link></p>}
      </section>
    </div>
  );
}
