import { VisitTracker } from '@/components/visit-tracker';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './shop.css';

export const dynamic = 'force-dynamic';

// .shop aísla el diseño de la tienda: el admin conserva sus estilos de globals.css
export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shop">
      <link rel="preload" href="/fonts/bodoni-moda-latin-standard-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      <a href="#contenido" className="skip">Saltar al contenido</a>
      <SiteHeader />
      <main id="contenido">{children}</main>
      <SiteFooter />
      <VisitTracker />
    </div>
  );
}
