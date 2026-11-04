import Link from 'next/link';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { addSwatchAction, saveSwatchAction, swatchOpAction } from '../../fabric-actions';
import { FABRIC_TYPES, swatchLabel } from '@/lib/fabrics';
import { Flash } from '@/components/admin-flash';
import { AutoSubmitSelect, ConfirmButton } from '@/components/auto-submit';

export const metadata = { title: 'Muestrario de telas' };

type Opt = { id: number; name: string };
/** Variante: el producto que se ve al tocar esta tela en el catálogo */
function VariantSelect({ products, self, value }: { products: Opt[]; self: Opt; value: number | null }) {
  return (
    <label className="field">
      <span>Variante (producto en este color)</span>
      <select className="select" name="linkedProductId" defaultValue={value ? String(value) : ''} style={{ height: 40 }}>
        <option value="">Sin variante</option>
        <option value={self.id}>Este mismo producto</option>
        {products.filter((o) => o.id !== self.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}

export default async function Muestrario({ searchParams }: { searchParams: Promise<{ producto?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const pid = Number(sp.producto) || 0;
  const prods = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      color: schema.products.color,
      category: schema.categories.name,
      telas: sql<number>`(select count(*) from product_variants v where v.product_id = "products"."id")::int`,
      thumb: sql<string | null>`(select coalesce(i.thumb_url, i.url) from product_images i where i.product_id = "products"."id" order by i.position limit 1)`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .orderBy(asc(schema.categories.name), asc(schema.products.name));
  const p = prods.find((x) => x.id === pid) ?? null;
  const swatches = p ? await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)).orderBy(asc(schema.productVariants.position), asc(schema.productVariants.id)) : [];
  const withFabrics = prods.filter((x) => x.telas > 0);
  const byName = [...prods].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Muestrario de telas</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Elige un producto y súbele la foto de cada tela, con su variante. En el catálogo digital se ven como círculos junto a las fotos: al tocar una, se ve el producto en ese color.</p>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <datalist id="tipos-tela">{FABRIC_TYPES.map((t) => <option key={t} value={t} />)}</datalist>

      <section className="box" style={{ marginBottom: 20 }}>
        <form action="/admin/muestrario" className="row" style={{ alignItems: 'center' }}>
          <label htmlFor="producto" className="small muted">Producto</label>
          <AutoSubmitSelect
            id="producto"
            name="producto"
            defaultValue={p ? String(p.id) : ''}
            options={[['', 'Elige un producto…'], ...prods.map((x) => [String(x.id), `${x.category ? `${x.category} · ` : ''}${x.name}${x.telas ? ` (${x.telas} ${x.telas === 1 ? 'tela' : 'telas'})` : ''}`] as [string, string])]}
          />
          <noscript><button className="btn btn-dark btn-sm" type="submit">Ver</button></noscript>
        </form>
        {!p && withFabrics.length ? (
          <div style={{ marginTop: 16 }}>
            <p className="small muted" style={{ margin: '0 0 8px' }}>Productos que ya tienen muestrario</p>
            <div className="fab-products">
              {withFabrics.map((x) => (
                <Link key={x.id} href={`/admin/muestrario?producto=${x.id}`}>
                  {x.thumb ? <img src={x.thumb} alt="" /> : <span className="fab-noimg" />}
                  <span>{x.name}<small>{x.telas} {x.telas === 1 ? 'tela' : 'telas'}</small></span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {p ? (
        <>
          <section className="box" id="telas" style={{ marginBottom: 20 }}>
            <div className="fab-head">
              {p.thumb ? <img src={p.thumb} alt="" /> : null}
              <div>
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                <p className="small muted" style={{ margin: '4px 0 0' }}>
                  {swatches.length ? `${swatches.length} ${swatches.length === 1 ? 'tela' : 'telas'} · el orden es el del catálogo` : 'Aún no tiene telas'} ·{' '}
                  <Link href={`/admin/productos/${p.id}`}>Editar producto</Link>
                </p>
              </div>
            </div>

            {swatches.length ? (
              <div className="fab-grid">
                {swatches.map((s, i) => (
                  <form key={s.id} id={`s${s.id}`} action={saveSwatchAction} className="fab-card">
                    <input type="hidden" name="swatchId" value={s.id} />
                    <span className="fab-circle" style={{ background: s.hex }} title={swatchLabel(s)}>
                      {s.imageUrl ? <img src={s.imageUrl} alt="" /> : null}
                    </span>
                    {!s.imageUrl ? <p className="small" style={{ margin: 0, color: 'var(--danger)' }}>Falta la foto de la tela</p> : null}
                    <label className="field"><span>Tipo de tela</span><input className="input" name="fabric" list="tipos-tela" defaultValue={s.fabric ?? ''} placeholder="Felpa, Lino…" /></label>
                    <label className="field"><span>Color</span><input className="input" name="name" defaultValue={s.name} required /></label>
                    <VariantSelect products={byName} self={p} value={s.linkedProductId} />
                    <label className="field"><span>{s.imageUrl ? 'Cambiar foto' : 'Foto de la tela'}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <button className="btn btn-dark btn-sm" type="submit">Guardar</button>
                      {i > 0 ? <button className="mini-btn" type="submit" formAction={swatchOpAction} name="op" value="left" aria-label="Mover antes">←</button> : null}
                      {i < swatches.length - 1 ? <button className="mini-btn" type="submit" formAction={swatchOpAction} name="op" value="right" aria-label="Mover después">→</button> : null}
                      <ConfirmButton className="mini-btn danger" formAction={swatchOpAction} name="op" value="delete" message={`¿Eliminar la tela ${swatchLabel(s)}?`}>Borrar</ConfirmButton>
                    </div>
                  </form>
                ))}
              </div>
            ) : null}
          </section>

          <section className="box" id="agregar">
            <h2>Agregar tela a {p.name}</h2>
            <form key={swatches.length} action={addSwatchAction} className="fab-add">
              <input type="hidden" name="productId" value={p.id} />
              <label className="field"><span>Foto de la tela</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label>
              <label className="field"><span>Tipo de tela</span><input className="input" name="fabric" list="tipos-tela" placeholder="Felpa, Lino, Charleston…" /></label>
              <label className="field"><span>Nombre del color</span><input className="input" name="name" placeholder="Gris oscuro" required /></label>
              <VariantSelect products={byName} self={p} value={null} />
              <button className="btn btn-dark btn-sm" type="submit">Agregar tela</button>
            </form>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Una foto de cerca de la tela, con luz pareja. Se recorta en cuadrado al centro. En <b>Variante</b> eliges el producto que es este mismo modelo en
              ese color: en el catálogo, al tocar la tela se muestran sus fotos (elige &quot;Este mismo producto&quot; para la tela con que está fotografiado). El recargo por tela y &quot;solo a pedido&quot; se siguen ajustando en el
              producto, en Telas / colores.
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}
