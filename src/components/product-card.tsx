import Link from 'next/link';
import type { ProductCardData } from '@/lib/catalog';
import { clp } from '@/lib/format';

export function ProductCard({ p, wholesale = false, large = false }: { p: ProductCardData; wholesale?: boolean; large?: boolean }) {
  const inStock = (p.mode === 'stock' || p.mode === 'ambos') && p.stock > 0;
  const availability = inStock ? 'En stock' : p.mode === 'stock' ? 'Agotado' : 'A pedido';
  const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
  const showWholesale = wholesale && p.wholesalePrice != null;
  // En la galería de la portada se usa la foto grande; en el catálogo, la miniatura
  const src = large && p.image ? p.image.replace('-t.webp', '.webp') : p.image;
  return (
    <article className="pcard">
      <Link href={`/producto/${p.slug}`} className="pcard-img" tabIndex={-1} aria-hidden="true">
        {src ? <img src={src} alt="" loading="lazy" /> : <span className="pcard-blank" />}
        {onSale ? <span className="badge badge-sale">Oferta</span> : null}
      </Link>
      <div className="pcard-body">
        <Link href={`/producto/${p.slug}`} className="pcard-name">{p.name}</Link>
        <span className="price">
          {onSale ? <span className="price-old">{clp(p.compareAtPrice!)}</span> : null}
          {clp(p.price)}
        </span>
      </div>
      <div className="pcard-meta">
        <span className={`avail ${inStock ? 'avail-stock' : p.mode === 'stock' ? 'avail-out' : 'avail-order'}`}>{availability}</span>
        <span className="muted">{p.material || p.categoryName}</span>
      </div>
      {showWholesale ? (
        <div className="small price-wholesale">
          Mayorista {clp(p.wholesalePrice!)}{p.wholesaleMinQty > 1 ? ` desde ${p.wholesaleMinQty} un.` : ''}
        </div>
      ) : null}
    </article>
  );
}
