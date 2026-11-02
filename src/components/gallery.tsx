'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LightViewer } from './light-viewer';

type Img = { url: string; thumb: string; alt: string };
type Light = { hour: number; url: string };

const Arrow = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === 'prev' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
  </svg>
);

/**
 * Galería de la ficha: miniaturas al costado (abajo en el teléfono), la foto elegida en un
 * cuadro que cabe en la pantalla, flechas, y un visor a pantalla completa al hacer clic.
 * Si el producto tiene "Luz del día" (2 horas o más), esa escena es la primera miniatura.
 */
export function Gallery({ images, name, light = [] }: { images: Img[]; name: string; light?: Light[] }) {
  const hasLight = light.length >= 2;
  const lightThumb = hasLight ? (light.find((l) => l.hour === 12) ?? light[0]).url : null;
  // Elementos de la galería: la escena de luz (si hay) y luego las fotos
  const items = [...(hasLight ? [{ kind: 'light' as const }] : []), ...images.map((img) => ({ kind: 'photo' as const, img }))];
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null); // índice de la foto abierta en el visor
  const touch = useRef<number | null>(null);
  const thumbs = useRef<HTMLDivElement>(null);

  const go = useCallback((n: number) => setI(() => (n + items.length) % items.length), [items.length]);

  // Mantiene visible la miniatura activa
  useEffect(() => {
    thumbs.current?.querySelector<HTMLElement>(`[data-n="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [i]);

  if (!items.length) return <div className="pdp-gallery"><div className="pdp-stage" /></div>;
  const current = items[i] ?? items[0];
  const photoIndex = (n: number) => n - (hasLight ? 1 : 0); // posición entre las fotos (sin la escena de luz)

  return (
    <div className="pdp-gallery">
      {items.length > 1 ? (
        <div className="pdp-thumbs" ref={thumbs} role="list" aria-label="Fotos del producto">
          {items.map((it, n) => (
            <button
              key={it.kind === 'light' ? 'luz' : it.img.url}
              type="button"
              role="listitem"
              data-n={n}
              className={`pdp-thumb${it.kind === 'light' ? ' is-light' : ''}`}
              aria-current={n === i ? 'true' : undefined}
              aria-label={it.kind === 'light' ? 'Ver la luz del día' : `Ver foto ${photoIndex(n) + 1}`}
              onClick={() => setI(n)}
            >
              <img src={it.kind === 'light' ? lightThumb! : it.img.thumb} alt="" loading="lazy" />
              {it.kind === 'light' ? (
                <span className="pdp-thumb-sun" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="pdp-stage"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current === null || current.kind === 'light') return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        {current.kind === 'light' ? (
          <LightViewer shots={light} name={name} />
        ) : (
          <button type="button" className="pdp-zoom" onClick={() => setZoom(photoIndex(i))} aria-label={`Ampliar foto ${photoIndex(i) + 1} de ${name}`}>
            <img src={current.img.url} alt={current.img.alt || `${name}, foto ${photoIndex(i) + 1}`} />
          </button>
        )}
        {items.length > 1 ? (
          <>
            <button type="button" className="pdp-arrow is-prev" onClick={() => go(i - 1)} aria-label="Foto anterior"><Arrow dir="prev" /></button>
            <button type="button" className="pdp-arrow is-next" onClick={() => go(i + 1)} aria-label="Foto siguiente"><Arrow dir="next" /></button>
            <p className="pdp-count" aria-hidden="true">{i + 1} / {items.length}</p>
          </>
        ) : null}
      </div>

      {zoom !== null && images.length ? <Lightbox images={images} name={name} start={zoom} onClose={(n) => { setZoom(null); setI(n + (hasLight ? 1 : 0)); }} /> : null}
    </div>
  );
}

/** Visor a pantalla completa: flechas, teclado (← → Esc), deslizar en el teléfono y miniaturas abajo */
function Lightbox({ images, name, start, onClose }: { images: Img[]; name: string; start: number; onClose: (n: number) => void }) {
  const [n, setN] = useState(start);
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<number | null>(null);
  const go = useCallback((k: number) => setN((k + images.length) % images.length), [images.length]);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(n + 1);
      if (e.key === 'ArrowLeft') go(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, go]);

  const img = images[n];
  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={`Fotos de ${name}`}
      onClose={() => onClose(n)}
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('lightbox-stage')) dialog.current?.close(); }}
    >
      <div className="lightbox-bar">
        <span>{n + 1} / {images.length}</span>
        <button type="button" className="lightbox-close" onClick={() => dialog.current?.close()} aria-label="Cerrar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div
        className="lightbox-stage"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) go(n + (dx < 0 ? 1 : -1));
        }}
      >
        <img key={img.url} src={img.url} alt={img.alt || `${name}, foto ${n + 1}`} />
        {images.length > 1 ? (
          <>
            <button type="button" className="pdp-arrow is-prev" onClick={() => go(n - 1)} aria-label="Foto anterior"><Arrow dir="prev" /></button>
            <button type="button" className="pdp-arrow is-next" onClick={() => go(n + 1)} aria-label="Foto siguiente"><Arrow dir="next" /></button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="lightbox-thumbs">
          {images.map((im, k) => (
            <button key={im.url} type="button" className="pdp-thumb" aria-current={k === n ? 'true' : undefined} aria-label={`Ver foto ${k + 1}`} onClick={() => setN(k)}>
              <img src={im.thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </dialog>
  );
}
