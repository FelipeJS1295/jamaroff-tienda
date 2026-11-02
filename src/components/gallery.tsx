'use client';

import { useRef, useState } from 'react';
import { LightViewer } from './light-viewer';

// Escritorio: fotos apiladas a todo el ancho. Teléfono: carrusel deslizable con contador.
// Si el producto tiene "Luz del día" (2 horas o más), esa escena va primero.
export function Gallery({ images, name, light = [] }: { images: { url: string; thumb: string; alt: string }[]; name: string; light?: { hour: number; url: string }[] }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const hasLight = light.length >= 2;
  const total = images.length;
  if (!total && !hasLight) return <div className="pdp-gallery"><div className="pdp-main" /></div>;
  return (
    <div className="pdp-gallery">
      {hasLight ? <LightViewer shots={light} name={name} /> : null}
      {total ? <div className="pdp-photos">
      <div
        className="pdp-track"
        ref={track}
        onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
      >
        {images.map((img, n) => (
          <img key={img.url} className="pdp-main" src={img.url} alt={img.alt || `${name}, foto ${n + 1}`} loading={n === 0 && !hasLight ? 'eager' : 'lazy'} />
        ))}
      </div>
      {total > 1 ? <p className="pdp-count" aria-hidden="true">{i + 1} / {total}</p> : null}
      </div> : null}
    </div>
  );
}
