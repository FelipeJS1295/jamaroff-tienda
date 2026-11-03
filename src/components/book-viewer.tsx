'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Book, BookPage, BookProduct } from '@/lib/catalog-book';

/** Contraportada automática al final del libro */
type Leaf = BookPage | { id: -1; kind: 'contraportada' };
type Ctx = { book: Book; total: number; whatsapp: string | null; instagram: string | null; ask: (p: BookProduct) => void };

const FLIP_MS = 760;
const Chevron = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === 'prev' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
  </svg>
);

const fabrication = (p: BookProduct) =>
  p.mode === 'stock' ? 'En stock' : p.mode === 'pedido' ? `A pedido${p.leadTimeDays ? ` · ${p.leadTimeDays} días hábiles` : ''}` : `En stock o a pedido${p.leadTimeDays ? ` (${p.leadTimeDays} días)` : ''}`;

/* ─── Páginas ──────────────────────────────────────────────────────── */
function PageView({ leaf, n, ctx }: { leaf: Leaf | null; n: number; ctx: Ctx }) {
  if (!leaf) return <div className="pg pg-blank" aria-hidden="true" />;
  const folio = (
    <footer className="pg-folio" aria-hidden="true">
      <span>Jamaroff · {ctx.book.title}</span>
      <span>{n + 1}</span>
    </footer>
  );

  if (leaf.kind === 'contraportada') {
    return (
      <div className="pg pg-back">
        <p className="pg-back-word">JAMAROFF</p>
        <p className="pg-back-sub">Home Atelier</p>
        <div className="pg-back-links">
          <Link href="/catalogo">Ver la tienda en jamaroff.cl</Link>
          {ctx.whatsapp ? <a href={`${ctx.whatsapp}?text=${encodeURIComponent(`Hola, vi el ${ctx.book.title} y quiero hacer una consulta`)}`} target="_blank" rel="noopener">Escríbenos por WhatsApp</a> : null}
          {ctx.instagram ? <a href={`https://instagram.com/${ctx.instagram.replace('@', '')}`} target="_blank" rel="noopener">Instagram {ctx.instagram}</a> : null}
        </div>
      </div>
    );
  }

  if (leaf.kind === 'portada') {
    const img = leaf.imageUrl ?? ctx.book.pages.find((p) => p.product?.images[0])?.product?.images[0] ?? null;
    return (
      <div className={`pg pg-cover${img ? ' has-img' : ''}`}>
        {img ? <img className="pg-cover-img" src={img} alt="" /> : null}
        <p className="pg-cover-brand">Jamaroff <span>Home Atelier</span></p>
        <div className="pg-cover-text">
          <h1>{leaf.title || ctx.book.title}</h1>
          {leaf.subtitle || ctx.book.subtitle ? <p className="pg-cover-sub">{leaf.subtitle || ctx.book.subtitle}</p> : null}
          {leaf.body ? <p className="pg-cover-body">{leaf.body}</p> : null}
        </div>
      </div>
    );
  }

  if (leaf.kind === 'separador') {
    return (
      <div className={`pg pg-sep${leaf.imageUrl ? ' has-img' : ''}`}>
        {leaf.imageUrl ? <img className="pg-sep-img" src={leaf.imageUrl} alt="" /> : null}
        <div className="pg-sep-text">
          <h2>{leaf.title}</h2>
          {leaf.subtitle ? <p className="pg-sep-sub">{leaf.subtitle}</p> : null}
          {leaf.body ? <p className="pg-sep-body">{leaf.body}</p> : null}
        </div>
        {folio}
      </div>
    );
  }

  if (leaf.kind === 'telas') {
    return (
      <div className="pg pg-fabrics">
        <h2>{leaf.title || 'Telas y colores'}</h2>
        {leaf.body ? <p className="pg-lead">{leaf.body}</p> : null}
        {leaf.swatches.length ? (
          <ul className="pg-swatch-grid">
            {leaf.swatches.map((s) => (
              <li key={s.name}><span className="pg-fabric" style={{ background: s.hex }} /><span>{s.name}</span></li>
            ))}
          </ul>
        ) : <p className="pg-lead">Las telas aparecerán aquí cuando los productos del catálogo tengan colores cargados.</p>}
        {folio}
      </div>
    );
  }

  if (leaf.kind === 'texto') {
    return (
      <div className={`pg pg-text${leaf.imageUrl ? ' has-img' : ''}`}>
        {leaf.imageUrl ? <img className="pg-text-img" src={leaf.imageUrl} alt="" /> : null}
        <div className="pg-text-body">
          {leaf.title ? <h2>{leaf.title}</h2> : null}
          {leaf.subtitle ? <p className="pg-text-sub">{leaf.subtitle}</p> : null}
          {leaf.body ? <p className="pg-prose">{leaf.body}</p> : null}
        </div>
        {folio}
      </div>
    );
  }

  // Producto
  const p = leaf.product!;
  const main = leaf.imageUrl ?? p.images[0] ?? null;
  const extra = p.images.filter((u) => u !== main).slice(0, 2);
  const specs = [
    p.dimensions ? ['Medidas', p.dimensions] : null,
    p.material ? ['Material', p.material] : null,
    ['Fabricación', fabrication(p)],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="pg pg-product">
      <button type="button" className="pg-product-media" onClick={() => ctx.ask(p)} aria-label={`Consultar precio de ${p.name}`}>
        {main ? <img src={main} alt={p.name} /> : null}
        {extra.length ? (
          <span className="pg-product-extra" aria-hidden="true">{extra.map((u) => <img key={u} src={u} alt="" />)}</span>
        ) : null}
      </button>
      <div className="pg-product-text">
        <p className="pg-kicker">{p.category ?? 'Jamaroff'}</p>
        <h2>{leaf.title || p.name}</h2>
        {leaf.subtitle ? <p className="pg-quote">{leaf.subtitle}</p> : null}
        <p className="pg-desc">{leaf.body || p.description}</p>
        <dl className="pg-specs">
          {specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {p.swatches.length ? (
          <div className="pg-swatches" aria-label="Telas y colores">
            {p.swatches.slice(0, 6).map((s) => <span key={s.name} title={s.name}><i style={{ background: s.hex }} />{s.name}</span>)}
            {p.swatches.length > 6 ? <span className="pg-more">+{p.swatches.length - 6}</span> : null}
          </div>
        ) : null}
        <div className="pg-actions">
          <button type="button" className="pg-btn" onClick={() => ctx.ask(p)}>Consultar precio</button>
          <Link href={`/producto/${p.slug}`} className="pg-link">Ver en la tienda</Link>
        </div>
      </div>
      {folio}
    </div>
  );
}

/* ─── Consulta de precio ───────────────────────────────────────────── */
function AskDialog({ product, ctx, onClose }: { product: BookProduct; ctx: Ctx; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ sending: boolean; ok: boolean; error: string | null }>({ sending: false, ok: false, error: null });
  useEffect(() => { dlg.current?.showModal(); }, []);
  const defaultMsg = `Hola, me interesa el ${product.name} del ${ctx.book.title}. ¿Me pueden indicar el precio?${product.swatches.length ? ' Tela o color: ' : ''}`;

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState({ sending: true, ok: false, error: null });
    const r = await fetch('/api/catalogo/consulta', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: product.id, catalog: ctx.book.title, name: f.get('name'), email: f.get('email'), phone: f.get('phone') || undefined, message: f.get('message'), website: f.get('website') || undefined }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setState({ sending: false, ok: true, error: null });
    else setState({ sending: false, ok: false, error: j.error ?? 'No pudimos enviar tu consulta. Intenta de nuevo.' });
  }

  return (
    <dialog ref={dlg} className="ask" onClose={onClose} onClick={(e) => { if (e.target === dlg.current) dlg.current?.close(); }} aria-labelledby="ask-title">
      <div className="ask-card">
        <button type="button" className="ask-close" onClick={() => dlg.current?.close()} aria-label="Cerrar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="ask-head">
          {product.images[0] ? <img src={product.images[0]} alt="" /> : null}
          <div>
            <p className="pg-kicker">Consultar precio</p>
            <h2 id="ask-title">{product.name}</h2>
          </div>
        </div>
        {state.ok ? (
          <div className="ask-done" role="status">
            <p>Recibimos tu consulta. Te respondemos con el precio y las opciones de tela a la brevedad.</p>
            <button type="button" className="pg-btn" onClick={() => dlg.current?.close()}>Seguir viendo el catálogo</button>
          </div>
        ) : (
          <form onSubmit={send} className="ask-form">
            <div className="sr-only" aria-hidden="true"><label>No completar<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <label><span>Nombre</span><input name="name" autoComplete="name" required /></label>
            <label><span>Correo</span><input name="email" type="email" autoComplete="email" required /></label>
            <label><span>Teléfono o WhatsApp (opcional)</span><input name="phone" type="tel" autoComplete="tel" /></label>
            <label><span>Mensaje</span><textarea name="message" rows={4} defaultValue={defaultMsg} required /></label>
            {state.error ? <p className="ask-error" role="alert">{state.error}</p> : null}
            <div className="ask-actions">
              <button type="submit" className="pg-btn" disabled={state.sending}>{state.sending ? 'Enviando…' : 'Enviar consulta'}</button>
              {ctx.whatsapp ? (
                <a className="pg-link" href={`${ctx.whatsapp}?text=${encodeURIComponent(defaultMsg)}`} target="_blank" rel="noopener">O pregúntanos por WhatsApp</a>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

/* ─── Libro ────────────────────────────────────────────────────────── */
export function BookViewer({ book, whatsapp, instagram }: { book: Book; whatsapp: string | null; instagram: string | null }) {
  const leaves: Leaf[] = useMemo(() => [...book.pages, { id: -1, kind: 'contraportada' as const }], [book.pages]);
  const total = leaves.length;
  const [asking, setAsking] = useState<BookProduct | null>(null);
  const ctx: Ctx = { book, total, whatsapp, instagram, ask: setAsking };

  // Escritorio: doble página (portada sola a la derecha). Teléfono: una página.
  const [single, setSingle] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(max-width: 900px)');
    const on = () => setSingle(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const spreads = useMemo(() => {
    if (single) return leaves.map((_, i) => [i] as number[]);
    const out: number[][] = [[-1, 0]];
    for (let i = 1; i < total; i += 2) out.push([i, i + 1 < total ? i + 1 : -1]);
    return out;
  }, [single, leaves, total]);
  const spreadOf = useCallback((page: number) => Math.max(0, spreads.findIndex((s) => s.includes(page))), [spreads]);

  const [page, setPage] = useState(0); // primera página visible (se mantiene al cambiar de vista)
  const [flip, setFlip] = useState<null | { dir: 'next' | 'prev'; from: number; to: number }>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const cur = spreadOf(page);
  const firstOf = (s: number) => spreads[s].find((i) => i >= 0) ?? 0;

  // #pagina-5 en la dirección: se puede compartir una página
  useEffect(() => {
    const m = location.hash.match(/pagina-(\d+)/);
    if (m) setPage(Math.min(total - 1, Math.max(0, Number(m[1]) - 1)));
  }, [total]);
  useEffect(() => {
    history.replaceState(null, '', page ? `#pagina-${page + 1}` : location.pathname + location.search);
  }, [page]);

  const goSpread = useCallback(
    (to: number) => {
      if (flip || to < 0 || to >= spreads.length || to === cur) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (single || reduce || Math.abs(to - cur) > 1) {
        setPage(firstOf(to));
        return;
      }
      setFlip({ dir: to > cur ? 'next' : 'prev', from: cur, to });
      setTimeout(() => { setPage(firstOf(to)); setFlip(null); }, FLIP_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flip, spreads, cur, single],
  );
  const next = () => goSpread(cur + 1);
  const prev = () => goSpread(cur - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (asking || indexOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goSpread(cur + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goSpread(cur - 1);
      if (e.key === 'Home') goSpread(0);
      if (e.key === 'End') goSpread(spreads.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goSpread, cur, spreads.length, asking, indexOpen]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const view = (i: number) => (i >= 0 ? leaves[i] : null);

  // Durante el giro: debajo queda lo que se descubre, encima la hoja que gira
  const base = flip ? (flip.dir === 'next' ? [spreads[flip.from][0], spreads[flip.to][1]] : [spreads[flip.to][0], spreads[flip.from][1]]) : spreads[cur];
  const leafFaces = flip ? (flip.dir === 'next' ? [spreads[flip.from][1], spreads[flip.to][0]] : [spreads[flip.from][0], spreads[flip.to][1]]) : null;
  const visible = spreads[cur].filter((i) => i >= 0);
  const label = visible.length === 2 ? `${visible[0] + 1}–${visible[1] + 1}` : `${(visible[0] ?? 0) + 1}`;
  const titleOf = (l: Leaf) => (l.kind === 'contraportada' ? 'Contraportada' : l.kind === 'producto' ? l.title || l.product?.name : l.title || (l.kind === 'telas' ? 'Telas y colores' : l.kind === 'portada' ? book.title : 'Página'));

  return (
    <div className="libro">
      <header className="libro-bar">
        <Link href="/" className="libro-brand" aria-label="Jamaroff, ir a la tienda">JAMAROFF</Link>
        <p className="libro-title">{book.title}{!book.published ? <span className="libro-draft">Borrador · solo tú lo ves</span> : null}</p>
        <div className="libro-tools">
          <span className="libro-count" aria-live="polite">{label} / {total}</span>
          <button type="button" className="libro-btn" onClick={() => setIndexOpen(true)}>Índice</button>
          <Link href="/" className="libro-btn">Tienda</Link>
        </div>
      </header>

      <main
        className="libro-stage"
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
        }}
      >
        <button type="button" className="libro-arrow is-prev" onClick={prev} disabled={cur === 0} aria-label="Página anterior"><Chevron dir="prev" /></button>

        <div className={`book${single ? ' is-single' : ''}${!single && cur === 0 && !flip ? ' at-cover' : ''}${!single && base[1] === -1 && !flip ? ' at-end' : ''}`} aria-roledescription="libro">
          {single ? (
            <div className="book-page" key={page}><PageView leaf={view(base[0])} n={base[0]} ctx={ctx} /></div>
          ) : (
            <>
              <div className="book-page is-left">{base[0] >= 0 ? <PageView leaf={view(base[0])} n={base[0]} ctx={ctx} /> : null}</div>
              <div className="book-page is-right">{base[1] >= 0 ? <PageView leaf={view(base[1])} n={base[1]} ctx={ctx} /> : null}</div>
              {flip && leafFaces ? (
                <div className={`book-leaf is-${flip.dir}`} style={{ animationDuration: `${FLIP_MS}ms` }} aria-hidden="true">
                  <div className="leaf-face is-front">{leafFaces[0] >= 0 ? <PageView leaf={view(leafFaces[0])} n={leafFaces[0]} ctx={ctx} /> : null}</div>
                  <div className="leaf-face is-back">{leafFaces[1] >= 0 ? <PageView leaf={view(leafFaces[1])} n={leafFaces[1]} ctx={ctx} /> : null}</div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <button type="button" className="libro-arrow is-next" onClick={next} disabled={cur >= spreads.length - 1} aria-label="Página siguiente"><Chevron dir="next" /></button>
      </main>

      <p className="libro-hint">{single ? 'Desliza para pasar las páginas' : 'Usa las flechas o el teclado (← →) para pasar las páginas'}</p>

      {indexOpen ? (
        <dialog className="ask libro-index" ref={(d) => { if (d && !d.open) d.showModal(); }} onClose={() => setIndexOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) (e.currentTarget as HTMLDialogElement).close(); }} aria-label="Índice">
          <div className="ask-card">
            <button type="button" className="ask-close" onClick={(e) => (e.currentTarget.closest('dialog') as HTMLDialogElement).close()} aria-label="Cerrar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <h2>Índice</h2>
            <ol>
              {leaves.map((l, i) => (
                <li key={`${l.id}-${i}`} className={l.kind === 'separador' || l.kind === 'portada' ? 'is-chapter' : ''}>
                  <button type="button" onClick={(e) => { setPage(i); (e.currentTarget.closest('dialog') as HTMLDialogElement).close(); }}>
                    <span>{titleOf(l)}</span><span className="libro-index-n">{i + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </dialog>
      ) : null}

      {asking ? <AskDialog product={asking} ctx={ctx} onClose={() => setAsking(null)} /> : null}
    </div>
  );
}
