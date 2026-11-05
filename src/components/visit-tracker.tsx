'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Avisa cada página vista (también al navegar dentro de la tienda sin recargar) */
export function VisitTracker() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // Solo la primera página trae la de origen (Google, Instagram…); las siguientes son navegación interna
    const ref = first.current ? document.referrer : '';
    first.current = false;
    const body = JSON.stringify({ path, ref });
    try {
      if (!navigator.sendBeacon?.('/api/visita', new Blob([body], { type: 'application/json' })))
        void fetch('/api/visita', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    } catch {
      /* sin estadística, sin problema */
    }
  }, [path]);
  return null;
}
