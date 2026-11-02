import { adminLoginAction } from '../actions';

export const metadata = { title: 'Ingresar · Admin Jamaroff', robots: { index: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--night)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <img src="/logo.png" alt="Jamaroff Home Atelier" width={110} height={110} style={{ margin: '0 auto 16px' }} />
        <h1 className="display h3" style={{ textAlign: 'center', marginBottom: 20 }}>Administración</h1>
        {error ? <p role="alert" className="alert alert-error small">{error}</p> : null}
        <form action={adminLoginAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="field"><span>Correo</span><input className="input" name="email" type="email" autoComplete="username" required /></label>
          <label className="field"><span>Contraseña</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn btn-dark btn-block" type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  );
}
