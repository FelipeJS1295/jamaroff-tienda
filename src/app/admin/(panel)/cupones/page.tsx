import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { clp, fecha } from '@/lib/format';
import { couponToggleAction, saveCouponAction } from '../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Cupones' };

export default async function CuponesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const coupons = await db.select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
  return (
    <>
      <div className="admin-head"><h1>Cupones</h1></div>
      <Flash ok={sp.ok} error={sp.error} />
      <section className="box" style={{ marginBottom: 20 }}>
        <h2>Crear o editar cupón</h2>
        <form action={saveCouponAction} className="row">
          <label className="field" style={{ flex: '1 1 140px' }}><span>Código</span><input className="input" name="code" required placeholder="VERANO15" style={{ textTransform: 'uppercase' }} /></label>
          <label className="field" style={{ flex: '1 1 140px' }}><span>Tipo</span><select className="select" name="type"><option value="percent">% de descuento</option><option value="amount">Monto fijo $</option></select></label>
          <label className="field" style={{ flex: '1 1 100px' }}><span>Valor</span><input className="input" name="value" inputMode="numeric" required /></label>
          <label className="field" style={{ flex: '1 1 140px' }}><span>Compra mínima $</span><input className="input" name="minSubtotal" inputMode="numeric" defaultValue={0} /></label>
          <label className="field" style={{ flex: '1 1 110px' }}><span>Usos máximos</span><input className="input" name="usageLimit" inputMode="numeric" placeholder="Sin límite" /></label>
          <label className="field" style={{ flex: '1 1 150px' }}><span>Vence</span><input className="input" name="expiresAt" type="date" /></label>
          <button className="btn btn-primary btn-sm" type="submit">Guardar</button>
        </form>
      </section>
      <div className="table-wrap box" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Código</th><th>Descuento</th><th>Mínimo</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.code}</td>
                <td>{c.type === 'percent' ? `${c.value}%` : clp(c.value)}</td>
                <td>{c.minSubtotal ? clp(c.minSubtotal) : '—'}</td>
                <td>{c.used}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                <td>{c.expiresAt ? fecha(c.expiresAt) : '—'}</td>
                <td><span className={`tag ${c.active ? 'tag-green' : ''}`}>{c.active ? 'Activo' : 'Pausado'}</span></td>
                <td>
                  <form action={couponToggleAction} className="row" style={{ gap: 6 }}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="mini-btn" name="op" value="toggle" type="submit">{c.active ? 'Pausar' : 'Activar'}</button>
                    <button className="mini-btn danger" name="op" value="delete" type="submit">Eliminar</button>
                  </form>
                </td>
              </tr>
            ))}
            {!coupons.length ? <tr><td colSpan={7} className="muted">Sin cupones.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
