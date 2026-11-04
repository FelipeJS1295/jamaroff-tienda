'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Book, BookPage, BookProduct, BookSwatch, BookVariant } from '@/lib/catalog-book';

/** Contraportada automática al final del libro */
type Leaf = BookPage | { id: -1; kind: 'contraportada' };
type Ctx = { book: Book; total: number; whatsapp: string | null; instagram: string | null; ask: (p: BookVariant) => void; show: (g: Gallery) => void };
/** La galería parte en el producto de la página; "cover" es la foto propia que se le puso a esa página */
type Gallery = { product: BookProduct; title: string; cover: string | null };

const FLIP_MS = 760;
const Chevron = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === 'prev' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
  </svg>
);

/** Círculo de tela: la foto si la tiene, si no el color */
const swatchStyle = (s: BookSwatch): React.CSSProperties => ({ backgroundColor: s.hex, ...(s.image ? { backgroundImage: `url(${s.image})` } : {}) });

const fabrication = (p: BookVariant) =>
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
              <li key={`${s.fabric}|${s.name}`}><span className="pg-fabric" style={swatchStyle(s)} /><span>{s.name}{s.fabric ? <small>{s.fabric}</small> : null}</span></li>
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
  const photos = [...new Set([main, ...p.images].filter(Boolean) as string[])];
  const specs = [
    p.dimensions ? ['Medidas', p.dimensions] : null,
    p.material ? ['Material', p.material] : null,
    ['Fabricación', fabrication(p)],
  ].filter(Boolean) as [string, string][];
  return (
    <div className="pg pg-product">
      <button type="button" className="pg-product-media" onClick={() => ctx.show({ product: p, title: leaf.title || p.name, cover: leaf.imageUrl })} aria-label={`Ver las fotos, colores y telas de ${p.name}`}>
        {main ? <img src={main} alt={p.name} /> : null}
        {photos.length > 1 || p.variants.length || p.swatches.some((x) => x.image) ? (
          <span className="pg-product-count" aria-hidden="true">
            {[photos.length > 1 ? `${photos.length} fotos` : '', p.variants.length ? `${p.variants.length} colores` : '', p.swatches.length ? `${p.swatches.length} ${p.swatches.length === 1 ? 'tela' : 'telas'}` : ''].filter(Boolean).join(' · ')}
          </span>
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
            {p.swatches.slice(0, 6).map((s) => <span key={`${s.fabric}|${s.name}`} title={s.fabric ? `${s.fabric} · ${s.name}` : s.name}><i style={swatchStyle(s)} />{s.name}</span>)}
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
function AskDialog({ product, ctx, onClose }: { product: BookVariant; ctx: Ctx; onClose: () => void }) {
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

/* ─── Galería del producto: fotos, colores y muestrario ───────────── */
function GalleryDialog({ g, onClose, onAsk }: { g: Gallery; onClose: () => void; onAsk: (p: BookVariant) => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  // Producto que se está viendo: el de la página o una de sus variantes de color
  const [cur, setCur] = useState<BookVariant>(g.product);
  const [i, setI] = useState(0);
  // Si las telas del producto apuntan a variantes, el muestrario es el que cambia de color
  const byId = useMemo(() => new Map([g.product, ...g.product.variants].map((v) => [v.id, v] as const)), [g.product]);
  const nav = g.product.swatches.some((w) => w.productId != null && byId.has(w.productId));
  const [fabric, setFabric] = useState<number | null>(() => {
    const k = g.product.swatches.findIndex((w) => w.productId === g.product.id);
    return k >= 0 ? k : null;
  });
  const isPage = cur.id === g.product.id;
  const images = useMemo(() => [...new Set([isPage ? g.cover : null, ...cur.images].filter(Boolean) as string[])], [cur, isPage, g.cover]);
  const n = images.length;
  const go = useCallback((d: number) => n && setI((x) => (x + d + n) % n), [n]);
  useEffect(() => { dlg.current?.showModal(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('.lb-side')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
  // Precarga la siguiente para que el cambio sea inmediato
  useEffect(() => { if (n > 1) new Image().src = images[(i + 1) % n]; }, [i, n, images]);
  const touch = useRef<number | null>(null);
  const pick = (v: BookVariant) => { setCur(v); setI(0); setFabric(null); };
  const name = isPage ? g.title : cur.name;
  const swatches = nav ? g.product.swatches : cur.swatches;
  // Con muestrario que navega, la fila de colores sobra
  const variants = nav ? [] : g.product.variants;
  const picked = fabric != null ? swatches[fabric] : null;
  const tapSwatch = (k: number) => {
    const target = nav && swatches[k].productId != null ? byId.get(swatches[k].productId!) : undefined;
    if (target) {
      if (target.id !== cur.id) { setCur(target); setI(0); }
      setFabric(k);
    } else setFabric(k === fabric ? null : k);
  };

  return (
    <dialog
      ref={dlg}
      className="lb"
      aria-label={`Fotos de ${name}`}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('lb-stage')) dlg.current?.close(); }}
    >
      <div className="lb-bar">
        <p className="lb-name">{name}{n > 1 ? <span>{i + 1} / {n}</span> : null}</p>
        <button type="button" className="lb-close" onClick={() => dlg.current?.close()} aria-label="Cerrar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div className="lb-main">
        <div
          className="lb-stage"
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const x = touch.current;
            touch.current = null;
            if (x === null) return;
            const dx = e.changedTouches[0].clientX - x;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          {n ? <img key={images[i]} src={images[i]} alt={`${name}, foto ${i + 1} de ${n}`} /> : <p className="lb-empty">Este color aún no tiene fotos.</p>}
          {n > 1 ? (
            <>
              <button type="button" className="lb-arrow is-prev" onClick={() => go(-1)} aria-label="Foto anterior"><Chevron dir="prev" /></button>
              <button type="button" className="lb-arrow is-next" onClick={() => go(1)} aria-label="Foto siguiente"><Chevron dir="next" /></button>
            </>
          ) : null}
        </div>
        {n > 1 ? (
          <div className="lb-thumbs">
            {images.map((u, k) => (
              <button key={u} type="button" aria-label={`Foto ${k + 1}`} aria-current={k === i ? 'true' : undefined} onClick={() => setI(k)}><img src={u} alt="" /></button>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="lb-side" aria-label="Colores y telas">
        {variants.length ? (
          <section>
            <h3>Colores <span>{cur.color || cur.name}</span></h3>
            <div className="lb-variants">
              {variants.map((v) => (
                <button key={v.id} type="button" aria-pressed={v.id === cur.id} onClick={() => pick(v)} title={v.name}>
                  {v.images[0] ? <img src={v.images[0]} alt="" /> : <i style={v.swatches[0] ? swatchStyle(v.swatches[0]) : undefined} />}
                  <span>{v.color || v.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {swatches.length ? (
          <section>
            <h3>Muestrario de telas</h3>
            <div className="lb-swatches" role="list">
              {swatches.map((s, k) => (
                <button
                  key={`${s.fabric}|${s.name}|${k}`}
                  type="button"
                  role="listitem"
                  className="lb-swatch"
                  style={swatchStyle(s)}
                  aria-label={s.fabric ? `${s.name}, ${s.fabric}` : s.name}
                  aria-pressed={k === fabric}
                  onClick={() => tapSwatch(k)}
                >
                  <span className="lb-tip" aria-hidden="true"><b>{s.name}</b>{s.fabric ? <span>{s.fabric}</span> : null}</span>
                </button>
              ))}
            </div>
            <p className="lb-picked" aria-live="polite">{picked ? <><b>{picked.name}</b>{picked.fabric ? ` · ${picked.fabric}` : ''}</> : nav ? 'Toca una tela para ver el producto en ese color' : 'Pasa el cursor o toca una tela para ver su nombre'}</p>
          </section>
        ) : null}

        <div className="lb-cta">
          <button type="button" className="pg-btn lb-ask" onClick={() => { dlg.current?.close(); onAsk(cur); }}>Consultar precio</button>
          <Link href={`/producto/${cur.slug}`} className="lb-link">Ver en la tienda</Link>
        </div>
      </aside>
    </dialog>
  );
}

/* ─── Libro ────────────────────────────────────────────────────────── */
export function BookViewer({ book, whatsapp, instagram }: { book: Book; whatsapp: string | null; instagram: string | null }) {
  const leaves: Leaf[] = useMemo(() => [...book.pages, { id: -1, kind: 'contraportada' as const }], [book.pages]);
  const total = leaves.length;
  const [asking, setAsking] = useState<BookVariant | null>(null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const ctx: Ctx = { book, total, whatsapp, instagram, ask: setAsking, show: setGallery };

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
      if (asking || gallery) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goSpread(cur + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goSpread(cur - 1);
      if (e.key === 'Home') goSpread(0);
      if (e.key === 'End') goSpread(spreads.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goSpread, cur, spreads.length, asking, gallery]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const view = (i: number) => (i >= 0 ? leaves[i] : null);

  // Durante el giro: debajo queda lo que se descubre, encima la hoja que gira
  const base = flip ? (flip.dir === 'next' ? [spreads[flip.from][0], spreads[flip.to][1]] : [spreads[flip.to][0], spreads[flip.from][1]]) : spreads[cur];
  const leafFaces = flip ? (flip.dir === 'next' ? [spreads[flip.from][1], spreads[flip.to][0]] : [spreads[flip.from][0], spreads[flip.to][1]]) : null;
  const visible = spreads[cur].filter((i) => i >= 0);
  const label = visible.length === 2 ? `${visible[0] + 1}–${visible[1] + 1}` : `${(visible[0] ?? 0) + 1}`;

  return (
    <div className="libro">

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

      <footer className="libro-foot">
        <Link href="/" className="libro-brand" aria-label="Jamaroff, ir a la tienda">JAMAROFF</Link>
        {!book.published ? <span className="libro-draft">Borrador · solo tú lo ves</span> : null}
        <span className="libro-count" aria-live="polite">{label} / {total}</span>
        <span className="libro-hint">{single ? 'Desliza para pasar las páginas' : 'Flechas o teclado ← → para pasar las páginas'}</span>
      </footer>

      {gallery ? <GalleryDialog g={gallery} onClose={() => setGallery(null)} onAsk={setAsking} /> : null}
      {asking ? <AskDialog product={asking} ctx={ctx} onClose={() => setAsking(null)} /> : null}
    </div>
  );
}
