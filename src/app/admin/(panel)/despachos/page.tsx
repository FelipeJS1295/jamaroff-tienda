import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { ShippingZone } from '@/db/schema';
import { REGION_NAMES } from '@/lib/chile';
import { clp } from '@/lib/format';
import { deleteZoneAction, saveZoneAction } from '../../actions';
import { Flash } from '@/components/admin-flash';
import { ConfirmButton } from '@/components/auto-submit';

export const metadata = { title: 'Despachos y tarifas' };

function ZoneForm({ z, nextPos }: { z?: ShippingZone; nextPos: number }) {
  return (
    <form action={saveZoneAction} className="stack">
      {z ? <input type="hidden" name="id" value={z.id} /> : null}
      <div className="row">
        <label className="field" style={{ width: 70 }}><span>Orden</span><input className="input" name="position" defaultValue={z?.position ?? nextPos} inputMode="numeric" /></label>
        <label className="field" style={{ flex: '1 1 220px' }}><span>Nombre de la zona</span><input className="input" name="name" defaultValue={z?.name} required placeholder="Ej: Zona sur" /></label>
        <label className="field" style={{ flex: '1 1 180px' }}><span>Transportista</span><input className="input" name="carrier" defaultValue={z?.carrier ?? ''} placeholder="Ej: TVP" /></label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted" style={{ marginBottom: 8 }}>Regiones completas</legend>
        <div className="row" style={{ gap: '6px 16px' }}>
          {REGION_NAMES.map((r) => <label key={r} className="check small"><input type="checkbox" name="regions" value={r} defaultChecked={z?.regions.includes(r)} /> {r}</label>)}
        </div>
      </fieldset>
      <label className="field"><span>…o comunas específicas (separadas por coma). Tienen prioridad sobre las regiones.</span>
        <textarea className="textarea" name="comunas" style={{ minHeight: 60 }} defaultValue={z?.comunas.join(', ')} placeholder="Ej: Providencia, Ñuñoa, Las Condes" />
      </label>
      <div className="row">
        <label className="field" style={{ flex: '1 1 130px' }}><span>Tarifa base $</span><input className="input" name="baseRate" inputMode="numeric" defaultValue={z?.baseRate ?? 0} /></label>
        <label className="field" style={{ flex: '1 1 130px' }}><span>+ $ por m³</span><input className="input" name="ratePerM3" inputMode="numeric" defaultValue={z?.ratePerM3 ?? 0} /></label>
        <label className="field" style={{ flex: '1 1 130px' }}><span>Mínimo $</span><input className="input" name="minRate" inputMode="numeric" defaultValue={z?.minRate ?? 0} /></label>
        <label className="field" style={{ flex: '1 1 150px' }}><span>Gratis sobre $ (opcional)</span><input className="input" name="freeOver" inputMode="numeric" defaultValue={z?.freeOver ?? ''} /></label>
        <label className="field" style={{ flex: '2 1 200px' }}><span>Plazo que ve el cliente</span><input className="input" name="etaText" defaultValue={z?.etaText} placeholder="Ej: 5 a 10 días hábiles" /></label>
      </div>
      <div className="row">
        <label className="check small"><input type="checkbox" name="quoteOnly" defaultChecked={z?.quoteOnly} /> “A cotizar” (no se cobra en línea; lo informas después)</label>
        <label className="check small"><input type="checkbox" name="active" defaultChecked={z ? z.active : true} /> Activa</label>
        <span style={{ flex: 1 }} />
        <button className="btn btn-dark btn-sm" type="submit">{z ? 'Guardar' : '+ Crear zona'}</button>
        {z ? <ConfirmButton formAction={deleteZoneAction} className="mini-btn danger" message={`¿Eliminar la zona “${z.name}”?`}>Eliminar</ConfirmButton> : null}
      </div>
    </form>
  );
}

export default async function DespachosAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const zones = await db.select().from(schema.shippingZones).orderBy(asc(schema.shippingZones.position));
  const covered = new Set(zones.filter((z) => z.active).flatMap((z) => z.regions));
  const missing = REGION_NAMES.filter((r) => !covered.has(r));
  return (
    <>
      <div className="admin-head"><h1>Despachos y tarifas</h1></div>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="box small" style={{ marginBottom: 20 }}>
        <strong style={{ fontWeight: 500 }}>Cómo se calcula:</strong> costo = tarifa base + ($ por m³ × volumen embalado del pedido), nunca menos que el mínimo; redondeado a $100.
        El volumen sale de los “bultos” de cada producto. Ejemplo: base {clp(20000)} + {clp(25000)}/m³ con un sofá de 3 m³ = {clp(95000)}.
        {missing.length ? <p className="alert alert-info" style={{ margin: '10px 0 0' }}>Regiones sin zona (el despacho quedará “a cotizar”): {missing.join(', ')}</p> : null}
      </div>
      <div className="stack">
        {zones.map((z) => <section key={z.id} className="box">{<ZoneForm z={z} nextPos={zones.length} />}</section>)}
        <section className="box"><h2>Nueva zona</h2><ZoneForm nextPos={zones.length} /></section>
      </div>
    </>
  );
}
