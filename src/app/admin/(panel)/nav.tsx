'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/pedidos', label: 'Pedidos', badge: 'pedidos' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/mayoristas', label: 'Mayoristas', badge: 'mayoristas' },
  { href: '/admin/solicitudes', label: 'Cotizaciones y mensajes', badge: 'solicitudes' },
  { href: '/admin/despachos', label: 'Despachos y tarifas' },
  { href: '/admin/cupones', label: 'Cupones' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/ajustes', label: 'Ajustes' },
] as const;

export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Administración">
      {ITEMS.map((i) => {
        const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
        const n = 'badge' in i ? badges[i.badge] : 0;
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            <span>{i.label}</span>
            {n ? <span className="admin-badge">{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
