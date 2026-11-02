'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/cart-context';
import { usePricedCart } from '@/components/use-priced-cart';
import { TrashIcon } from '@/components/icons';

const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

export function CartView() {
  const { setQty, remove } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const { data, loading } = usePricedCart(coupon);

  if (loading && !data) return <p className="muted">Cargando tu carrito…</p>;
  if (!data || data.lines.length === 0) {
    return (
      <div className="empty">
        <p className="lead">Tu carrito está vacío.</p>
        <Link href="/catalogo" className="btn btn-primary">Ver catálogo</Link>
      </div>
    );
  }

  const total = data.subtotal - data.discount;
  const checkoutHref = data.couponCode ? `/checkout?cupon=${encodeURIComponent(data.couponCode)}` : '/checkout';

  return (
    <div className="cart-layout">
      <section className="cart-main" aria-label="Productos en tu carrito">
        {data.lines.map((l) => (
          <div key={l.key} className="cart-line">
            <Link href={`/producto/${l.slug}`}>{l.imageUrl ? <img src={l.imageUrl} alt="" /> : <div style={{ width: 110, height: 130, background: '#EFE8DC' }} />}</Link>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Link href={`/producto/${l.slug}`} style={{ fontWeight: 500, textDecoration: 'none', fontSize: 17 }}>{l.name}</Link>
              <span className="small muted">
                {l.variantName ? `${l.variantName} · ` : ''}{l.mode === 'stock' ? 'En stock' : `A pedido${l.leadTimeDays ? ` · fabricación ${l.leadTimeDays} días` : ''}`}
              </span>
              {l.wholesaleApplied ? <span className="small price-wholesale">Precio mayorista aplicado</span> : null}
              {!l.wholesaleApplied && l.wholesaleMinQty ? <span className="small muted">Precio mayorista desde {l.wholesaleMinQty} unidades</span> : null}
              {l.error ? <span className="small" style={{ color: 'var(--danger)' }}>{l.error}</span> : null}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <div className="qty" role="group" aria-label={`Cantidad de ${l.name}`} style={{ height: 44 }}>
                  <button type="button" aria-label="Quitar uno" style={{ height: 42 }} onClick={() => setQty(l.key, l.qty - 1)} disabled={l.qty <= 1}>−</button>
                  <span>{l.qty}</span>
                  <button type="button" aria-label="Agregar uno" style={{ height: 42 }} onClick={() => setQty(l.key, l.qty + 1)} disabled={l.maxQty != null && l.qty >= l.maxQty}>+</button>
                </div>
                <button type="button" className="icon-btn" aria-label={`Quitar ${l.name} del carrito`} onClick={() => remove(l.key)}><TrashIcon /></button>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 500 }}>
              {l.wholesaleApplied ? <div className="price-old small">{clp(l.retailUnitPrice * l.qty)}</div> : null}
              {clp(l.lineTotal)}
            </div>
          </div>
        ))}
      </section>

      <aside className="cart-side card" aria-label="Resumen">
        <h2 className="display h3" style={{ marginBottom: 16 }}>Resumen</h2>
        <div className="summary-row"><span>Subtotal</span><span>{clp(data.subtotal)}</span></div>
        {data.discount ? <div className="summary-row"><span>Descuento ({data.couponCode})</span><span>-{clp(data.discount)}</span></div> : null}
        <div className="summary-row"><span>Despacho</span><span className="muted">Se calcula al pagar</span></div>
        <div className="summary-row summary-total"><span>Total</span><span>{clp(total)}</span></div>

        <form
          style={{ display: 'flex', gap: 8, margin: '20px 0 8px' }}
          onSubmit={(e) => { e.preventDefault(); setCoupon(couponInput.trim() || null); }}
        >
          <label htmlFor="cupon" className="sr-only">Cupón de descuento</label>
          <input id="cupon" className="input" placeholder="Cupón de descuento" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
          <button className="btn btn-outline btn-sm" style={{ height: 46 }} type="submit">Aplicar</button>
        </form>
        {coupon && data.couponError ? <p className="small" style={{ color: 'var(--danger)', margin: '0 0 8px' }}>{data.couponError}</p> : null}

        {data.leadTime ? <p className="small muted">Incluye productos a pedido: fabricación aprox. {data.leadTime} días hábiles antes del despacho.</p> : null}
        {data.hasErrors ? <p className="alert alert-error small">Revisa los productos marcados antes de continuar.</p> : null}
        <Link href={checkoutHref} className="btn btn-primary btn-block" aria-disabled={data.hasErrors} style={data.hasErrors ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>
          Continuar al pago
        </Link>
        <Link href="/catalogo" className="small" style={{ display: 'block', textAlign: 'center', marginTop: 14 }}>Seguir comprando</Link>
      </aside>
    </div>
  );
}
