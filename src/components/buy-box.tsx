'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from './cart-context';
import { TruckIcon } from './icons';
import { RegionComunaFields } from './region-comuna';

type Variant = { id: number; name: string; hex: string; priceDelta: number; madeToOrderOnly: boolean };
type Prod = { id: number; name: string; mode: 'stock' | 'pedido' | 'ambos'; stock: number; leadTimeDays: number | null; price: number };

const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

export function BuyBox({ product, variants }: { product: Prod; variants: Variant[] }) {
  const { add } = useCart();
  const stockAvailable = (product.mode === 'stock' || product.mode === 'ambos') && product.stock > 0;
  const pedidoAvailable = product.mode === 'pedido' || product.mode === 'ambos';
  const [mode, setMode] = useState<'stock' | 'pedido'>(stockAvailable ? 'stock' : 'pedido');
  const visibleVariants = useMemo(() => variants.filter((v) => mode === 'pedido' || !v.madeToOrderOnly), [variants, mode]);
  const [variantId, setVariantId] = useState<number | null>(visibleVariants[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = visibleVariants.find((v) => v.id === variantId) ?? visibleVariants[0] ?? null;
  const unit = product.price + (variant?.priceDelta ?? 0);
  const maxQty = mode === 'stock' ? product.stock : 999;
  const canBuy = mode === 'stock' ? stockAvailable : pedidoAvailable;

  function pickMode(m: 'stock' | 'pedido') {
    setMode(m);
    setAdded(false);
    const list = variants.filter((v) => m === 'pedido' || !v.madeToOrderOnly);
    if (!list.some((v) => v.id === variantId)) setVariantId(list[0]?.id ?? null);
    if (m === 'stock') setQty((q) => Math.min(q, Math.max(1, product.stock)));
  }

  function onAdd() {
    add({ productId: product.id, variantId: variant?.id ?? null, mode, qty });
    setAdded(true);
  }

  return (
    <>
      {product.mode === 'ambos' || !stockAvailable ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 500, marginBottom: 12 }}>¿Cómo lo quieres?</legend>
          <div className="mode-grid">
            <button type="button" className="mode-btn" aria-pressed={mode === 'stock'} disabled={!stockAvailable} onClick={() => pickMode('stock')}>
              <strong style={{ fontWeight: 500 }}>En stock</strong>
              <span className="small muted">{stockAvailable ? `${product.stock} disponible${product.stock === 1 ? '' : 's'} · despacho pronto` : 'Agotado por ahora'}</span>
            </button>
            <button type="button" className="mode-btn" aria-pressed={mode === 'pedido'} disabled={!pedidoAvailable} onClick={() => pickMode('pedido')}>
              <strong style={{ fontWeight: 500 }}>A pedido</strong>
              <span className="small muted">{pedidoAvailable ? `Fabricación ${product.leadTimeDays ? `en ${product.leadTimeDays} días` : 'a medida'} · elige tu tela` : 'No disponible'}</span>
            </button>
          </div>
        </fieldset>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>{product.stock} disponible{product.stock === 1 ? '' : 's'} en stock · despacho pronto</p>
      )}

      {visibleVariants.length ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 500, marginBottom: 12 }}>
            Tela: <span className="muted" style={{ fontWeight: 400 }}>{variant?.name}{variant && variant.priceDelta ? ` (+${clp(variant.priceDelta)})` : ''}</span>
          </legend>
          <div className="swatches">
            {visibleVariants.map((v) => (
              <button key={v.id} type="button" className="swatch" style={{ background: v.hex }} aria-label={v.name} aria-pressed={v.id === variant?.id} onClick={() => { setVariantId(v.id); setAdded(false); }} />
            ))}
          </div>
          {mode === 'pedido' && pedidoAvailable ? (
            <p className="small muted" style={{ margin: '12px 0 0' }}>¿Buscas otra tela o medida? <Link href={`/a-medida?producto=${product.id}`}>Cotiza a medida</Link></p>
          ) : null}
        </fieldset>
      ) : null}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="qty" role="group" aria-label="Cantidad">
          <button type="button" aria-label="Quitar uno" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" aria-label="Agregar uno" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}>+</button>
        </div>
        <button type="button" className="btn btn-primary" style={{ flex: '1 1 220px' }} disabled={!canBuy} onClick={onAdd}>
          {!canBuy ? 'No disponible' : mode === 'stock' ? `Agregar al carrito · ${clp(unit * qty)}` : `Encargar a pedido · ${clp(unit * qty)}`}
        </button>
      </div>
      {added ? (
        <p role="status" className="alert alert-ok" style={{ margin: 0 }}>
          Agregado al carrito. <Link href="/carrito">Ver carrito y pagar →</Link>
        </p>
      ) : null}

      <ShippingEstimator productId={product.id} qty={qty} />
    </>
  );
}

function ShippingEstimator({ productId, qty }: { productId: number; qty: number }) {
  const [region, setRegion] = useState('Metropolitana');
  const [comuna, setComuna] = useState('');
  const [state, setState] = useState<{ loading: boolean; result: null | { kind: string; cost?: number; eta: string; zone: string | null } ; error?: string }>({ loading: false, result: null });

  async function calc() {
    if (!comuna) { setState({ loading: false, result: null, error: 'Elige tu comuna' }); return; }
    setState({ loading: true, result: null });
    try {
      const r = await fetch('/api/despacho', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ region, comuna, lines: [{ productId, variantId: null, mode: 'stock', qty }], estimate: true }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Error');
      setState({ loading: false, result: j.quote });
    } catch (e) {
      setState({ loading: false, result: null, error: (e as Error).message });
    }
  }

  return (
    <section className="panel" aria-label="Calcular despacho">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}><TruckIcon size={24} /> Calcula tu despacho</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <RegionComunaFields region={region} comuna={comuna} onRegion={(r) => { setRegion(r); setComuna(''); }} onComuna={setComuna} compact />
        <button type="button" className="btn btn-outline btn-sm" style={{ height: 46 }} onClick={calc} disabled={state.loading}>{state.loading ? 'Calculando…' : 'Calcular'}</button>
      </div>
      {state.error ? <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{state.error}</p> : null}
      {state.result ? (
        <div role="status" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="summary-row"><span>Despacho a domicilio</span><strong style={{ fontWeight: 500 }}>{state.result.kind === 'price' ? (state.result.cost === 0 ? 'Gratis' : clp(state.result.cost!)) : 'A cotizar'}</strong></div>
          <div className="summary-row"><span>Plazo</span><span>{state.result.eta}</span></div>
        </div>
      ) : null}
    </section>
  );
}
