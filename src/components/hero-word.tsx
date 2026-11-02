'use client';

import { useEffect, useRef } from 'react';

const WORD = 'JAMAROFF';
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * El nombre gigante de la portada. Al hacer scroll sube, se achica y se abre el espaciado
 * hasta quedar exactamente sobre el logo del header (que en la portada está oculto).
 * Publica el avance en --dock para que el header muestre "Home Atelier" al final.
 */
export function HeroWord() {
  const el = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const word = el.current;
    const hero = word?.closest('.hero') as HTMLElement | null;
    if (!word || !hero) return;
    const root = document.documentElement;
    let frame = 0;

    function update() {
      frame = 0;
      const target = document.querySelector('.site-header .brand-name');
      if (!word || !hero || !target) return;
      const vw = root.clientWidth;
      const heroH = hero.offsetHeight;
      const range = Math.max(240, heroH * 0.5);
      const p = Math.min(1, Math.max(0, window.scrollY / range));
      const t = ease(p);

      // Tamaño y espaciado de destino: los del logo del header
      const cs = getComputedStyle(target);
      const targetSize = parseFloat(cs.fontSize);
      const targetLs = parseFloat(cs.letterSpacing) / targetSize || 0.32;
      const startSize = vw * 0.19;
      const startLs = -0.035;

      word.style.letterSpacing = `${lerp(startLs, targetLs, t)}em`;
      // El tamaño óptico acompaña al tamaño en pantalla: sin esto, los trazos finos desaparecen al achicarse
      word.style.fontVariationSettings = `'opsz' ${Math.round(lerp(96, Math.min(96, targetSize), t))}`;
      // Tamaño natural (sin escalar) con el espaciado actual; se descuenta el espacio final de la última letra
      const ls = lerp(startLs, targetLs, t) * startSize;
      const w = word.offsetWidth - ls;
      const h = word.offsetHeight;
      const s = lerp(1, targetSize / startSize, t);

      // Centro de partida (en la portada) y de llegada (logo del header)
      const startCx = vw / 2;
      const startCy = heroH * (vw <= 760 ? 0.36 : 0.45);
      const r = target.getBoundingClientRect();
      const endW = r.width - parseFloat(cs.letterSpacing); // sin el margen negativo
      const endCx = r.left + endW / 2;
      const endCy = r.top + r.height / 2;
      const cx = lerp(startCx, endCx, t);
      const cy = lerp(startCy, endCy, t);

      word.style.transform = `translate(${cx - (w * s) / 2}px, ${cy - (h * s) / 2}px) scale(${s})`;
      root.style.setProperty('--dock', String(p >= 1 ? 1 : 0));
      word.dataset.docked = p >= 1 ? '1' : '0';
    }

    const request = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    word.classList.add('is-live');
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    document.fonts?.ready.then(request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
      root.style.removeProperty('--dock');
    };
  }, []);

  return (
    <p ref={el} className="hero-word" aria-hidden="true">
      {WORD.split('').map((l, i) => <span key={i} style={{ animationDelay: `${120 + i * 55}ms` }}>{l}</span>)}
    </p>
  );
}
