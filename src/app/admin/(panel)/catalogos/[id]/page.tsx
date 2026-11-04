import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { addPageAction, deleteCatalogAction, pageOpAction, saveCatalogAction, savePageAction } from '../../../catalog-actions';
import { Flash } from '@/components/admin-flash';
import { ConfirmButton } from '@/components/auto-submit';

export const metadata = { title: 'Editar catálogo' };

const KIND_LABEL = { portada: 'Portada', separador: 'Separador', producto: 'Producto', telas: 'Muestrario de telas', texto: 'Texto libre' } as const;
const KIND_HELP: Record<keyof typeof KIND_LABEL, string> = {
  portada: 'Primera página: foto de fondo, título grande y bajada.',
  separador: 'Abre un capítulo (ej. "Seccionales"): título, frase y foto opcional.',
  producto: 'Trae solo fotos, telas, medidas y materiales del producto. Puedes elegir varios: se crea una página por cada uno.',
  telas: 'Todas las telas y colores de los productos del catálogo, con su nombre.',
  texto: 'Presentación de la marca, condiciones, contacto… Título, texto y foto opcional.',
};

export default async function EditarCatalogo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const cid = Number(id);
  if (!cid) notFound();
  const [c] = await db.select().from(schema.catalogs).where(eq(schema.catalogs.id, cid)).limit(1);
  if (!c) notFound();
  const [pages, prods] = await Promise.all([
    db.select().from(schema.catalogPages).where(eq(schema.catalogPages.catalogId, cid)).orderBy(asc(schema.catalogPages.position), asc(schema.catalogPages.id)),
    db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        description: schema.products.description,
        active: schema.products.active,
        category: schema.categories.name,
        thumb: sql<string | null>`(select coalesce(i.thumb_url, i.url) from product_images i where i.product_id = "products"."id" order by i.position limit 1)`,
      })
      .from(schema.products)
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .orderBy(asc(schema.categories.name), asc(schema.products.name)),
  ]);
  const prodById = new Map(prods.map((p) => [p.id, p]));
  const inBook = new Set(pages.map((p) => p.productId).filter(Boolean));

  return (
    <>
      <div className="admin-head">
        <div><Link href="/admin/catalogos" className="small">← Catálogos</Link><h1>{c.title}</h1></div>
        <div className="row">
          <a className="btn btn-outline btn-sm" href={`/${c.slug}`} target="_blank">Ver catálogo ↗</a>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <form action={saveCatalogAction} className="box row" style={{ marginBottom: 20 }}>
        <input type="hidden" name="id" value={c.id} />
        <label className="field" style={{ flex: '1 1 200px' }}><span>Título</span><input className="input" name="title" defaultValue={c.title} required /></label>
        <label className="field" style={{ flex: '2 1 240px' }}><span>Bajada</span><input className="input" name="subtitle" defaultValue={c.subtitle ?? ''} /></label>
        <label className="field" style={{ flex: '1 1 200px' }}><span>Dirección: jamaroff.cl/</span><input className="input" name="slug" defaultValue={c.slug} required /></label>
        <label className="check small" style={{ height: 46 }}><input type="checkbox" name="published" defaultChecked={c.published} /> Publicado</label>
        <button className="btn btn-dark btn-sm" type="submit">Guardar</button>
        <p className="small muted" style={{ flexBasis: '100%', margin: 0 }}>
          {c.published ? 'Cualquiera con la dirección puede verlo.' : 'Borrador: solo tú lo ves (con la sesión de admin abierta). Marca "Publicado" cuando esté listo.'}
        </p>
      </form>

      <section className="box" id="paginas" style={{ marginBottom: 20 }}>
        <h2>Páginas <span className="small muted" style={{ fontWeight: 400 }}>· {pages.length} · en el libro se ven de a dos (la portada sola)</span></h2>
        {pages.length ? (
          <ol className="cat-pages">
            {pages.map((p, n) => {
              const prod = p.productId ? prodById.get(p.productId) : null;
              const thumb = p.imageUrl ?? prod?.thumb ?? null;
              return (
                <li key={p.id} id={`p${p.id}`} className="cat-page">
                  <div className="cat-page-row">
                    <span className="cat-page-n">{n + 1}</span>
                    <span className="cat-page-thumb">{thumb ? <img src={thumb} alt="" /> : null}</span>
                    <span className="cat-page-info">
                      <span className="tag">{KIND_LABEL[p.kind]}</span>{' '}
                      <strong>{p.kind === 'producto' ? (prod?.name ?? 'Producto eliminado') : p.title || KIND_LABEL[p.kind]}</strong>
                      {p.kind === 'producto' && prod && !prod.active ? <span className="tag tag-red" style={{ marginLeft: 6 }}>Oculto en la tienda: no se muestra</span> : null}
                      {p.subtitle ? <span className="small muted" style={{ display: 'block' }}>{p.subtitle}</span> : null}
                    </span>
                    <form action={pageOpAction} className="row" style={{ gap: 4 }}>
                      <input type="hidden" name="pageId" value={p.id} />
                      {n > 0 ? <button className="mini-btn" name="op" value="up" type="submit" aria-label="Subir">↑</button> : null}
                      {n < pages.length - 1 ? <button className="mini-btn" name="op" value="down" type="submit" aria-label="Bajar">↓</button> : null}
                      <ConfirmButton className="mini-btn danger" name="op" value="delete" message="¿Eliminar esta página del catálogo?">Borrar</ConfirmButton>
                    </form>
                  </div>
                  <details>
                    <summary className="small">Editar contenido</summary>
                    <form action={savePageAction} className="form-grid" style={{ marginTop: 12 }}>
                      <input type="hidden" name="pageId" value={p.id} />
                      {p.kind === 'producto' ? (
                        <label className="field full"><span>Producto</span>
                          <select className="select" name="productId" defaultValue={p.productId ?? ''}>
                            {prods.map((o) => <option key={o.id} value={o.id}>{o.category ? `${o.category} · ` : ''}{o.name}{o.active ? '' : ' (oculto)'}</option>)}
                          </select>
                        </label>
                      ) : null}
                      <label className="field"><span>{p.kind === 'producto' ? 'Título (vacío = nombre del producto)' : 'Título'}</span><input className="input" name="title" defaultValue={p.title ?? ''} /></label>
                      <label className="field"><span>{p.kind === 'producto' ? 'Frase destacada (opcional)' : 'Bajada'}</span><input className="input" name="subtitle" defaultValue={p.subtitle ?? ''} /></label>
                      {p.kind === 'producto' ? (
                        <fieldset className="field full desc-choice">
                          <legend>Descripción</legend>
                          <label className="check small"><input type="radio" name="descMode" value="tienda" defaultChecked={!p.body} /> La misma de la tienda</label>
                          <label className="check small"><input type="radio" name="descMode" value="propia" defaultChecked={!!p.body} /> Escribir otra para el catálogo</label>
                          <p className="desc-store small">{prod?.description || 'Este producto no tiene descripción en la tienda.'}</p>
                          <textarea className="textarea desc-own" name="body" rows={6} defaultValue={p.body ?? prod?.description ?? ''} aria-label="Descripción para el catálogo" />
                          <span className="small muted">En la página del catálogo se ven unas 3 líneas; el texto completo queda en la tienda.</span>
                        </fieldset>
                      ) : (
                        <label className="field full"><span>Texto</span><textarea className="textarea" name="body" defaultValue={p.body ?? ''} /></label>
                      )}
                      {p.kind !== 'telas' ? (
                        <label className="field"><span>{p.kind === 'producto' ? 'Foto principal propia (vacío = la del producto)' : 'Foto'}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
                      ) : null}
                      {p.imageUrl ? <label className="check small"><input type="checkbox" name="removeImage" /> Quitar la foto actual</label> : null}
                      <div className="full"><button className="btn btn-dark btn-sm" type="submit">Guardar página</button></div>
                    </form>
                  </details>
                </li>
              );
            })}
          </ol>
        ) : <p className="alert alert-info small">Aún no hay páginas.</p>}
      </section>

      <section className="box" style={{ marginBottom: 20 }}>
        <h2>Agregar página</h2>
        <form action={addPageAction} className="cat-add">
          <input type="hidden" name="catalogId" value={c.id} />
          <fieldset className="cat-kinds">
            <legend className="small muted">Tipo de página</legend>
            {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).map((k) => (
              <label key={k} className="cat-kind">
                <input type="radio" name="kind" value={k} defaultChecked={k === 'producto'} />
                <strong>{KIND_LABEL[k]}</strong>
                <span className="small muted">{KIND_HELP[k]}</span>
              </label>
            ))}
          </fieldset>

          <div className="only-producto">
            <span className="small muted">Productos (se agregan en este orden; luego puedes moverlos)</span>
            <div className="cat-prods">
              {prods.map((o) => (
                <label key={o.id} className="cat-prod">
                  <input type="checkbox" name="productId" value={o.id} />
                  {o.thumb ? <img src={o.thumb} alt="" /> : <span className="cat-prod-ph" />}
                  <span>
                    {o.name}
                    <span className="small muted" style={{ display: 'block' }}>
                      {o.category ?? 'Sin categoría'}{inBook.has(o.id) ? ' · ya está en el catálogo' : ''}{o.active ? '' : ' · oculto en la tienda'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-grid not-telas">
            <label className="field"><span>Título</span><input className="input" name="title" placeholder="Ej: Seccionales" /></label>
            <label className="field"><span>Bajada o frase</span><input className="input" name="subtitle" /></label>
            <label className="field full"><span>Texto</span><textarea className="textarea" name="body" /></label>
            <label className="field"><span>Foto (opcional)</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" style={{ marginTop: 14 }}>+ Agregar</button>
        </form>
      </section>

      <section className="box">
        <h2>Eliminar catálogo</h2>
        <form action={deleteCatalogAction}>
          <input type="hidden" name="id" value={c.id} />
          <ConfirmButton className="btn btn-outline btn-sm" message={`¿Eliminar "${c.title}" y todas sus páginas? Los productos no se tocan.`}>Eliminar catálogo</ConfirmButton>
        </form>
      </section>
    </>
  );
}
