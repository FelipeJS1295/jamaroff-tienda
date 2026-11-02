import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { wholesaleApplyAction } from '../cuenta/actions';

export const metadata = { title: 'Venta mayorista', description: 'Precios mayoristas para tiendas, hoteles, oficinas y proyectos. Cotizaciones por volumen y factura.' };

export default async function MayoristasPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  return (
    <>
      <section className="band-dark">
        <div className="container section split" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div>
            <span className="eyebrow">Venta mayorista</span>
            <h1 className="display h1" style={{ margin: '12px 0 16px', fontSize: 'clamp(40px,5vw,64px)' }}>Muebles para tu tienda, hotel u oficina.</h1>
            <p className="lead" style={{ margin: 0 }}>Con tu cuenta de empresa ves precios mayoristas en todo el catálogo, compras por volumen y pagas con factura o transferencia.</p>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 17 }}>
            <li>✓ Precio mayorista visible al ingresar</li>
            <li>✓ Cantidades mínimas por producto</li>
            <li>✓ Factura electrónica con los datos de tu empresa</li>
            <li>✓ Despacho coordinado a todo Chile</li>
            <li>✓ Fabricación a pedido para proyectos</li>
          </ul>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 820 }}>
        {user?.wholesaleStatus === 'approved' ? (
          <div className="card"><p style={{ margin: 0 }}>Tu cuenta mayorista ya está activa. <Link href="/catalogo">Ver catálogo con tus precios →</Link></p></div>
        ) : user?.wholesaleStatus === 'pending' ? (
          <div className="card"><p style={{ margin: 0 }}>Tu solicitud está en revisión. Te avisaremos por correo.</p></div>
        ) : (
          <div className="card">
            <h2 className="display h3" style={{ marginBottom: 6 }}>Solicita tu cuenta mayorista</h2>
            <p className="muted small" style={{ marginTop: 0 }}>Revisamos cada solicitud y te respondemos por correo.{!user ? <> ¿Ya tienes cuenta? <Link href="/cuenta/ingresar?next=/mayoristas">Ingresa primero</Link>.</> : null}</p>
            {sp.error ? <p role="alert" className="alert alert-error small">{sp.error}</p> : null}
            <form action={wholesaleApplyAction} className="form-grid">
              {!user ? (
                <>
                  <label className="field"><span>Nombre de contacto</span><input className="input" name="name" autoComplete="name" required /></label>
                  <label className="field"><span>Correo</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
                  <label className="field full"><span>Contraseña para tu cuenta (mínimo 8 caracteres)</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
                </>
              ) : null}
              <label className="field full"><span>Razón social</span><input className="input" name="companyName" defaultValue={user?.companyName ?? ''} required /></label>
              <label className="field"><span>RUT empresa</span><input className="input" name="companyRut" placeholder="76.123.456-7" defaultValue={user?.companyRut ?? ''} required /></label>
              <label className="field"><span>Giro</span><input className="input" name="companyGiro" defaultValue={user?.companyGiro ?? ''} required /></label>
              <label className="field full"><span>Teléfono</span><input className="input" name="phone" type="tel" defaultValue={user?.phone ?? ''} required /></label>
              <label className="field full"><span>Cuéntanos de tu negocio (opcional)</span><textarea className="textarea" name="message" placeholder="Tipo de negocio, productos que te interesan, volumen estimado…" /></label>
              <div className="full"><button className="btn btn-yellow" type="submit">Enviar solicitud</button></div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
