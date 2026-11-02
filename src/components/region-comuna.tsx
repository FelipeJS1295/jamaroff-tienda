'use client';

import { useId } from 'react';
import { REGIONS } from '@/lib/chile';

export function RegionComunaFields({
  region, comuna, onRegion, onComuna, compact = false, required = false, namePrefix,
}: {
  region: string; comuna: string; onRegion: (r: string) => void; onComuna: (c: string) => void; compact?: boolean; required?: boolean; namePrefix?: string;
}) {
  const id = useId();
  const comunas = REGIONS.find((r) => r.name === region)?.comunas ?? [];
  const style = compact ? { flex: '1 1 160px' } : undefined;
  return (
    <>
      <div className="field" style={style}>
        <label htmlFor={`${id}-r`} style={{ color: 'var(--muted)' }}>Región</label>
        <select id={`${id}-r`} className="select" value={region} required={required} name={namePrefix ? `${namePrefix}region` : undefined} onChange={(e) => onRegion(e.target.value)}>
          {REGIONS.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
      </div>
      <div className="field" style={style}>
        <label htmlFor={`${id}-c`} style={{ color: 'var(--muted)' }}>Comuna</label>
        <select id={`${id}-c`} className="select" value={comuna} required={required} name={namePrefix ? `${namePrefix}comuna` : undefined} onChange={(e) => onComuna(e.target.value)}>
          <option value="">Elige tu comuna</option>
          {comunas.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </>
  );
}
