'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { dayHour, hourText, LIGHT_LABEL, type LightHour } from '@/lib/light';

type Shot = { hour: number; url: string };

const phase = (t: number) => (t < 11 ? 'Mañana' : t < 14 ? 'Mediodía' : t < 17 ? 'Tarde' : t < 20 ? 'Atardecer' : 'Noche');
const clock = (t: number) => {
  const h = Math.floor(t) % 24;
  const m = Math.round((t % 1) * 60 / 15) * 15;
  return `${String(m === 60 ? (h + 1) % 24 : h).padStart(2, '0')}:${String(m === 60 ? 0 : m).padStart(2, '0')}`;
};
const isDay = (t: number) => t >= 6.5 && t < 19.5;

/**
 * Luz del día: la misma escena a distintas horas. Con el mouse sobre la foto (o arrastrando el sol)
 * la hora avanza y las fotos se funden entre sí. Parte en la hora actual del cliente.
 */
export function LightViewer({ shots, name }: { shots: Shot[]; name: string }) {
  const sorted = useMemo(() => [...shots].map((s) => ({ ...s, t: dayHour(s.hour) })).sort((a, b) => a.t - b.t), [shots]);
  const min = sorted[0].t;
  const max = sorted[sorted.length - 1].t;
  const [t, setT] = useState(() => Math.min(max, Math.max(min, 12)));
  const [touched, setTouched] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const anim = useRef(0);
  const id = useId();

  // Al aparecer, el sol recorre el día hasta la hora actual del cliente (una sola vez)
  useEffect(() => {
    const now = new Date();
    let target = now.getHours() + now.getMinutes() / 60;
    if (target < min && target < 6) target += 24; // de madrugada se ve la escena de noche
    target = Math.min(max, Math.max(min, target));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setT(target); return; }
    const from = Math.min(max, Math.max(min, 12));
    const start = performance.now();
    const step = (ms: number) => {
      const k = Math.min(1, (ms - start) / 1400);
      const e = 1 - Math.pow(1 - k, 3);
      setT(from + (target - from) * e);
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    const delay = setTimeout(() => { anim.current = requestAnimationFrame(step); }, 500);
    return () => { clearTimeout(delay); cancelAnimationFrame(anim.current); };
  }, [min, max]);

  const take = (v: number) => { cancelAnimationFrame(anim.current); setTouched(true); setT(Math.min(max, Math.max(min, v))); };

  // Mouse: la posición horizontal sobre la foto es la hora (no hace falta hacer clic)
  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse' || !box.current) return;
    const r = box.current.getBoundingClientRect();
    take(min + ((e.clientX - r.left) / r.width) * (max - min));
  }

  // Opacidad de cada foto: la anterior a la hora actual se ve entera y la siguiente se funde encima
  let i = sorted.findIndex((s, n) => n === sorted.length - 1 || (t >= s.t && t < sorted[n + 1].t));
  if (i < 0) i = 0;
  const next = Math.min(sorted.length - 1, i + 1);
  const f = next === i ? 0 : (t - sorted[i].t) / (sorted[next].t - sorted[i].t);
  const pct = ((t - min) / (max - min)) * 100;
  const day = isDay(t);

  return (
    <div className="light" ref={box} onPointerMove={onPointerMove} data-day={day ? '1' : '0'}>
      {sorted.map((s, n) => (
        <img
          key={s.hour}
          src={s.url}
          alt={n === i ? `${name}, luz de las ${hourText(s.hour)}` : ''}
          aria-hidden={n === i ? undefined : true}
          className="light-shot"
          style={{ opacity: n === i ? 1 : n === next ? f : 0, zIndex: n === next ? 2 : n === i ? 1 : 0 }}
          loading={n === i ? 'eager' : 'lazy'}
          draggable={false}
        />
      ))}

      <div className="light-ui">
        <p className="light-time" aria-live="polite">
          <span className="light-clock">{clock(t)}</span>
          <span className="light-phase">{phase(t)}</span>
        </p>

        <div className="light-track" style={{ ['--p' as string]: `${pct}%` }}>
          <span className="light-rail" aria-hidden="true" />
          {sorted.map((s) => (
            <button
              key={s.hour}
              type="button"
              className="light-tick"
              style={{ left: `${((s.t - min) / (max - min)) * 100}%` }}
              onClick={() => take(s.t)}
              aria-label={`Ver la luz de las ${hourText(s.hour)} (${LIGHT_LABEL[s.hour as LightHour]})`}
            >
              {hourText(s.hour).slice(0, 2)}
            </button>
          ))}
          <span className="light-knob" aria-hidden="true">
            {day ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 14.6A8.5 8.5 0 019.4 4a8.5 8.5 0 1010.6 10.6z" /></svg>
            )}
          </span>
          <label htmlFor={id} className="sr-only">Hora del día para ver la luz sobre {name}</label>
          <input
            id={id}
            className="light-range"
            type="range"
            min={min}
            max={max}
            step={0.25}
            value={t}
            onChange={(e) => take(Number(e.target.value))}
            aria-valuetext={`${clock(t)}, ${phase(t)}`}
          />
        </div>
        {!touched ? <p className="light-hint"><span className="hint-mouse">Mueve el cursor sobre la foto para ver la luz a otra hora</span><span className="hint-touch">Desliza el sol para ver la luz a otra hora</span></p> : null}
      </div>
    </div>
  );
}
