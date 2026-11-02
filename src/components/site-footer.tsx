import Link from 'next/link';
import { getMenuCategories } from '@/lib/catalog';
import { getSettings, whatsappLink } from '@/lib/settings';
import { ChatIcon } from './icons';

export async function SiteFooter() {
  const [cats, s] = await Promise.all([getMenuCategories(), getSettings()]);
  const wa = whatsappLink(s.whatsapp, 'Hola Jamaroff, tengo una consulta');
  return (
    <>
      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-intro">
            <p className="footer-claim">Muebles con oficio, hechos para quedarse.</p>
            {wa ? <a href={wa} target="_blank" rel="noopener" className="btn btn-ghost-light btn-sm">Escríbenos por WhatsApp</a> : <Link href="/contacto" className="btn btn-ghost-light btn-sm">Escríbenos</Link>}
          </div>
          <div className="footer-col">
            <h2>Colección</h2>
            {cats.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/catalogo/${c.slug}`}>{c.name}</Link>
            ))}
            <Link href="/a-medida">Hecho a medida</Link>
            <Link href="/mayoristas">Mayoristas</Link>
          </div>
          <div className="footer-col">
            <h2>Ayuda</h2>
            <Link href="/ayuda/despachos">Despachos y plazos</Link>
            <Link href="/ayuda/cambios-y-devoluciones">Cambios y devoluciones</Link>
            <Link href="/cuenta">Seguimiento de pedido</Link>
            <Link href="/ayuda/preguntas-frecuentes">Preguntas frecuentes</Link>
            <Link href="/ayuda/terminos">Términos y condiciones</Link>
          </div>
          <div className="footer-col">
            <h2>Showroom</h2>
            {s.showroomAddress ? <span>{s.showroomAddress}</span> : null}
            {s.showroomHours ? <span>{s.showroomHours}</span> : null}
            {s.contactEmail ? <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> : null}
            {wa ? <a href={wa} target="_blank" rel="noopener">WhatsApp {s.whatsapp}</a> : null}
            {s.instagram ? <a href={`https://instagram.com/${s.instagram.replace('@', '')}`} target="_blank" rel="noopener">Instagram {s.instagram}</a> : null}
            <Link href="/contacto">Formulario de contacto</Link>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© {new Date().getFullYear()} Jamaroff Home Atelier</span>
          <span>Pagos con Webpay o transferencia bancaria</span>
        </div>
        <p className="footer-word" aria-hidden="true">JAMAROFF</p>
      </footer>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener" className="wa-float" aria-label="Escríbenos por WhatsApp">
          <ChatIcon size={22} />
        </a>
      ) : null}
    </>
  );
}
