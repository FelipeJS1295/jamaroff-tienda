import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { fecha } from '@/lib/format';
import { changePasswordAction, createAdminAction, removeAdminAction } from '../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Usuarios' };

export default async function UsuariosAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [me, sp] = await Promise.all([requireAdmin(), searchParams]);
  const [admins, [{ customers }]] = await Promise.all([
    db.select().from(schema.users).where(eq(schema.users.role, 'admin')).orderBy(desc(schema.users.createdAt)),
    db.select({ customers: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.role, 'customer')),
  ]);
  return (
    <>
      <div className="admin-head"><h1>Usuarios</h1></div>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="small muted">{customers} clientes registrados en la tienda.</p>
      <div className="grid-2">
        <section className="box">
          <h2>Administradores</h2>
          <table className="table"><tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.name}<div className="small muted">{a.email} · desde {fecha(a.createdAt)}</div></td>
                <td style={{ textAlign: 'right' }}>
                  {a.id !== me.id ? (
                    <form action={removeAdminAction}><input type="hidden" name="id" value={a.id} /><button className="mini-btn danger" type="submit">Quitar acceso</button></form>
                  ) : <span className="tag">Tú</span>}
                </td>
              </tr>
            ))}
          </tbody></table>
          <h2 style={{ marginTop: 20 }}>Agregar administrador</h2>
          <form action={createAdminAction} className="stack">
            <label className="field"><span>Nombre</span><input className="input" name="name" required /></label>
            <label className="field"><span>Correo</span><input className="input" name="email" type="email" required /></label>
            <label className="field"><span>Contraseña (mínimo 10 caracteres)</span><input className="input" name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
            <button className="btn btn-dark btn-sm" type="submit">Agregar</button>
          </form>
        </section>
        <section className="box">
          <h2>Cambiar mi contraseña</h2>
          <form action={changePasswordAction} className="stack">
            <label className="field"><span>Contraseña actual</span><input className="input" name="current" type="password" required autoComplete="current-password" /></label>
            <label className="field"><span>Nueva contraseña (mínimo 10 caracteres)</span><input className="input" name="next" type="password" minLength={10} required autoComplete="new-password" /></label>
            <button className="btn btn-outline btn-sm" type="submit">Cambiar</button>
          </form>
        </section>
      </div>
    </>
  );
}
