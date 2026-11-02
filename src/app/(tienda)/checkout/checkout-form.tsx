'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/cart-context';
import { usePricedCart } from '@/components/use-priced-cart';
import { RegionComunaFields } from '@/components/region-comuna';

const clp = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

type Quote = { kind: 'price'; cost: number; eta: string; zone: string } | { kind: 'quote'; eta: string; zone: string | null };

export function CheckoutForm({ coupon, pickupEnabled, pickupAddress, testMode }: { coupon: string | null; pickupEnabled: boolean; pickupAddress: string; testMode: boolean }) {
  const { lines } = useCart();
  const { data, loading } = usePricedCart(coupon);
  const [f, setF] = useState({
    name: '', email: '', phone: '', rut: '',
    deliveryMethod: 'despacho' as 'despacho' | 'retiro',
    region: 'Metropolitana', comuna: '', address: '', addressExtra: '', notes: '',
    paymentMethod: 'webpay' as 'webpay' | 'transferencia',
    wantsInvoice: false, invoiceRazonSocial: '', invoiceRut: '', invoiceGiro: '',
    acceptTerms: false,
  });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [webpay, setWebpay] = useState<{ url: string; token: string } | null>(null);
  const wpForm = useRef<HTMLFormElement>(null);
  const prefilled = useRef(false);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  // Precarga datos si el cliente tiene sesión
  useEffect(() => {
    if (prefilled.current || !data?.user) return;
    prefilled.current = true;
    const u = data.user;
    setF((s) => ({
      ...s,
      name: s.name || u.name, email: s.email || u.email, phone: s.phone || (u.phone ?? ''),
      ...(u.wholesale && u.companyName ? { wantsInvoice: true, invoiceRazonSocial: u.companyName, invoiceRut: u.companyRut ?? '', invoiceGiro: u.companyGiro ?? '' } : {}),
    }));
  }, [data?.user]);

  // Cotiza el despacho al elegir comuna
  useEffect(() => {
    if (f.deliveryMethod !== 'despacho' || !f.comuna || !lines.length) { setQuote(null); return; }
    let cancel = false;
    setQuoting(true);
    fetch('/api/despacho', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ region: f.region, comuna: f.comuna, lines }) })
      .then((r) => r.json())
      .then((j) => { if (!cancel) setQuote(j.quote ?? null); })
      .finally(() => { if (!cancel) setQuoting(false); });
    return () => { cancel = true; };
  }, [f.deliveryMethod, f.region, f.comuna, lines]);

  useEffect(() => {
    if (webpay) wpForm.current?.submit();
  }, [webpay]);

  if (loading && !data) return <p className="muted">Cargando…</p>;
  if (!data || !data.lines.length) {
    return (
      <div className="empty">
        <p className="lead">Tu carrito está vacío.</p>
        <Link href="/catalogo" className="btn btn-primary">Ver catálogo</Link>
      </div>
    );
  }

  const shipping = f.deliveryMethod === 'retiro' ? 0 : quote?.kind === 'price' ? quote.cost : 0;
  const total = data.subtotal - data.discount + shipping;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lines, coupon: data?.couponCode, form: f }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No pudimos crear tu pedido');
      if (j.kind === 'webpay') setWebpay({ url: j.url, token: j.token });
      else window.location.href = j.url;
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="cart-layout" noValidate={false}>
        <div className="cart-main" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <section className="card">
            <h2 className="display h3" style={{ marginBottom: 18 }}>Tus datos</h2>
            {!data.user ? <p className="small muted" style={{ marginTop: 0 }}>¿Ya tienes cuenta? <Link href="/cuenta/ingresar?next=/checkout">Ingresa</Link> para ver tus pedidos después.</p> : null}
            <div className="form-grid">
              <label className="field full"><span>Nombre y apellido</span><input className="input" required autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="field"><span>Correo</span><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
              <label className="field"><span>Teléfono</span><input className="input" type="tel" required autoComplete="tel" placeholder="+56 9 1234 5678" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
              <label className="field"><span>RUT (opcional)</span><input className="input" placeholder="12.345.678-9" value={f.rut} onChange={(e) => set('rut', e.target.value)} /></label>
            </div>
          </section>

          <section className="card">
            <h2 className="display h3" style={{ marginBottom: 18 }}>Entrega</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              <label className="radio-card"><input type="radio" name="delivery" checked={f.deliveryMethod === 'despacho'} onChange={() => set('deliveryMethod', 'despacho')} /><span><strong style={{ fontWeight: 500 }}>Despacho a domicilio</strong><br /><span className="small muted">Costo según tu comuna y el volumen de tu pedido</span></span></label>
              {pickupEnabled ? (
                <label className="radio-card"><input type="radio" name="delivery" checked={f.deliveryMethod === 'retiro'} onChange={() => set('deliveryMethod', 'retiro')} /><span><strong style={{ fontWeight: 500 }}>Retiro en showroom · gratis</strong><br /><span className="small muted">{pickupAddress || 'Te avisamos cuando esté listo para retirar'}</span></span></label>
              ) : null}
            </div>
            {f.deliveryMethod === 'despacho' ? (
              <div className="form-grid">
                <RegionComunaFields region={f.region} comuna={f.comuna} onRegion={(r) => setF((s) => ({ ...s, region: r, comuna: '' }))} onComuna={(c) => set('comuna', c)} required />
                <label className="field full"><span>Dirección (calle y número)</span><input className="input" required autoComplete="street-address" value={f.address} onChange={(e) => set('address', e.target.value)} /></label>
                <label className="field full"><span>Depto, casa, oficina (opcional)</span><input className="input" value={f.addressExtra} onChange={(e) => set('addressExtra', e.target.value)} /></label>
                <div className="full">
                  {quoting ? <p className="small muted" style={{ margin: 0 }}>Calculando despacho…</p> : null}
                  {!quoting && quote?.kind === 'price' ? <p className="alert alert-ok small" style={{ margin: 0 }}>Despacho {quote.cost === 0 ? 'gratis' : clp(quote.cost)} · {quote.eta}</p> : null}
                  {!quoting && quote?.kind === 'quote' ? <p className="alert alert-info small" style={{ margin: 0 }}>El despacho a tu comuna se cotiza aparte: te contactamos con el costo antes de enviar. {quote.eta}</p> : null}
                </div>
              </div>
            ) : null}
            <label className="field" style={{ marginTop: 16 }}><span>Notas para la entrega (opcional)</span><textarea className="textarea" style={{ minHeight: 80 }} placeholder="Ej: edificio sin ascensor, horario preferido…" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          </section>

          <section className="card">
            <h2 className="display h3" style={{ marginBottom: 18 }}>Pago</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="radio-card"><input type="radio" name="pay" checked={f.paymentMethod === 'webpay'} onChange={() => set('paymentMethod', 'webpay')} /><span><strong style={{ fontWeight: 500 }}>Webpay</strong><br /><span className="small muted">Tarjeta de crédito (en cuotas), débito o prepago</span></span></label>
              <label className="radio-card"><input type="radio" name="pay" checked={f.paymentMethod === 'transferencia'} onChange={() => set('paymentMethod', 'transferencia')} /><span><strong style={{ fontWeight: 500 }}>Transferencia bancaria</strong><br /><span className="small muted">Te enviamos los datos por correo. Tu pedido se confirma al recibir el pago.</span></span></label>
            </div>
            {testMode && f.paymentMethod === 'webpay' ? <p className="alert alert-info small" style={{ marginBottom: 0 }}>Modo de pruebas de Webpay activo: no se harán cobros reales.</p> : null}
            <label className="check" style={{ marginTop: 20 }}><input type="checkbox" checked={f.wantsInvoice} onChange={(e) => set('wantsInvoice', e.target.checked)} /> Necesito factura</label>
            {f.wantsInvoice ? (
              <div className="form-grid" style={{ marginTop: 14 }}>
                <label className="field full"><span>Razón social</span><input className="input" required value={f.invoiceRazonSocial} onChange={(e) => set('invoiceRazonSocial', e.target.value)} /></label>
                <label className="field"><span>RUT empresa</span><input className="input" required value={f.invoiceRut} onChange={(e) => set('invoiceRut', e.target.value)} /></label>
                <label className="field"><span>Giro</span><input className="input" required value={f.invoiceGiro} onChange={(e) => set('invoiceGiro', e.target.value)} /></label>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="cart-side card" aria-label="Resumen del pedido">
          <h2 className="display h3" style={{ marginBottom: 16 }}>Tu pedido</h2>
          {data.lines.map((l) => (
            <div key={l.key} className="summary-row" style={{ alignItems: 'flex-start' }}>
              <span>{l.qty} × {l.name}<br /><span className="small muted">{l.variantName ? `${l.variantName} · ` : ''}{l.mode === 'stock' ? 'En stock' : 'A pedido'}</span></span>
              <span>{clp(l.lineTotal)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 10 }}>
            <div className="summary-row"><span>Subtotal</span><span>{clp(data.subtotal)}</span></div>
            {data.discount ? <div className="summary-row"><span>Descuento ({data.couponCode})</span><span>-{clp(data.discount)}</span></div> : null}
            <div className="summary-row">
              <span>Despacho</span>
              <span>{f.deliveryMethod === 'retiro' ? 'Gratis' : !f.comuna ? <span className="muted">Elige tu comuna</span> : quote?.kind === 'quote' ? 'A cotizar' : quote ? (quote.cost === 0 ? 'Gratis' : clp(quote.cost)) : '…'}</span>
            </div>
            <div className="summary-row summary-total"><span>Total</span><span>{clp(total)}</span></div>
          </div>
          {data.leadTime ? <p className="small muted">Incluye productos a pedido: fabricación aprox. {data.leadTime} días hábiles.</p> : null}
          <label className="check small" style={{ margin: '16px 0' }}>
            <input type="checkbox" required checked={f.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} />
            <span>Acepto los <Link href="/ayuda/terminos" target="_blank">términos y condiciones</Link></span>
          </label>
          {error ? <p role="alert" className="alert alert-error small">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={sending || data.hasErrors || (f.deliveryMethod === 'despacho' && (!f.comuna || quoting))}>
            {sending ? 'Procesando…' : f.paymentMethod === 'webpay' ? `Pagar ${clp(total)} con Webpay` : 'Confirmar pedido'}
          </button>
          <Link href="/carrito" className="small" style={{ display: 'block', textAlign: 'center', marginTop: 14 }}>Volver al carrito</Link>
        </aside>
      </form>

      {webpay ? (
        <form ref={wpForm} method="post" action={webpay.url}>
          <input type="hidden" name="token_ws" value={webpay.token} />
          <noscript><button type="submit">Ir a Webpay</button></noscript>
        </form>
      ) : null}
    </>
  );
}
