import Link from 'next/link';
import { registerAction } from '../actions';

export const metadata = { title: 'Crear cuenta' };

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ?? '/cuenta';
  return (
    <div className="container">
      <div className="auth-wrap card">
        <h1 className="display h3" style={{ marginBottom: 6 }}>Crea tu cuenta</h1>
        <p className="muted small" style={{ marginTop: 0 }}>Para seguir tus pedidos. ¿Compras para una empresa? <Link href="/mayoristas">Solicita cuenta mayorista</Link>.</p>
        {sp.error ? <p role="alert" className="alert alert-error small">{sp.error}</p> : null}
        <form action={registerAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input type="hidden" name="next" value={next} />
          <label className="field"><span>Nombre y apellido</span><input className="input" name="name" autoComplete="name" required /></label>
          <label className="field"><span>Correo</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Teléfono (opcional)</span><input className="input" name="phone" type="tel" autoComplete="tel" /></label>
          <label className="field"><span>Contraseña (mínimo 8 caracteres)</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="btn btn-primary btn-block" type="submit">Crear cuenta</button>
        </form>
        <p className="small" style={{ marginBottom: 0 }}>¿Ya tienes cuenta? <Link href={`/cuenta/ingresar?next=${encodeURIComponent(next)}`}>Ingresa</Link></p>
      </div>
    </div>
  );
}
