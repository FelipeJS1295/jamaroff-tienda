import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { deleteLightAction, deleteProductAction, duplicateProductAction, imageAction, productSlugAction, saveProductAction, uploadImagesAction, uploadLightAction } from '../../../actions';
import { LIGHT_HOURS, LIGHT_LABEL, hourText } from '@/lib/light';
import { ProductForm } from '../product-form';
import { Flash } from '@/components/admin-flash';
import { ConfirmButton } from '@/components/auto-submit';

export const metadata = { title: 'Editar producto' };

export default async function EditarProducto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pid = Number(id);
  if (!pid) notFound();
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, pid)).limit(1);
  if (!p) notFound();
  const [cats, images, variants, lights] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.position)),
    db.select().from(schema.productImages).where(eq(schema.productImages.productId, pid)).orderBy(asc(schema.productImages.position)),
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, pid)).orderBy(asc(schema.productVariants.position)),
    db.select().from(schema.productLightImages).where(eq(schema.productLightImages.productId, pid)),
  ]);
  const lightOf = (h: number) => lights.find((l) => l.hour === h);

  return (
    <>
      <div className="admin-head">
        <div><Link href="/admin/productos" className="small">← Productos</Link><h1>{p.name}</h1></div>
        <div className="row">
          <a className="btn btn-outline btn-sm" href={`/producto/${p.slug}`} target="_blank">Ver en la tienda ↗</a>
          <form action={duplicateProductAction}><input type="hidden" name="id" value={p.id} /><button className="btn btn-outline btn-sm" type="submit">Duplicar</button></form>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="box" style={{ marginBottom: 20 }}>
        <h2>Fotos {images.length ? <span className="small muted" style={{ fontWeight: 400 }}>· la primera es la principal</span> : null}</h2>
        {images.length ? (
          <div className="img-grid" style={{ marginBottom: 16 }}>
            {images.map((img, i) => (
              <figure key={img.id}>
                <img src={img.thumbUrl ?? img.url} alt="" />
                <form action={imageAction} className="row" style={{ gap: 4 }}>
                  <input type="hidden" name="imageId" value={img.id} />
                  {i > 0 ? <button className="mini-btn" name="op" value="first" type="submit" title="Hacer principal">★</button> : <span className="tag tag-green">Principal</span>}
                  {i > 0 ? <button className="mini-btn" name="op" value="left" type="submit" aria-label="Mover a la izquierda">←</button> : null}
                  {i < images.length - 1 ? <button className="mini-btn" name="op" value="right" type="submit" aria-label="Mover a la derecha">→</button> : null}
                  <ConfirmButton className="mini-btn danger" name="op" value="delete" message="¿Eliminar esta foto?">Borrar</ConfirmButton>
                </form>
              </figure>
            ))}
          </div>
        ) : <p className="alert alert-info small">Este producto aún no tiene fotos.</p>}
        <form action={uploadImagesAction} className="row">
          <input type="hidden" name="productId" value={p.id} />
          <label className="field"><span>Subir fotos (JPG, PNG o WebP, hasta 20 a la vez)</span><input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple required /></label>
          <button className="btn btn-dark btn-sm" type="submit">Subir</button>
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>Se optimizan automáticamente. Recomendado: fotos verticales u horizontales de al menos 1600 px.</p>
      </section>

      <section className="box" id="luz" style={{ marginBottom: 20 }}>
        <h2>Luz del día <span className="small muted" style={{ fontWeight: 400 }}>· {lights.length} de {LIGHT_HOURS.length} horas</span></h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Sube la <strong>misma escena</strong> (mismo encuadre y tamaño) a cada hora. En la ficha, el cliente desliza un sol y la foto pasa de una hora a otra
          con un fundido. Se muestra desde que haya 2 horas; con las 7 se ve el día completo, incluida la lámpara encendida de noche.
        </p>
        <form action={uploadLightAction}>
          <input type="hidden" name="productId" value={p.id} />
          <div className="light-grid">
            {LIGHT_HOURS.map((h) => {
              const l = lightOf(h);
              return (
                <div key={h} className="light-slot">
                  <div className="light-preview">{l ? <img src={l.url} alt={`Escena a las ${hourText(h)}`} /> : <span>Sin foto</span>}</div>
                  <strong>{hourText(h)}</strong> <span className="small muted">{LIGHT_LABEL[h]}</span>
                  <input type="file" name={`luz_${h}`} accept="image/jpeg,image/png,image/webp" aria-label={`Foto de las ${hourText(h)}`} />
                  {l ? <ConfirmButton className="mini-btn danger" name="lightId" value={String(l.id)} formAction={deleteLightAction} message={`¿Eliminar la foto de las ${hourText(h)}?`}>Borrar</ConfirmButton> : null}
                </div>
              );
            })}
          </div>
          <button className="btn btn-dark btn-sm" type="submit" style={{ marginTop: 14 }}>Guardar fotos de luz</button>
        </form>
      </section>

      <ProductForm
        action={saveProductAction}
        categories={cats}
        data={{
          id: p.id, name: p.name, sku: p.sku ?? '', description: p.description, categoryId: p.categoryId, price: p.price,
          compareAtPrice: p.compareAtPrice, wholesalePrice: p.wholesalePrice, wholesaleMinQty: p.wholesaleMinQty, mode: p.mode,
          stock: p.stock, leadTimeDays: p.leadTimeDays, material: p.material ?? '', color: p.color ?? '', dimensions: p.dimensions ?? '',
          featured: p.featured, active: p.active,
          variants: variants.map((v) => ({ id: v.id, name: v.name, hex: v.hex, priceDelta: v.priceDelta, madeToOrderOnly: v.madeToOrderOnly })),
          packages: p.packages, specs: p.specs,
        }}
      />

      <div className="grid-2" style={{ marginTop: 20 }}>
        <section className="box">
          <h2>Dirección web</h2>
          <form action={productSlugAction} className="row">
            <input type="hidden" name="id" value={p.id} />
            <label className="field" style={{ flex: 1 }}><span>/producto/</span><input className="input" name="slug" defaultValue={p.slug} /></label>
            <button className="btn btn-outline btn-sm" type="submit">Cambiar</button>
          </form>
        </section>
        <section className="box">
          <h2>Eliminar</h2>
          <p className="small muted" style={{ marginTop: 0 }}>Si solo quieres sacarlo de la tienda, desmarca “Visible en la tienda”. Eliminar borra también sus fotos (los pedidos antiguos se conservan).</p>
          <form action={deleteProductAction}>
            <input type="hidden" name="id" value={p.id} />
            <ConfirmButton className="btn btn-outline btn-sm" message={`¿Eliminar definitivamente “${p.name}”?`}>Eliminar producto</ConfirmButton>
          </form>
        </section>
      </div>
    </>
  );
}
