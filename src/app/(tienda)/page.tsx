import Link from 'next/link';
import { getCategoryTiles, getFeatured } from '@/lib/catalog';
import { getCurrentUser, isApprovedWholesale } from '@/lib/auth';
import { ProductCard } from '@/components/product-card';
import { getSettings } from '@/lib/settings';
import { HeroWord } from '@/components/hero-word';

const full = (url: string | null | undefined) => (url ? url.replace('-t.webp', '.webp') : '');

export default async function HomePage() {
  const [featured, tiles, user, settings] = await Promise.all([getFeatured(12), getCategoryTiles(8), getCurrentUser(), getSettings()]);
  // Foto de "A medida": se elige en Admin › Ajustes (por el "slug" del producto). La portada usa public/portada.webp
  const madeToOrder = featured.find((p) => p.slug === settings.atelierProduct) ?? featured.find((p) => p.mode === 'pedido') ?? featured[0];
  const wholesale = isApprovedWholesale(user);
  const pieces = featured.filter((p) => p.image).slice(0, 7);

  return (
    <>
      {/* El sofá queda detrás del nombre; al hacer scroll el nombre sube y se vuelve el logo del header */}
      <section className="hero" aria-labelledby="hero-title">
        <HeroWord />
        <img className="hero-sofa" src="/portada.webp" alt="Sofá de tres cuerpos tapizado en terciopelo azul" width={1734} height={856} fetchPriority="high" />
        <div className="hero-foot">
          <div className="hero-copy">
            <h1 id="hero-title">Sofás de atelier, en stock o hechos a tu medida.</h1>
            <div className="hero-actions">
              <Link href="/catalogo" className="btn btn-light">Ver la colección</Link>
              <Link href="/a-medida" className="btn btn-ghost-light">Cotizar a medida</Link>
            </div>
          </div>
          <p className="hero-note">Tapizados en tela, lino, cuero o terciopelo, en el color que elijas.</p>
        </div>
      </section>

      <section className="promises" aria-label="Cómo compras en Jamaroff">
        <dl className="wrap">
          <div><dt>Despacho a todo Chile</dt><dd>Costo según tu comuna, antes de pagar</dd></div>
          <div><dt>En stock o a pedido</dt><dd>Tú eliges tela, color y medidas</dd></div>
          <div><dt>Webpay en cuotas</dt><dd>O transferencia bancaria</dd></div>
          <div><dt>Venta a empresas</dt><dd>Precios por volumen y factura</dd></div>
        </dl>
      </section>

      {tiles.length ? (
        <section className="index" aria-labelledby="idx-title">
          <div className="wrap">
          <h2 id="idx-title" className="kicker">La colección</h2>
          <ul className="index-list">
            {tiles.map((t) => (
              <li key={t.id}>
                <Link href={`/catalogo/${t.slug}`} className="index-row">
                  <span className="index-name">{t.name}</span>
                  <span className="index-count">{t.count} {t.count === 1 ? 'modelo' : 'modelos'}</span>
                  {t.imageUrl || t.fallback ? <img className="index-peek" src={full(t.imageUrl ?? t.fallback)} alt="" loading="lazy" /> : null}
                </Link>
              </li>
            ))}
          </ul>
          </div>
        </section>
      ) : null}

      {pieces.length ? (
        <section className="wrap pieces" aria-labelledby="new-title">
          <div className="section-head">
            <h2 id="new-title" className="display h2">Recién salidos del taller</h2>
            <Link href="/catalogo?orden=nuevos" className="text-link">Ver novedades</Link>
          </div>
          <div className="gallery-grid">
            {pieces.map((p) => <ProductCard key={p.id} p={p} wholesale={wholesale} large />)}
          </div>
        </section>
      ) : null}

      <section className="atelier" id="a-medida" aria-labelledby="atelier-title">
        <div className="wrap atelier-grid">
          {madeToOrder?.image ? <img className="atelier-img" src={full(madeToOrder.image)} alt={`${madeToOrder.name}, fabricado a pedido`} loading="lazy" /> : null}
          <div className="atelier-text">
            <h2 id="atelier-title" className="display h2">Tu sofá, en tu tela, a tu medida.</h2>
            <p className="lead">Parte de cualquier modelo de la colección. Ajustamos medidas, tela y color, lo fabricamos en nuestro taller y te avisamos en cada etapa hasta que llega a tu casa.</p>
            <ol className="swatch-steps">
              <li><span className="sw sw-1" aria-hidden="true" /><strong>Elige el modelo</strong><span>Cualquier diseño del catálogo.</span></li>
              <li><span className="sw sw-2" aria-hidden="true" /><strong>Ajusta tela y medidas</strong><span>Te enviamos muestras si las necesitas.</span></li>
              <li><span className="sw sw-3" aria-hidden="true" /><strong>Lo fabricamos y despachamos</strong><span>Sigues el pedido desde tu cuenta.</span></li>
            </ol>
            <Link href="/a-medida" className="btn btn-light">Solicitar cotización</Link>
          </div>
        </div>
      </section>

      <section className="trade wrap" id="mayoristas" aria-labelledby="trade-title">
        <h2 id="trade-title" className="display h2">¿Amoblas una tienda, un hotel o una oficina?</h2>
        <div>
          <p className="lead">Con tu cuenta de empresa ves precios mayoristas en todo el catálogo, pides cotizaciones por volumen y pagas con factura.</p>
          <div className="hero-actions">
            <Link href="/mayoristas" className="btn btn-primary">Crear cuenta mayorista</Link>
            <Link href="/cuenta/ingresar" className="btn btn-outline">Ya tengo cuenta</Link>
          </div>
        </div>
      </section>
    </>
  );
}
