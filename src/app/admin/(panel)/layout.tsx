import Link from 'next/link';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireAdmin } from '@/lib/auth';
import { adminLogoutAction } from '../actions';
import { AdminNav } from './nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: { default: 'Admin', template: '%s · Admin Jamaroff' }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const [[{ pend }], [{ ws }], [{ qr }]] = await Promise.all([
    db.select({ pend: sql<number>`count(*)::int` }).from(schema.orders).where(inArray(schema.orders.status, ['pagado', 'en_fabricacion', 'listo_despacho'])),
    db.select({ ws: sql<number>`count(*)::int` }).from(schema.users).where(eq(schema.users.wholesaleStatus, 'pending')),
    db.select({ qr: sql<number>`count(*)::int` }).from(schema.quoteRequests).where(and(eq(schema.quoteRequests.status, 'nueva'), sql`${schema.quoteRequests.kind} <> 'mayorista'`)),
  ]);
  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px', color: '#F7F2EA' }}>
          <img src="/logo-mark.png" alt="" width={46} height={36} />
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '0.1em' }}>JAMAROFF</span>
            <span style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--sand)', marginTop: 3 }}>ADMINISTRACIÓN</span>
          </span>
        </Link>
        <AdminNav badges={{ pedidos: pend, mayoristas: ws, solicitudes: qr }} />
        <div style={{ marginTop: 'auto', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px' }}>
          <Link href="/" target="_blank">Ver tienda ↗</Link>
          <span style={{ color: '#A39B8F' }}>{me.email}</span>
          <form action={adminLogoutAction}><button type="submit" className="link-btn" style={{ color: '#D6CEC2' }}>Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="admin-main" id="contenido">{children}</main>
    </div>
  );
}
