import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loginAction } from '../actions';

export const metadata = { title: 'Ingresar' };

export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ?? '/cuenta';
  if (await getCurrentUser()) redirect(next.startsWith('/') ? next : '/cuenta');
  return (
    <div className="container">
      <div className="auth-wrap card">
        <h1 className="display h3" style={{ marginBottom: 6 }}>Ingresa a tu cuenta</h1>
        <p className="muted small" style={{ marginTop: 0 }}>Revisa tus pedidos y, si eres mayorista, tus precios especiales.</p>
        {sp.error ? <p role="alert" className="alert alert-error small">{sp.error}</p> : null}
        <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="next" value={next} />
          <label className="field"><span>Correo</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Contraseña</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn btn-primary btn-block" type="submit">Ingresar</button>
        </form>
        <p className="small" style={{ marginBottom: 0 }}>¿No tienes cuenta? <Link href={`/cuenta/registro?next=${encodeURIComponent(next)}`}>Créala aquí</Link></p>
        <p className="small muted" style={{ marginBottom: 0 }}>¿Olvidaste tu contraseña? Escríbenos y te ayudamos a recuperarla.</p>
      </div>
    </div>
  );
}
