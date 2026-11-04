'use client';

import { useState } from 'react';
import type { PackageSpec } from '@/db/schema';

type Variant = { id?: number; name: string; hex: string; priceDelta: number; madeToOrderOnly: boolean };
type Spec = { label: string; value: string };

export type ProductFormData = {
  id?: number; name: string; sku: string; description: string; categoryId: number | null; price: number | null;
  compareAtPrice: number | null; wholesalePrice: number | null; wholesaleMinQty: number; mode: 'stock' | 'pedido' | 'ambos';
  stock: number; leadTimeDays: number | null; material: string; color: string; dimensions: string; featured: boolean; active: boolean;
  variants: Variant[]; packages: PackageSpec[]; specs: Spec[];
};

export function ProductForm({ data, categories, action }: { data: ProductFormData; categories: { id: number; name: string }[]; action: (fd: FormData) => Promise<void> }) {
  const [mode, setMode] = useState(data.mode);
  const [variants, setVariants] = useState<Variant[]>(data.variants);
  const [packages, setPackages] = useState<PackageSpec[]>(data.packages.length ? data.packages : [{ largo: 0, ancho: 0, alto: 0, peso: 0 }]);
  const [specs, setSpecs] = useState<Spec[]>(data.specs);
  const vol = packages.reduce((a, p) => a + (p.largo * p.ancho * p.alto) / 1e6, 0);

  return (
    <form action={action} className="grid-2">
      {data.id ? <input type="hidden" name="id" value={data.id} /> : null}
      <input type="hidden" name="variantsJson" value={JSON.stringify(variants)} />
      <input type="hidden" name="packagesJson" value={JSON.stringify(packages)} />
      <input type="hidden" name="specsJson" value={JSON.stringify(specs)} />

      <div className="stack">
        <section className="box stack">
          <h2 style={{ margin: 0 }}>Información</h2>
          <label className="field"><span>Nombre</span><input className="input" name="name" defaultValue={data.name} required /></label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}><span>SKU / código</span><input className="input" name="sku" defaultValue={data.sku} /></label>
            <label className="field" style={{ flex: 1 }}><span>Categoría</span>
              <select className="select" name="categoryId" defaultValue={data.categoryId ?? ''}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>Descripción</span><textarea className="textarea" name="description" defaultValue={data.description} style={{ minHeight: 160 }} /></label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}><span>Material</span><input className="input" name="material" defaultValue={data.material} placeholder="Tela, Lino, Cuero…" /></label>
            <label className="field" style={{ flex: 1 }}><span>Color</span><input className="input" name="color" defaultValue={data.color} placeholder="Gris, Beige…" /></label>
          </div>
          <label className="field"><span>Medidas (ancho × fondo × alto)</span><input className="input" name="dimensions" defaultValue={data.dimensions} placeholder="240 × 160 × 85 cm" /></label>
          <p className="small muted" style={{ margin: 0 }}>Material y color se usan como filtros en el catálogo: escríbelos siempre igual.</p>
        </section>

        <section className="box">
          <h2>Ficha técnica (opcional)</h2>
          <div className="rows-editor">
            {specs.map((s, i) => (
              <div className="r" key={i}>
                <input className="input" style={{ flex: '1 1 140px' }} placeholder="Ej: Relleno" aria-label="Característica" value={s.label} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input className="input" style={{ flex: '2 1 200px' }} placeholder="Ej: Espuma alta densidad" aria-label="Valor" value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                <button type="button" className="mini-btn danger" onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="mini-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setSpecs([...specs, { label: '', value: '' }])}>+ Agregar característica</button>
          </div>
        </section>
      </div>

      <div className="stack">
        <section className="box stack">
          <h2 style={{ margin: 0 }}>Precio y venta</h2>
          <div className="row">
            <label className="field" style={{ flex: 1 }}><span>Precio (CLP, con IVA)</span><input className="input" name="price" inputMode="numeric" defaultValue={data.price ?? ''} required /></label>
            <label className="field" style={{ flex: 1 }}><span>Precio “antes” (oferta)</span><input className="input" name="compareAtPrice" inputMode="numeric" defaultValue={data.compareAtPrice ?? ''} /></label>
          </div>
          <div className="row">
            <label className="field" style={{ flex: 1 }}><span>Precio mayorista</span><input className="input" name="wholesalePrice" inputMode="numeric" defaultValue={data.wholesalePrice ?? ''} /></label>
            <label className="field" style={{ flex: 1 }}><span>Mínimo mayorista (unidades)</span><input className="input" name="wholesaleMinQty" inputMode="numeric" defaultValue={data.wholesaleMinQty} /></label>
          </div>
          <label className="field"><span>Modalidad</span>
            <select className="select" name="mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="stock">Solo en stock</option>
              <option value="pedido">Solo a pedido</option>
              <option value="ambos">En stock y también a pedido</option>
            </select>
          </label>
          <div className="row">
            {mode !== 'pedido' ? <label className="field" style={{ flex: 1 }}><span>Stock disponible</span><input className="input" name="stock" inputMode="numeric" defaultValue={data.stock} /></label> : <input type="hidden" name="stock" value="0" />}
            {mode !== 'stock' ? <label className="field" style={{ flex: 1 }}><span>Días de fabricación</span><input className="input" name="leadTimeDays" inputMode="numeric" defaultValue={data.leadTimeDays ?? ''} /></label> : null}
          </div>
          <label className="check"><input type="checkbox" name="active" defaultChecked={data.active} /> Visible en la tienda</label>
          <label className="check"><input type="checkbox" name="featured" defaultChecked={data.featured} /> Destacado en la portada</label>
        </section>

        <section className="box">
          <h2>Telas / colores</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Las marcadas “solo a pedido” no se ofrecen para compra en stock.
            {data.id ? <> La foto y el tipo de cada tela se cargan en el <a href={`/admin/muestrario?producto=${data.id}`}>Muestrario de telas</a>.</> : null}
          </p>
          <div className="rows-editor">
            {variants.map((v, i) => (
              <div className="r" key={i}>
                <input type="color" aria-label="Color" value={v.hex} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))} style={{ width: 44, height: 40, padding: 2, border: '1px solid var(--line-strong)' }} />
                <input className="input" style={{ flex: '1 1 140px' }} placeholder="Nombre de la tela" aria-label="Nombre" value={v.name} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <input className="input" style={{ width: 110 }} placeholder="+ precio" aria-label="Recargo" inputMode="numeric" value={v.priceDelta || ''} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, priceDelta: Number(e.target.value.replace(/[^\d-]/g, '')) || 0 } : x))} />
                <label className="check small"><input type="checkbox" checked={v.madeToOrderOnly} onChange={(e) => setVariants(variants.map((x, j) => j === i ? { ...x, madeToOrderOnly: e.target.checked } : x))} /> Solo a pedido</label>
                <button type="button" className="mini-btn danger" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="mini-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setVariants([...variants, { name: '', hex: '#cccccc', priceDelta: 0, madeToOrderOnly: false }])}>+ Agregar tela</button>
          </div>
        </section>

        <section className="box">
          <h2>Bultos para despacho</h2>
          <p className="small muted" style={{ marginTop: 0 }}>Medidas de cada caja o bulto ya embalado. Con esto se calcula el costo de envío.</p>
          <div className="rows-editor">
            {packages.map((p, i) => (
              <div className="r" key={i}>
                {(['largo', 'ancho', 'alto', 'peso'] as const).map((k) => (
                  <label key={k} className="field" style={{ width: 90 }}><span>{k === 'peso' ? 'Peso kg' : `${k[0].toUpperCase()}${k.slice(1)} cm`}</span>
                    <input className="input" inputMode="numeric" value={p[k] || ''} onChange={(e) => setPackages(packages.map((x, j) => j === i ? { ...x, [k]: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } : x))} />
                  </label>
                ))}
                <button type="button" className="mini-btn danger" style={{ alignSelf: 'flex-end', marginBottom: 4 }} onClick={() => setPackages(packages.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="mini-btn" onClick={() => setPackages([...packages, { largo: 0, ancho: 0, alto: 0, peso: 0 }])}>+ Agregar bulto</button>
              <span className="small muted">Volumen total: {vol.toFixed(2)} m³</span>
            </div>
          </div>
        </section>

        <button className="btn btn-primary" type="submit">{data.id ? 'Guardar cambios' : 'Crear producto'}</button>
      </div>
    </form>
  );
}
