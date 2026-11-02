import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductBySlug, getRelated } from '@/lib/catalog';
import { getCurrentUser, isApprovedWholesale } from '@/lib/auth';
import { clp } from '@/lib/format';
import { packagesVolume, packagesWeight } from '@/lib/shipping';
import { ProductCard } from '@/components/product-card';
import { Gallery } from '@/components/gallery';
import { BuyBox } from '@/components/buy-box';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: 'Producto no encontrado' };
  const img = data.images[0]?.url;
  return {
    title: data.product.name,
    description: data.product.description.slice(0, 160),
    openGraph: { images: img ? [img] : [] },
  };
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  const { product: p, category, images, variants, light } = data;
  const [related, user] = await Promise.all([getRelated(p.id, p.categoryId), getCurrentUser()]);
  const wholesale = isApprovedWholesale(user);
  const vol = packagesVolume(p.packages);
  const kg = packagesWeight(p.packages);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    sku: p.sku ?? undefined,
    description: p.description,
    image: images.map((i) => `${process.env.SITE_URL ?? ''}${i.url}`),
    brand: { '@type': 'Brand', name: 'Jamaroff' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CLP',
      price: p.price,
      availability: p.mode !== 'pedido' && p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    },
  };

  return (
    <div className="pdp-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Ruta" className="breadcrumb wrap">
        <Link href="/">Inicio</Link><span aria-hidden="true">/</span>
        {category ? <><Link href={`/catalogo/${category.slug}`}>{category.name}</Link><span aria-hidden="true">/</span></> : null}
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="pdp">
        <Gallery images={images.map((i) => ({ url: i.url, thumb: i.thumbUrl ?? i.url, alt: i.alt ?? p.name }))} name={p.name} light={light} />
        <div className="pdp-buy">
          <div>
            <p className="pdp-cat">{category ? <Link href={`/catalogo/${category.slug}`}>{category.name}</Link> : 'Jamaroff'}{p.sku ? <span className="muted">Código {p.sku}</span> : null}</p>
            <h1 className="pdp-title">{p.name}</h1>
            <div className="pdp-price">
              {p.compareAtPrice && p.compareAtPrice > p.price ? <span className="price-old">{clp(p.compareAtPrice)}</span> : null}
              <span className="pdp-amount">{clp(p.price)}</span>
              <span className="muted small">o en cuotas con Webpay</span>
            </div>
            {wholesale && p.wholesalePrice != null ? (
              <p className="alert alert-ok" style={{ margin: '12px 0 0' }}>
                Tu precio mayorista: <strong>{clp(p.wholesalePrice)}</strong>
                {p.wholesaleMinQty > 1 ? ` comprando ${p.wholesaleMinQty} o más unidades` : ''}
              </p>
            ) : null}
          </div>

          <BuyBox
            product={{ id: p.id, name: p.name, mode: p.mode, stock: p.stock, leadTimeDays: p.leadTimeDays, price: p.price }}
            variants={variants.map((v) => ({ id: v.id, name: v.name, hex: v.hex, priceDelta: v.priceDelta, madeToOrderOnly: v.madeToOrderOnly }))}
          />

          {!wholesale ? (
            <p className="alert alert-info" style={{ margin: 0 }}>
              ¿Compras para tu empresa o tienda? <Link href="/mayoristas">Crea tu cuenta mayorista</Link> para ver tu precio por volumen.
            </p>
          ) : null}
        </div>
      </div>

      <section className="pdp-details wrap">
        <div>
          <h2 className="display h3">Sobre esta pieza</h2>
          <p className="prose" style={{ margin: 0 }}>{p.description}</p>
        </div>
        <div>
          <h2 className="display h3">Medidas y materiales</h2>
          <dl className="specs">
            {p.dimensions ? (<><dt>Medidas (ancho × fondo × alto)</dt><dd>{p.dimensions}</dd></>) : null}
            {p.material ? (<><dt>Material</dt><dd>{p.material}</dd></>) : null}
            {p.color ? (<><dt>Color</dt><dd>{p.color}</dd></>) : null}
            {p.specs.map((s, i) => (<Fragment key={i}><dt>{s.label}</dt><dd>{s.value}</dd></Fragment>))}
            {p.packages.length ? (<><dt>Despacho</dt><dd>{p.packages.length} {p.packages.length === 1 ? 'bulto' : 'bultos'} · {vol} m³ · {kg} kg</dd></>) : null}
            {p.mode !== 'stock' && p.leadTimeDays ? (<><dt>Fabricación a pedido</dt><dd>{p.leadTimeDays} días hábiles aprox.</dd></>) : null}
          </dl>
        </div>
      </section>

      {related.length ? (
        <section className="wrap pdp-related">
          <h2 className="display h2">También te puede gustar</h2>
          <div className="product-grid">{related.map((r) => <ProductCard key={r.id} p={r} wholesale={wholesale} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
