'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SearchIcon, UserIcon } from './icons';
import { CartButton } from './cart-button';

type Cat = { name: string; slug: string };

export function HeaderShell({ categories, accountLabel, catalog = null }: { categories: Cat[]; accountLabel: string; catalog?: { slug: string; title: string } | null }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cierra menú y buscador al navegar
  useEffect(() => { setOpen(false); setSearch(false); }, [path]);

  // Sin scroll de fondo con el menú abierto
  useEffect(() => {
    const root = document.documentElement;
    root.style.overflow = open ? 'hidden' : '';
    if (open) root.dataset.menu = '1'; else delete root.dataset.menu;
    return () => { root.style.overflow = ''; delete root.dataset.menu; };
  }, [open]);

  const home = path === '/';
  const isProducts = path.startsWith('/catalogo') || path.startsWith('/producto');
  const current = (on: boolean) => (on ? 'page' : undefined);
  // En la portada el header flota transparente sobre el verde, hasta hacer scroll
  const cls = ['site-header', home ? 'is-home' : '', home && !scrolled && !open && !search ? 'over' : '', scrolled ? 'scrolled' : '', open ? 'menu-open' : ''].filter(Boolean).join(' ');

  return (
    <header className={cls}>
      <div className="header-row">
        <nav className="main-nav" aria-label="Menú principal">
          <ul>
            <li className="nav-item has-sub">
              <Link className="nav-link" href="/catalogo" aria-current={current(isProducts)} aria-haspopup="true">Colección</Link>
              <div className="submenu">
                <ul>
                  {categories.map((c) => <li key={c.slug}><Link href={`/catalogo/${c.slug}`}>{c.name}</Link></li>)}
                </ul>
                <Link href="/catalogo" className="sub-all">Ver toda la colección</Link>
              </div>
            </li>
            {catalog ? <li className="nav-item"><Link className="nav-link" href={`/${catalog.slug}`}>{catalog.title}</Link></li> : null}
            <li className="nav-item"><Link className="nav-link" href="/a-medida" aria-current={current(path.startsWith('/a-medida'))}>A medida</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/mayoristas" aria-current={current(path.startsWith('/mayoristas'))}>Mayoristas</Link></li>
            <li className="nav-item"><Link className="nav-link" href="/contacto" aria-current={current(path.startsWith('/contacto'))}>Contacto</Link></li>
          </ul>
        </nav>

        <Link href="/" className="brand" aria-label="Jamaroff Home Atelier, inicio">
          <span className="brand-name">Jamaroff</span>
          <span className="brand-sub">Home Atelier</span>
        </Link>

        <div className="header-tools">
          <button type="button" className="icon-btn" aria-expanded={search} aria-controls="buscador" aria-label={search ? 'Cerrar buscador' : 'Buscar productos'} onClick={() => setSearch((s) => !s)}>
            <SearchIcon size={20} />
          </button>
          <Link href="/cuenta" className="icon-btn hide-sm" aria-label={accountLabel}><UserIcon size={21} /></Link>
          <CartButton />
          <button type="button" className="icon-btn menu-toggle" aria-expanded={open} aria-controls="menu-movil" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((o) => !o)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 9h18M3 15h18" />}
            </svg>
          </button>
        </div>
      </div>

      {search ? (
        <form id="buscador" action="/catalogo" role="search" className="search-bar">
          <label htmlFor="q" className="sr-only">Buscar productos</label>
          <input id="q" name="q" type="search" placeholder="Buscar sofás, seccionales, cuero…" autoFocus />
          <button type="submit" className="btn btn-primary btn-sm">Buscar</button>
        </form>
      ) : null}

      <nav id="menu-movil" className="mobile-panel" aria-label="Menú" hidden={!open} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <ul className="m-main">
          <li><Link href="/catalogo">Colección</Link></li>
          {categories.map((c) => <li key={c.slug} className="m-sub"><Link href={`/catalogo/${c.slug}`}>{c.name}</Link></li>)}
          {catalog ? <li><Link href={`/${catalog.slug}`}>{catalog.title}</Link></li> : null}
          <li><Link href="/a-medida">A medida</Link></li>
          <li><Link href="/mayoristas">Mayoristas</Link></li>
          <li><Link href="/contacto">Contacto</Link></li>
        </ul>
        <Link href="/cuenta" className="m-account">{accountLabel}</Link>
      </nav>
    </header>
  );
}
