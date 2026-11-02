import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getSettings } from '@/lib/settings';
import { isWebpayTestMode } from '@/lib/webpay';
import { saveSettingsAction } from '../../actions';
import { Flash } from '@/components/admin-flash';

export const metadata = { title: 'Ajustes' };

export default async function AjustesAdmin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const [sp, s, products] = await Promise.all([
    searchParams, getSettings(),
    db.select({ slug: schema.products.slug, name: schema.products.name }).from(schema.products).orderBy(asc(schema.products.name)),
  ]);
  const smtp = !!process.env.SMTP_HOST && !!process.env.SMTP_USER;
  return (
    <>
      <div className="admin-head"><h1>Ajustes</h1></div>
      <Flash ok={sp.ok} />
      <form action={saveSettingsAction} className="grid-2">
        <section className="box stack">
          <h2 style={{ margin: 0 }}>Contacto (aparece en el pie de página)</h2>
          <label className="field"><span>WhatsApp (con código de país)</span><input className="input" name="whatsapp" defaultValue={s.whatsapp} placeholder="+56 9 1234 5678" /></label>
          <label className="field"><span>Correo de contacto</span><input className="input" name="contactEmail" type="email" defaultValue={s.contactEmail} /></label>
          <label className="field"><span>Dirección del showroom</span><input className="input" name="showroomAddress" defaultValue={s.showroomAddress} /></label>
          <label className="field"><span>Horario</span><input className="input" name="showroomHours" defaultValue={s.showroomHours} placeholder="Lunes a viernes 10:00 a 19:00" /></label>
          <label className="field"><span>Instagram</span><input className="input" name="instagram" defaultValue={s.instagram} placeholder="@jamaroff" /></label>
          <label className="check"><input type="checkbox" name="pickupEnabled" defaultChecked={s.pickupEnabled === '1'} /> Permitir retiro en showroom (gratis)</label>
        </section>
        <section className="box stack">
          <h2 style={{ margin: 0 }}>Tienda</h2>
          <label className="field"><span>Foto principal de la portada</span>
            <select className="select" name="heroProduct" defaultValue={s.heroProduct}>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
          </label>
          <label className="field"><span>Foto de la sección “Hecho a tu medida”</span>
            <select className="select" name="atelierProduct" defaultValue={s.atelierProduct}>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
          </label>
          <label className="field"><span>Datos para transferencia (se envían al cliente)</span><textarea className="textarea" name="bankTransferInfo" defaultValue={s.bankTransferInfo} style={{ minHeight: 150 }} /></label>
          <button className="btn btn-primary" type="submit">Guardar ajustes</button>
        </section>
      </form>
      <section className="box small" style={{ marginTop: 20 }}>
        <h2>Estado de la configuración del servidor</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Webpay: {isWebpayTestMode() ? <strong>modo de pruebas (sin cobros reales)</strong> : 'producción'}. Se cambia en el archivo .env del servidor.</li>
          <li>Correo: {smtp ? 'configurado' : <strong>no configurado (los correos no se están enviando)</strong>}</li>
          <li>Avisos de pedidos a: {process.env.ADMIN_NOTIFY_EMAIL || <strong>sin configurar</strong>}</li>
        </ul>
      </section>
    </>
  );
}
