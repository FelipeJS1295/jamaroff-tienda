import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <img src="/logo-mark.png" alt="" width={90} height={70} style={{ margin: '0 auto 24px', background: '#121110', padding: 12 }} />
        <h1 className="display h2" style={{ marginBottom: 12 }}>No encontramos esta página</h1>
        <p className="lead" style={{ margin: '0 0 28px' }}>Puede que el producto ya no esté disponible.</p>
        <Link href="/catalogo" className="btn btn-primary">Ver catálogo</Link>
      </div>
    </div>
  );
}
